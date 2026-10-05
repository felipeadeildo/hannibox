import { schema } from "@hannibox/db"
import { IMAGE_TYPE_NAMES, MAX_IMAGE_BYTES, isImageType, type ApiError } from "@hannibox/shared"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import type { Context } from "hono"
import { z } from "zod"

import { requireUser } from "../auth"
import type { UserEnv } from "../env"

const { image, recipe } = schema

export const ImageUpload = z.object({ file: z.instanceof(File) })

type Owner = { recipeId: string } | { ingredientId: string }

export async function storeImage(c: Context<UserEnv>, owner: Owner, file: File) {
  if (!isImageType(file.type)) {
    return c.json({ error: `A photo has to be a ${IMAGE_TYPE_NAMES}` } satisfies ApiError, 415)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return c.json(
      { error: `A photo has to be under ${MAX_IMAGE_BYTES / 1_000_000} MB` } satisfies ApiError,
      413,
    )
  }
  const db = c.get("db")
  const id = crypto.randomUUID()
  const content = new Uint8Array(await file.arrayBuffer())
  const insert = db.insert(image).values({ id, content, mimeType: file.type, ...owner })
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
      ingredientId: image.ingredientId,
      owner: recipe.userId,
    })
    .from(image)
    .leftJoin(recipe, eq(recipe.id, image.recipeId))
    .where(eq(image.id, c.req.param("id")))

  // A recipe's images are private to its owner. An ingredient's photo is shared.
  if (!row || (row.ingredientId === null && row.owner !== c.get("user").id)) {
    return c.json({ error: "Image not found" } satisfies ApiError, 404)
  }
  // The id changes whenever the bytes do, so a browser can keep it for good.
  return c.body(row.content, 200, {
    "Content-Type": row.mimeType,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  })
})
