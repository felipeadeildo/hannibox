import { schema } from "@hannibox/db"
import {
  CreateRecipe,
  CreateVariation,
  ListRecipes,
  UpdateRecipe,
  type ApiError,
  type IngredientLine,
  type Unit,
} from "@hannibox/shared"
import { and, count, desc, eq, isNull, lt, notInArray, or, sql } from "drizzle-orm"
import { Hono } from "hono"
import type { Context } from "hono"

import { requireUser } from "../auth"
import { contains } from "../db"
import type { Db, UserEnv } from "../env"
import { SaveForm, readSave } from "../save"
import { validate } from "../validate"

const { image, ingredient, recipe, recipeIngredient } = schema

type Line = Pick<IngredientLine, "name" | "quantity" | "unit">

const writeCursor = (row: { updatedAt: Date; id: string }) => `${row.updatedAt.getTime()}_${row.id}`

function readCursor(cursor: string) {
  const at = cursor.indexOf("_")
  return { updatedAt: new Date(Number(cursor.slice(0, at))), id: cursor.slice(at + 1) }
}

const notFound = (c: Context<UserEnv>) =>
  c.json({ error: "Recipe not found" } satisfies ApiError, 404)

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("A row that was just written is missing")
  return value
}

async function owns(db: Db, userId: string, id: string) {
  const [row] = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(eq(recipe.id, id), eq(recipe.userId, userId)))
  return row !== undefined
}

/** Image ids only, never their bytes. */
async function loadRecipe(db: Db, userId: string, id: string) {
  const row = await db.query.recipe.findFirst({
    columns: { userId: false },
    where: (r, { and, eq }) => and(eq(r.id, id), eq(r.userId, userId)),
    with: {
      images: { columns: { id: true, mimeType: true } },
      ingredients: {
        orderBy: (line, { asc }) => [asc(line.position)],
        with: { ingredient: { with: { images: { columns: { id: true }, limit: 1 } } } },
      },
    },
  })
  if (!row) return undefined
  return {
    ...row,
    ingredients: row.ingredients.map(({ quantity, unit, ingredient }) => ({
      ingredientId: ingredient.id,
      name: ingredient.name,
      quantity,
      unit,
      imageId: ingredient.images[0]?.id ?? null,
    })),
  }
}

/**
 * A query builder is thenable, so returning one from an async function would run it. Only reading
 * the bytes is awaited.
 */
async function writePhotos(db: Db, recipeId: string, photos: File[]) {
  const bytes = await Promise.all(photos.map((file) => file.arrayBuffer()))
  return photos.map((file, index) =>
    db.insert(image).values({
      id: crypto.randomUUID(),
      content: new Uint8Array(bytes[index] ?? new ArrayBuffer(0)),
      mimeType: file.type,
      recipeId,
    }),
  )
}

const refused = (c: Context<UserEnv>, save: { status: 400 | 413 | 415; body: ApiError }) =>
  c.json(save.body, save.status)

// Writes the lines in two statements however long the list is. D1 takes 100 bound parameters
// per query and 50 queries per invocation on the free plan, so each list travels as one JSON
// and `json_each` unfolds it. An `insert ... select` fills every column, in the schema's order.
function writeIngredients(db: Db, recipeId: string, lines: Line[]) {
  const names = JSON.stringify(lines.map(({ name }) => ({ id: crypto.randomUUID(), name })))
  const rows = JSON.stringify(
    lines.map(({ name, quantity, unit }, position) => ({ name, quantity, unit, position })),
  )
  return [
    db
      .insert(ingredient)
      .select(
        db
          .select({
            id: sql<string>`value ->> 'id'`.as("id"),
            name: sql<string>`value ->> 'name'`.as("name"),
          })
          .from(sql`json_each(${names})`)
          // SQLite needs a WHERE here, or it reads the ON of the upsert as a join.
          .where(sql`true`),
      )
      .onConflictDoNothing(),
    db.insert(recipeIngredient).select(
      db
        .select({
          recipeId: sql<string>`${recipeId}`.as("recipe_id"),
          ingredientId: ingredient.id,
          quantity: sql<number>`j.value ->> 'quantity'`.as("quantity"),
          unit: sql<Unit | null>`j.value ->> 'unit'`.as("unit"),
          position: sql<number>`j.value ->> 'position'`.as("position"),
        })
        .from(sql`json_each(${rows}) as j`)
        .innerJoin(ingredient, sql`${ingredient.name} = j.value ->> 'name'`),
    ),
  ]
}

