import type { CreateVariation } from "@hannibox/shared"
import { keepPreviousData, queryOptions, useMutation } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"
import type { z } from "zod"

import { api } from "./api"
import { shrinkImage } from "./image"
import { expectOk, unwrap } from "./query"

export type RecipeDetail = InferResponseType<(typeof api.recipes)[":id"]["$get"], 200>
export type RecipeList = InferResponseType<typeof api.recipes.$get, 200>
export type RecipeSummary = RecipeList["items"][number]
export type TreeData = InferResponseType<(typeof api.recipes)[":id"]["tree"]["$get"], 200>

/** Every field of a recipe, each one optional. */
export type RecipeFields = z.input<typeof CreateVariation>

export const recipeKeys = {
  lists: ["recipes", "list"] as const,
  details: ["recipes", "detail"] as const,
  detail: (id: string) => ["recipes", "detail", id] as const,
  trees: ["recipes", "tree"] as const,
  tree: (id: string) => ["recipes", "tree", id] as const,
}

export type ListFilters = { q: string; original: boolean; page: number }

export const listOptions = (filters: ListFilters) =>
  queryOptions({
    queryKey: [...recipeKeys.lists, filters],
    queryFn: async () =>
      unwrap(
        await api.recipes.$get({
          query: {
            q: filters.q || undefined,
            original: filters.original ? "true" : undefined,
            page: String(filters.page),
          },
        }),
      ),
    // The previous page stays on screen while the next one loads.
    placeholderData: keepPreviousData,
  })

export const recipeOptions = (id: string) =>
  queryOptions({
    queryKey: recipeKeys.detail(id),
    queryFn: async () => unwrap(await api.recipes[":id"].$get({ param: { id } })),
  })

export const treeOptions = (id: string) =>
  queryOptions({
    queryKey: recipeKeys.tree(id),
    queryFn: async () => unwrap(await api.recipes[":id"].tree.$get({ param: { id } })),
  })

export const ingredientOptions = (q: string) =>
  queryOptions({
    queryKey: ["ingredients", q] as const,
    queryFn: async () => unwrap(await api.ingredients.$get({ query: { q } })),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

/** What saving a draft does: a new recipe, a new version under one, or a rewrite of one. */
export type SaveMode =
  | { kind: "create" }
  | { kind: "version"; id: string }
  | { kind: "overwrite"; id: string }

export function useSaveRecipe() {
  return useMutation({
    // The fields travel as JSON, with the draft's new photos beside them as files, so the recipe and
    // its photos are written, or refused, together. The photos get their owner here, and not before.
    mutationFn: async ({
      mode,
      fields,
      photos = [],
    }: {
      mode: SaveMode
      fields: RecipeFields
      photos?: File[]
    }) => {
      const form = { data: JSON.stringify(fields), photos }
      switch (mode.kind) {
        case "create": {
          if (!fields.title) throw new Error("Give the recipe a name first")
          return unwrap(await api.recipes.$post({ form }))
        }
        case "version":
          return unwrap(await api.recipes[":id"].variations.$post({ param: { id: mode.id }, form }))
        case "overwrite":
          return unwrap(await api.recipes[":id"].$patch({ param: { id: mode.id }, form }))
      }
    },
    onSuccess: (saved, _vars, _result, { client }) => {
      client.setQueryData(recipeKeys.detail(saved.id), saved)
      void client.invalidateQueries({ queryKey: recipeKeys.lists })
      void client.invalidateQueries({ queryKey: recipeKeys.trees })
    },
  })
}

export function useDeleteRecipe() {
  return useMutation({
    mutationFn: async (id: string) => expectOk(await api.recipes[":id"].$delete({ param: { id } })),
    onSuccess: (_data, id, _result, { client }) => {
      client.removeQueries({ queryKey: recipeKeys.detail(id) })
      void client.invalidateQueries({ queryKey: recipeKeys.lists })
      void client.invalidateQueries({ queryKey: recipeKeys.trees })
    },
  })
}

/** An ingredient has one photo, shared by every recipe that lists it. */
export function useSetIngredientPhoto() {
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) =>
      unwrap(
        await api.ingredients[":id"].image.$put({
          param: { id },
          form: { file: await shrinkImage(file) },
        }),
      ),
    onSuccess: (_image, _vars, _result, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: recipeKeys.details }),
        client.invalidateQueries({ queryKey: ["ingredients"] }),
      ]),
  })
}
