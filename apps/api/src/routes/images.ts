import { schema } from "@hannibox/db"
import type { ApiError } from "@hannibox/shared"
import { eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import type { Context } from "hono"
import { z } from "zod"

import { requireUser } from "../auth"
import type { UserEnv } from "../env"
import { readPhoto } from "../photos"

const { image, ingredient, recipe } = schema

export const ImageUpload = z.object({ file: z.instanceof(File) })

type Owner = { recipeId: string } | { ingredientId: string }

export async function storeImage(c: Context<UserEnv>, owner: Owner, file: File) {
  const read = await readPhoto(file)
  if (!read.ok) return c.json(read.body, read.status)
  const db = c.get("db")
  const id = crypto.randomUUID()
  const insert = db.insert(image).values({ id, ...read.photo, ...owner })
  if ("ingredientId" in owner) {
    // The new photo replaces the old one, or nothing changes.
    await db.batch([db.delete(image).where(eq(image.ingredientId, owner.ingredientId)), insert])
  } else {
    await insert
  }
  return c.json({ id }, 201)
}

export default new Hono<UserEnv>().use(requireUser).get("/:id", async (c) => {
  const [row] = await c
    .get("db")
    .select({
      content: image.content,
      mimeType: image.mimeType,
      // One of the two, since an image belongs to a recipe or to an ingredient.
      owner: sql<string | null>`coalesce(${recipe.userId}, ${ingredient.userId})`,
    })
    .from(image)
    .leftJoin(recipe, eq(recipe.id, image.recipeId))
    .leftJoin(ingredient, eq(ingredient.id, image.ingredientId))
    .where(eq(image.id, c.req.param("id")))

  // An image is private to the owner of its recipe or of its ingredient.
  if (!row || row.owner !== c.get("user").id) {
    return c.json({ error: "Image not found" } satisfies ApiError, 404)
  }
  // The id changes whenever the bytes do, so a browser can keep it for good.
  return c.body(row.content, 200, {
    "Content-Type": row.mimeType,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  })
})
