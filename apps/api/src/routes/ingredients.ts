import { schema } from "@hannibox/db"
import { FindIngredients, type ApiError } from "@hannibox/shared"
import { and, eq, exists } from "drizzle-orm"
import { Hono } from "hono"

import { requireUser } from "../auth"
import { contains } from "../db"
import type { UserEnv } from "../env"
import { validate } from "../validate"
import { ImageUpload, storeImage } from "./images"

const { ingredient, recipeIngredient } = schema

export default new Hono<UserEnv>()
  .use(requireUser)
  // The user's own ingredients that some recipe of theirs still lists. One left behind by a
  // rename, like a typo fixed in a line, stays out of the suggestions.
  .get("/", validate("query", FindIngredients), async (c) => {
    const { q } = c.req.valid("query")
    const db = c.get("db")
    const rows = await db.query.ingredient.findMany({
      where: (row) =>
        and(
          eq(row.userId, c.get("user").id),
          exists(
            db
              .select({ one: recipeIngredient.ingredientId })
              .from(recipeIngredient)
              .where(eq(recipeIngredient.ingredientId, row.id)),
          ),
          q ? contains(row.name, q) : undefined,
        ),
      orderBy: (row, { asc }) => [asc(row.name)],
      limit: 20,
      with: { images: { columns: { id: true }, limit: 1 } },
    })
    return c.json(
      { items: rows.map(({ id, name, images }) => ({ id, name, imageId: images[0]?.id ?? null })) },
      200,
    )
  })
  // An ingredient has one photo, for every recipe of its owner that lists it.
  .put("/:id/image", validate("form", ImageUpload), async (c) => {
    const db = c.get("db")
    const ingredientId = c.req.param("id")
    const [found] = await db
      .select({ id: ingredient.id })
      .from(ingredient)
      .where(and(eq(ingredient.id, ingredientId), eq(ingredient.userId, c.get("user").id)))
    if (!found) return c.json({ error: "Ingredient not found" } satisfies ApiError, 404)

    return storeImage(c, { ingredientId }, c.req.valid("form").file)
  })
