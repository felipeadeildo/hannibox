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
  sections: 12,
  sectionTitle: 60,
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

export const SectionTitle = z
  .string()
  .trim()
  .min(1, "Name the section")
  .max(LIMITS.sectionTitle, `A section's name fits in ${LIMITS.sectionTitle} characters`)

/** "Dough" and "dough" are the same section. */
export function sameTitle(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

export const Section = z.object({
  // Null for a list that starts without a heading, which only the first section can do.
  title: SectionTitle.nullable(),
  lines: z.array(IngredientLine).superRefine((lines, ctx) => {
    const seen = new Set<string>()
    for (const [index, { name }] of lines.entries()) {
      if (seen.has(name)) {
        ctx.addIssue({ code: "custom", message: `${name} is in one section twice`, path: [index] })
      }
      seen.add(name)
    }
  }),
})
export type Section = z.infer<typeof Section>

const Sections = z
  .array(Section)
  .max(LIMITS.sections, `A recipe takes up to ${LIMITS.sections} sections`)
  .superRefine((sections, ctx) => {
    const lines = sections.reduce((sum, section) => sum + section.lines.length, 0)
    if (lines > LIMITS.ingredients) {
      ctx.addIssue({
        code: "custom",
        message: `A recipe takes up to ${LIMITS.ingredients} ingredient lines, all sections together`,
      })
    }
    const seen = new Set<string>()
    for (const [index, { title }] of sections.entries()) {
      const path = [index, "title"]
      if (title === null) {
        if (index > 0) {
          ctx.addIssue({
            code: "custom",
            message: "Only the first section can go without a name",
            path,
          })
        }
        continue
      }
      // "Dough" and "dough" are the same section.
      if (seen.has(title.toLowerCase())) {
        ctx.addIssue({ code: "custom", message: `There are two sections called ${title}`, path })
      }
      seen.add(title.toLowerCase())
    }
  })

// A field the API does not know is refused, not dropped. Otherwise a tab left open from before a
// change, like `ingredients` turning into `sections`, would save a recipe without what it sent.
const Fields = z.strictObject(
  {
    title: z
      .string()
      .trim()
      .min(1, "Give the recipe a name")
      .max(LIMITS.title, `A recipe's name fits in ${LIMITS.title} characters`),
    source: z
      .string()
      .trim()
      .max(
        LIMITS.source,
        `Where it is from fits in ${LIMITS.source.toLocaleString("en")} characters`,
      )
      .nullable(),
    content: z
      .string()
      .max(LIMITS.content, `The steps fit in ${LIMITS.content.toLocaleString("en")} characters`),
    yield: Quantity.nullable(),
    yieldUnit: Unit.nullable(),
    // Every section and its lines, in order. Sending them replaces the recipe's current ones.
    sections: Sections,
  },
  {
    error: (issue) =>
      issue.code === "unrecognized_keys"
        ? "This page is out of date. Reload it and try again."
        : undefined,
  },
)

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