export default new Hono<UserEnv>()
  .use(requireUser)
  .get("/", validate("query", ListRecipes), async (c) => {
    const { q, original, cursor, limit } = c.req.valid("query")
    const db = c.get("db")
    const mine = and(
      eq(recipe.userId, c.get("user").id),
      original ? isNull(recipe.parentId) : undefined,
      q ? contains(recipe.title, q) : undefined,
    )
    const after = cursor ? readCursor(cursor) : undefined
    const [rows, [counted]] = await db.batch([
      db
        .select({
          id: recipe.id,
          title: recipe.title,
          parentId: recipe.parentId,
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt,
          // What a row of the list shows: how much is in it, what grew from it, and its first photo.
          // The outer table is named in full: in a one-table select Drizzle writes `${recipe.id}`
          // as a bare "id", which inside these subqueries would mean their own id.
          ingredients:
            sql<number>`(select count(*) from recipe_ingredient where recipe_ingredient.recipe_id = recipe.id)`.mapWith(
              Number,
            ),
          versions:
            sql<number>`(select count(*) from recipe as child where child.parent_id = recipe.id)`.mapWith(
              Number,
            ),
          cover: sql<
            string | null
          >`(select image.id from image where image.recipe_id = recipe.id limit 1)`,
        })
        .from(recipe)
        .where(
          and(
            mine,
            after &&
              or(
                lt(recipe.updatedAt, after.updatedAt),
                and(eq(recipe.updatedAt, after.updatedAt), lt(recipe.id, after.id)),
              ),
          ),
        )
        .orderBy(desc(recipe.updatedAt), desc(recipe.id))
        // One more than asked for, to know whether there is a next page without a second query.
        .limit(limit + 1),
      db.select({ total: count() }).from(recipe).where(mine),
    ])
    const items = rows.slice(0, limit)
    const last = items.at(-1)
    const nextCursor = rows.length > limit && last ? writeCursor(last) : null
    return c.json({ items, nextCursor, total: must(counted).total }, 200)
  })
  .post("/", validate("form", SaveForm), async (c) => {
    const save = readSave(CreateRecipe, c.req.valid("form"))
    if (!save.ok) return refused(c, save)
    const { ingredients = [], ...fields } = save.data
    const db = c.get("db")
    const userId = c.get("user").id
    const id = crypto.randomUUID()
    await db.batch([
      db.insert(recipe).values({ id, userId, ...fields }),
      ...writeIngredients(db, id, ingredients),
      ...(await writePhotos(db, id, save.photos)),
    ])
    return c.json(must(await loadRecipe(db, userId, id)), 201)
  })
  .get("/:id", async (c) => {
    const found = await loadRecipe(c.get("db"), c.get("user").id, c.req.param("id"))
    return found ? c.json(found, 200) : notFound(c)
  })
  .patch("/:id", validate("form", SaveForm), async (c) => {
    const save = readSave(UpdateRecipe, c.req.valid("form"))
    if (!save.ok) return refused(c, save)
    const { ingredients, images, ...fields } = save.data
    const db = c.get("db")
    const userId = c.get("user").id
    const id = c.req.param("id")
    // Checked first: the statements below are keyed by the id alone.
    if (!(await owns(db, userId, id))) return notFound(c)

    await db.batch([
      db
        .update(recipe)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(recipe.id, id)),
      // The photos named stay and the rest go. Naming none deletes them all.
      ...(images
        ? [
            db
              .delete(image)
              .where(
                and(
                  eq(image.recipeId, id),
                  images.length > 0 ? notInArray(image.id, images) : undefined,
                ),
              ),
          ]
        : []),
      ...(ingredients
        ? [
            db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id)),
            ...writeIngredients(db, id, ingredients),
          ]
        : []),
      ...(await writePhotos(db, id, save.photos)),
    ])
    return c.json(must(await loadRecipe(db, userId, id)), 200)
  })
  // Deleting a recipe takes it out of the tree: its variations move up to its parent.
  .delete("/:id", async (c) => {
    const db = c.get("db")
    const id = c.req.param("id")
    const [row] = await db
      .select({ parentId: recipe.parentId })
      .from(recipe)
      .where(and(eq(recipe.id, id), eq(recipe.userId, c.get("user").id)))
    if (!row) return notFound(c)

    await db.batch([
      // `updatedAt` keeps its own value: moving a recipe is not editing it.
      db
        .update(recipe)
        .set({ parentId: row.parentId, updatedAt: recipe.updatedAt })
        .where(eq(recipe.parentId, id)),
      db.delete(recipe).where(eq(recipe.id, id)),
    ])
    return c.body(null, 204)
  })
  .get("/:id/tree", async (c) => {
    const id = c.req.param("id")
    const userId = c.get("user").id
    const rows = await c.get("db").all<{
      id: string
      parentId: string | null
      title: string
      createdAt: number
      updatedAt: number
    }>(sql`
      with recursive
        up(id, parent_id) as (
          select id, parent_id from recipe where id = ${id} and user_id = ${userId}
          union
          select r.id, r.parent_id from recipe r join up on r.id = up.parent_id
        ),
        down(id) as (
          select id from up where parent_id is null
          union
          select r.id from recipe r join down on r.parent_id = down.id
        )
      select r.id, r.parent_id as parentId, r.title, r.created_at as createdAt, r.updated_at as updatedAt
      from recipe r join down on r.id = down.id
      order by r.created_at, r.id`)

    const nodes = rows.map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }))
    const root = nodes.find((node) => node.parentId === null)
    return root ? c.json({ rootId: root.id, currentId: id, nodes }, 200) : notFound(c)
  })
  .post("/:id/variations", validate("form", SaveForm), async (c) => {
    const save = readSave(CreateVariation, c.req.valid("form"))
    if (!save.ok) return refused(c, save)
    const { ingredients, images, ...changes } = save.data
    const db = c.get("db")
    const userId = c.get("user").id
    const from = await loadRecipe(db, userId, c.req.param("id"))
    if (!from) return notFound(c)

    const id = crypto.randomUUID()
    // The copy gets its own photos, so deleting the original cannot take them away.
    const copies = from.images
      .filter((photo) => images === undefined || images.includes(photo.id))
      .map((photo) => ({ from: photo.id, to: crypto.randomUUID() }))
    await db.batch([
      db.insert(recipe).values({
        id,
        userId,
        parentId: from.id,
        title: changes.title ?? from.title,
        source: changes.source === undefined ? from.source : changes.source,
        content: changes.content ?? from.content,
        yield: changes.yield === undefined ? from.yield : changes.yield,
        yieldUnit: changes.yieldUnit === undefined ? from.yieldUnit : changes.yieldUnit,
      }),
      db.insert(image).select(
        db
          .select({
            id: sql<string>`j.value ->> 'to'`.as("id"),
            content: image.content,
            mimeType: image.mimeType,
            recipeId: sql<string>`${id}`.as("recipe_id"),
            ingredientId: sql<string | null>`null`.as("ingredient_id"),
          })
          .from(sql`json_each(${JSON.stringify(copies)}) as j`)
          .innerJoin(image, sql`${image.id} = j.value ->> 'from'`),
      ),
      ...writeIngredients(db, id, ingredients ?? from.ingredients),
      ...(await writePhotos(db, id, save.photos)),
    ])
    return c.json(must(await loadRecipe(db, userId, id)), 201)
  })
