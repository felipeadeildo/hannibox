import { z } from "zod"

import { Unit } from "./units"

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
export type ImageType = (typeof IMAGE_TYPES)[number]
/** The same types, the way a person names them. */
export const IMAGE_TYPE_NAMES = "PNG, JPEG, WebP or GIF"

export function isImageType(type: string): type is ImageType {
  return IMAGE_TYPES.some((allowed) => allowed === type)
}

/** D1 caps a row at 2 MB, and the image shares its row with a few short columns. */
export const MAX_IMAGE_BYTES = 1_900_000

/** How long a field can be, so the forms can stop there and say so before the API refuses it. */
export const LIMITS = {
  title: 200,
  source: 2000,
  content: 100_000,
  ingredientName: 80,
  ingredients: 50,
  /** Past this, a typo is likelier than a recipe: 100 000 g is a hundred kilos. */
  quantity: 100_000,
} as const

/** An amount of something, or how much a recipe makes. */
export const Quantity = z
  .number({ error: "Type an amount, like 2, 1/2 or 1.5" })
  .positive("An amount has to be more than zero")
  .max(LIMITS.quantity, `An amount goes up to ${LIMITS.quantity.toLocaleString("en")}`)

export const IngredientName = z
  .string()
  .trim()
  // Stored lowercase: SQLite folds case for ASCII only.
  .toLowerCase()
  .min(1, "Name the ingredient")
  .max(LIMITS.ingredientName, `An ingredient's name fits in ${LIMITS.ingredientName} characters`)

export const IngredientLine = z.object({
  name: IngredientName,
  quantity: Quantity,
  // Null counts things: "2 eggs".
  unit: Unit.nullish(),
})
export type IngredientLine = z.infer<typeof IngredientLine>

const Ingredients = z
  .array(IngredientLine)
  .max(LIMITS.ingredients, `A recipe takes up to ${LIMITS.ingredients} ingredients`)
  .refine((lines) => new Set(lines.map((line) => line.name)).size === lines.length, {
    error: "Each ingredient can appear only once",
  })

const Fields = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the recipe a name")
    .max(LIMITS.title, `A recipe's name fits in ${LIMITS.title} characters`),
  source: z
    .string()
    .trim()
    .max(LIMITS.source, `Where it is from fits in ${LIMITS.source.toLocaleString("en")} characters`)
    .nullable(),
  content: z
    .string()
    .max(LIMITS.content, `The steps fit in ${LIMITS.content.toLocaleString("en")} characters`),
  yield: Quantity.nullable(),
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
  /** Where the last page ended: the `nextCursor` it came with. Left out, the list starts at the top. */
  cursor: z
    .string()
    .regex(/^\d{1,16}_[\w-]{1,64}$/, "That is not a cursor the API gave out")
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const FindIngredients = z.object({
  q: z.string().trim().toLowerCase().max(80).default(""),
})
