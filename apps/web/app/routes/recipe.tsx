import { HugeiconsIcon } from "~/components/app/icon"
import { CookBookIcon } from "@hugeicons/core-free-icons"
import { useQuery } from "@tanstack/react-query"
import { Link, type ShouldRevalidateFunctionArgs, isRouteErrorResponse } from "react-router"

import { RecipeEditor } from "~/components/recipe/editor"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Skeleton } from "~/components/ui/skeleton"
import { isLocalId } from "~/lib/drafts"
import { ApiFailure, messageOf, queryClient } from "~/lib/query"
import { recipeOptions } from "~/lib/recipes"

import type { Route } from "./+types/recipe"

// Puts the recipe in the cache before the page opens, so it never shows up half-empty.
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (isLocalId(params.id)) return { title: null }
  try {
    const recipe = await queryClient.ensureQueryData({
      ...recipeOptions(params.id),
      revalidateIfStale: true,
    })
    return { title: recipe.title }
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 404) {
      throw new Response("Recipe not found", { status: 404 })
    }
    throw error
  }
}

// What the search box does to the URL is not a reason to look the recipe up again.
export function shouldRevalidate({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) {
  return currentParams.id !== nextParams.id
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.title ?? "New recipe" }]
}

export default function RecipeRoute({ params }: Route.ComponentProps) {
  return isLocalId(params.id) ? (
    <RecipeEditor key={params.id} id={params.id} />
  ) : (
    <SavedRecipe key={params.id} id={params.id} />
  )
}

function SavedRecipe({ id }: { id: string }) {
  const { data } = useQuery(recipeOptions(id))
  return data ? <RecipeEditor id={id} base={data} /> : <RecipeSkeleton />
}

function RecipeSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6 md:px-8 md:pt-8">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  )
}

// Inside the panel, so the list stays where it is.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const gone = isRouteErrorResponse(error) && error.status === 404

  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={CookBookIcon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>{gone ? "This recipe is not here" : "Could not open this recipe"}</EmptyTitle>
        <EmptyDescription>
          {gone ? "It was deleted, or it belongs to another account." : messageOf(error)}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          Back to recipes
        </Button>
      </EmptyContent>
    </Empty>
  )
}
