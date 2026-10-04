import { UNITS } from "@hannibox/shared"
import { relations, sql } from "drizzle-orm"
import {
  type AnySQLiteColumn,
  check,
  customType,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

import { user } from "./auth"

// ! Ids are made by the app, not here: D1 only has `db.batch`, so a recipe and its
// ! ingredients go in together and the ids must be known before the insert.

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull()

// D1 hands a BLOB back as a plain array of byte values, so normalize it to bytes.
const bytes = customType<{ data: Uint8Array; driverData: Uint8Array | number[] }>({
  dataType: () => "blob",
  fromDriver: (value) => Uint8Array.from(value),
})

export const recipe = sqliteTable(
  "recipe",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The recipe this one was varied from. Null for the original. Deleting a recipe that
    // still has variations is refused, but with "no action" and not "restrict": restrict
    // fires row by row and would also block the cascade that deletes a user's whole tree.
    parentId: text("parent_id").references((): AnySQLiteColumn => recipe.id, {
      onDelete: "no action",
    }),
    title: text("title").notNull(),
    source: text("source"),
    // Markdown: the steps, with images by URL.
    content: text("content").notNull().default(""),
    yield: real("yield"),
    yieldUnit: text("yield_unit", { enum: UNITS }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => [
    index("recipe_parent_id_idx").on(table.parentId),
    index("recipe_user_id_updated_at_idx").on(table.userId, table.updatedAt),
  ],
)

// Shared by every user. The app stores `name` trimmed and lowercase, because SQLite
// folds case for ASCII only and "Óleo" must not sit next to "óleo".
export const ingredient = sqliteTable("ingredient", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
})

// A null unit counts things: "2 eggs".
export const recipeIngredient = sqliteTable(
  "recipe_ingredient",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredient.id, { onDelete: "restrict" }),
    quantity: real("quantity").notNull(),
    unit: text("unit", { enum: UNITS }),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.ingredientId] }),
    index("recipe_ingredient_ingredient_id_idx").on(table.ingredientId),
  ],
)

// D1 caps a row at 2 MB, so the app resizes before it stores.
export const image = sqliteTable(
  "image",
  {
    id: text("id").primaryKey(),
    content: bytes("content").notNull(),
    mimeType: text("mime_type").notNull(),
    recipeId: text("recipe_id").references(() => recipe.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id").references(() => ingredient.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("image_recipe_id_idx").on(table.recipeId),
    index("image_ingredient_id_idx").on(table.ingredientId),
    // Exactly one owner.
    check("image_owner_check", sql`(${table.recipeId} is null) <> (${table.ingredientId} is null)`),
  ],
)

export const recipeRelations = relations(recipe, ({ one, many }) => ({
  user: one(user, { fields: [recipe.userId], references: [user.id] }),
  parent: one(recipe, {
    fields: [recipe.parentId],
    references: [recipe.id],
    relationName: "variations",
  }),
  variations: many(recipe, { relationName: "variations" }),
  ingredients: many(recipeIngredient),
  images: many(image),
}))

export const ingredientRelations = relations(ingredient, ({ many }) => ({
  recipes: many(recipeIngredient),
  images: many(image),
}))

export const recipeIngredientRelations = relations(recipeIngredient, ({ one }) => ({
  recipe: one(recipe, { fields: [recipeIngredient.recipeId], references: [recipe.id] }),
  ingredient: one(ingredient, {
    fields: [recipeIngredient.ingredientId],
    references: [ingredient.id],
  }),
}))

export const imageRelations = relations(image, ({ one }) => ({
  recipe: one(recipe, { fields: [image.recipeId], references: [recipe.id] }),
  ingredient: one(ingredient, { fields: [image.ingredientId], references: [ingredient.id] }),
}))
