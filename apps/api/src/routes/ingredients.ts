import { schema } from "@hannibox/db"
import { FindIngredients, type ApiError } from "@hannibox/shared"
import { eq } from "drizzle-orm"
import { Hono } from "hono"

import { requireUser } from "../auth"
import { contains } from "../db"
import type { UserEnv } from "../env"
import { validate } from "../validate"
import { ImageUpload, storeImage } from "./images"

const { ingredient } = schema

export default new Hono<UserEnv>()
  .use(requireUser)
  // For autocomplete: the first 20 names that contain `q`.
  .get("/", validate("query", FindIngredients), async (c) => {
    const { q } = c.req.valid("query")
    const rows = await c.get("db").query.ingredient.findMany({
      where: q ? (row) => contains(row.name, q) : undefined,
      orderBy: (row, { asc }) => [asc(row.name)],
      limit: 20,
      with: { images: { columns: { id: true }, limit: 1 } },
    })
    return c.json({
      items: rows.map(({ id, name, images }) => ({ id, name, imageId: images[0]?.id ?? null })),
    })
  })
  // The catalog is shared, so an ingredient has one photo and anyone can replace it.
  .put("/:id/image", validate("form", ImageUpload), async (c) => {
    const db = c.get("db")
    const ingredientId = c.req.param("id")
    const [found] = await db
      .select({ id: ingredient.id })
      .from(ingredient)
      .where(eq(ingredient.id, ingredientId))
    if (!found) return c.json({ error: "Ingredient not found" } satisfies ApiError, 404)

    return storeImage(c, { ingredientId }, c.req.valid("form").file)
  })
