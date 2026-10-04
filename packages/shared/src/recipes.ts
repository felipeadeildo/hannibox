import { z } from "zod"

import { Unit } from "./units"

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
export type ImageType = (typeof IMAGE_TYPES)[number]

export function isImageType(type: string): type is ImageType {
  return IMAGE_TYPES.some((allowed) => allowed === type)
}

/** D1 caps a row at 2 MB, and the image shares its row with a few short columns. */
export const MAX_IMAGE_BYTES = 1_900_000

export const IngredientLine = z.object({
  // Stored trimmed and lowercase: SQLite folds case for ASCII only.
  name: z.string().trim().toLowerCase().min(1).max(80),
  quantity: z.number().positive(),
  // Null counts things: "2 eggs".
  unit: Unit.nullish(),
})
export type IngredientLine = z.infer<typeof IngredientLine>

const Ingredients = z
  .array(IngredientLine)
  .max(50)
  .refine((lines) => new Set(lines.map((line) => line.name)).size === lines.length, {
    error: "Each ingredient can appear only once",
  })

const Fields = z.object({
  title: z.string().trim().min(1).max(200),
  source: z.string().trim().max(2000).nullable(),
  content: z.string().max(100_000),
  yield: z.number().positive().nullable(),
  yieldUnit: Unit.nullable(),
  // The whole list, in order. Sending it replaces the recipe's current one.
  ingredients: Ingredients,
})

/** The ids of the photos that stay. Sent, the others go; left out, they all stay. */
const Photos = z.array(z.string()).max(100)

export const CreateRecipe = Fields.partial().required({ title: true })

export const UpdateRecipe = Fields.extend({ images: Photos })
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, { error: "Send at least one field" })

/** A copy of a recipe. Whatever is sent replaces the copied value; the rest stays as it was. */
export const CreateVariation = Fields.extend({ images: Photos }).partial()

export const ListRecipes = z.object({
  q: z.string().trim().max(100).optional(),
  /** Only recipes that are not a variation of another. */
  original: z.stringbool().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export const FindIngredients = z.object({
  q: z.string().trim().toLowerCase().max(80).default(""),
})
