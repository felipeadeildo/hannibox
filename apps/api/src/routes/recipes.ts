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
import { and, count, desc, eq, isNull, sql } from "drizzle-orm"
import { Hono } from "hono"
import type { Context } from "hono"

import { requireUser } from "../auth"
import { contains } from "../db"
import type { Db, UserEnv } from "../env"
import { validate } from "../validate"
import { ImageUpload, storeImage } from "./images"

const { image, ingredient, recipe, recipeIngredient } = schema

type Line = Pick<IngredientLine, "name" | "quantity" | "unit">

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

/** A recipe with its ingredient lines in order and the ids of its images, never their bytes. */
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
    const { q, original, page, pageSize } = c.req.valid("query")
    const db = c.get("db")
    const where = and(
      eq(recipe.userId, c.get("user").id),
      original ? isNull(recipe.parentId) : undefined,
      q ? contains(recipe.title, q) : undefined,
    )
    const [items, [counted]] = await db.batch([
      db
        .select({
          id: recipe.id,
          title: recipe.title,
          parentId: recipe.parentId,
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt,
        })
        .from(recipe)
        .where(where)
        .orderBy(desc(recipe.updatedAt), desc(recipe.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(recipe).where(where),
    ])
    const total = must(counted).total
    return c.json({ items, page, pageSize, total, pages: Math.ceil(total / pageSize) })
  })
  .post("/", validate("json", CreateRecipe), async (c) => {
    const { ingredients = [], ...fields } = c.req.valid("json")
    const db = c.get("db")
    const userId = c.get("user").id
    const id = crypto.randomUUID()
    await db.batch([
      db.insert(recipe).values({ id, userId, ...fields }),
      ...writeIngredients(db, id, ingredients),
    ])
    return c.json(must(await loadRecipe(db, userId, id)), 201)
  })
  .get("/:id", async (c) => {
    const found = await loadRecipe(c.get("db"), c.get("user").id, c.req.param("id"))
    return found ? c.json(found) : notFound(c)
  })
  .patch("/:id", validate("json", UpdateRecipe), async (c) => {
    const { ingredients, ...fields } = c.req.valid("json")
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
      ...(ingredients
        ? [
            db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id)),
            ...writeIngredients(db, id, ingredients),
          ]
        : []),
    ])
    return c.json(must(await loadRecipe(db, userId, id)))
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
  // Every recipe of the tree this one belongs to, as a flat list: the client links
  // `parentId` to `id` and draws it however it likes. `rootId` is the original.
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
    return root ? c.json({ rootId: root.id, currentId: id, nodes }) : notFound(c)
  })
  // A copy of the recipe, its ingredients and its images, linked below it in the tree.
  .post("/:id/variations", validate("json", CreateVariation), async (c) => {
    const db = c.get("db")
    const userId = c.get("user").id
    const from = await loadRecipe(db, userId, c.req.param("id"))
    if (!from) return notFound(c)

    const id = crypto.randomUUID()
    // The copy gets its own images and its content points at them, so deleting the
    // original later cannot break it.
    const copies = from.images.map((old) => ({ from: old.id, to: crypto.randomUUID() }))
    const content = copies.reduce((text, copy) => text.replaceAll(copy.from, copy.to), from.content)
    await db.batch([
      db.insert(recipe).values({
        id,
        userId,
        parentId: from.id,
        title: c.req.valid("json").title ?? from.title,
        source: from.source,
        content,
        yield: from.yield,
        yieldUnit: from.yieldUnit,
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
      ...writeIngredients(db, id, from.ingredients),
    ])
    return c.json(must(await loadRecipe(db, userId, id)), 201)
  })
  .post("/:id/images", validate("form", ImageUpload), async (c) => {
    const id = c.req.param("id")
    if (!(await owns(c.get("db"), c.get("user").id, id))) return notFound(c)
    return storeImage(c, { recipeId: id }, c.req.valid("form").file)
  })
