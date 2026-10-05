import { HugeiconsIcon } from "~/components/app/icon"
import {
  AlertCircleIcon,
  Add01Icon,
  Bread01Icon,
  CakeIcon,
  Cancel01Icon,
  ChefHatIcon,
  Delete02Icon,
  EggFriedIcon,
  EggsIcon,
  FileSearchIcon,
  GitBranchIcon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  Search01Icon,
  ShoppingBasket01Icon,
  SoupIcon,
  Undo02Icon,
  WheatIcon,
} from "@hugeicons/core-free-icons"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import {
  type ComponentProps,
  type ReactNode,
  type Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { NavLink, useLocation, useSearchParams } from "react-router"
import { toast } from "sonner"

import { useCommands } from "~/components/app/commands"
import { DeleteRecipeDialog, type DoomedRecipe } from "~/components/app/delete-recipe-dialog"
import { DraftPill } from "~/components/app/draft-pill"
import { EmptyArt } from "~/components/app/empty-art"
import { Tile } from "~/components/app/tile"
import { Button } from "~/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group"
import { Kbd } from "~/components/ui/kbd"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Skeleton } from "~/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useDebounced } from "~/hooks/use-debounced"
import { useHotkey } from "~/hooks/use-hotkey"
import { useSentinel } from "~/hooks/use-sentinel"
import { useUser } from "~/hooks/use-user"
import { recipeArt } from "~/lib/art"
import { type Draft, draftStore, isLocalId, useDrafts } from "~/lib/drafts"
import { shortDate } from "~/lib/format"
import { type RecipeSummary, listOptions, recipeOptions } from "~/lib/recipes"

export function RecipeList({ activeId }: { activeId?: string }) {
  const user = useUser()
  const { newRecipe } = useCommands()
  const { search: current } = useLocation()
  const [params, setParams] = useSearchParams()
  const q = params.get("q") ?? ""
  const original = params.get("show") === "originals"

  const [text, setText] = useState(q)
  const typed = useDebounced(text.trim(), 250)
  useEffect(() => {
    if (typed === q) return
    setParams(
      (existing) => {
        const next = new URLSearchParams(existing)
        if (typed) next.set("q", typed)
        else next.delete("q")
        return next
      },
      { replace: true },
    )
  }, [typed, q, setParams])

  const list = useInfiniteQuery(listOptions({ q, original }))
  // Pages are fetched one after another, so a recipe saved in between can land in two of them. One row each.
  const items = useMemo(() => {
    const byId = new Map<string, RecipeSummary>()
    for (const page of list.data?.pages ?? []) {
      for (const item of page.items) byId.set(item.id, item)
    }
    return [...byId.values()]
  }, [list.data])
  const total = list.data?.pages[0]?.total ?? 0
  // A failed next page leaves `isError` on while the recipes already loaded are still there.
  const failed = list.isError && list.data === undefined

  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    viewport?.scrollTo({ top: 0 })
  }, [viewport, q, original])
  const canLoadMore =
    list.hasNextPage &&
    !list.isFetchingNextPage &&
    !list.isFetchNextPageError &&
    !list.isPlaceholderData
  const sentinel = useSentinel<HTMLDivElement>(
    viewport,
    canLoadMore,
    () => void list.fetchNextPage(),
  )
  const drafts = useDrafts(user.id)
  const [doomed, setDoomed] = useState<DoomedRecipe | null>(null)

  const search = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    return `?${next}`
  }

  useHotkey("/", (event) => {
    event.preventDefault()
    document.getElementById("recipe-search")?.focus()
  })

  // Recipes that exist only on this device. They sit above the list so they are never lost.
  const unsaved = [...drafts]
    .filter(([id]) => isLocalId(id))
    .sort((a, b) => b[1].touchedAt - a[1].touchedAt)

  function body() {
    if (list.isPending) {
      return (
        <div aria-busy aria-label="Loading recipes">
          {Array.from({ length: 7 }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      )
    }
    if (failed) {
      return (
        <EmptyState
          icons={[WheatIcon, AlertCircleIcon, EggsIcon]}
          title="Could not load your recipes"
          description={list.error.message}
          action={
            <Button variant="outline" onClick={() => void list.refetch()}>
              Try again
            </Button>
          }
        />
      )
    }
    if (items.length === 0 && unsaved.length === 0) {
      return q ? (
        <EmptyState
          icons={[SoupIcon, FileSearchIcon, CakeIcon]}
          title={`Nothing matches “${q}”`}
          description="Try another word, or write it down as a new recipe."
          action={
            <Button onClick={() => newRecipe(q)}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              Start “{q}”
            </Button>
          }
        />
      ) : (
        <EmptyState
          icons={[EggFriedIcon, ChefHatIcon, Bread01Icon]}
          title="Your recipe box is empty"
          description="Write down the first one. Every change you make after that is kept as a version, so nothing is lost."
          action={
            <Button onClick={() => newRecipe()}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              Write the first recipe
            </Button>
          }
        />
      )
    }
    return (
      <div
        aria-busy={list.isPlaceholderData}
        className={cn("transition-opacity", list.isPlaceholderData && "opacity-60")}
      >
        <ul className="flex flex-col gap-0.5">
          {items.map((recipe) => (
            <RecipeItem
              key={recipe.id}
              recipe={recipe}
              search={current}
              draft={drafts.get(recipe.id)}
              onDelete={setDoomed}
            />
          ))}
        </ul>
        <ListEnd
          sentinel={sentinel}
          failed={list.isFetchNextPageError}
          fetching={list.isFetchingNextPage}
          hasMore={list.hasNextPage}
          pagesLoaded={list.data?.pages.length ?? 0}
          onLoadMore={() => void list.fetchNextPage()}
        />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3 p-3 pb-1">
        <div className="flex items-center gap-2">
          <InputGroup className="h-10 flex-1 bg-background md:h-9">
            <InputGroupAddon>
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
            </InputGroupAddon>
            <InputGroupInput
              id="recipe-search"
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Search recipes…"
              aria-label="Search recipes"
              autoComplete="off"
              enterKeyHint="search"
              className="[&::-webkit-search-cancel-button]:hidden"
            />
            <InputGroupAddon align="inline-end">
              {text ? (
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => setText("")}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </InputGroupButton>
              ) : (
                <Kbd className="hidden md:inline-flex">/</Kbd>
              )}
            </InputGroupAddon>
          </InputGroup>
          <Button size="lg" className="hidden md:inline-flex" onClick={() => newRecipe()}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            New
            <Kbd className="bg-primary-foreground/15 text-primary-foreground">N</Kbd>
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <ToggleGroup
            value={[original ? "originals" : "all"]}
            onValueChange={(value) =>
              setParams(search({ show: value[0] === "originals" ? "originals" : null }))
            }
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Which recipes to show"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="originals">Originals</ToggleGroupItem>
          </ToggleGroup>
          {list.isSuccess && total > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {total} {total === 1 ? "recipe" : "recipes"}
            </span>
          )}
        </div>
      </div>

      <ScrollArea
        fade="y"
        viewportRef={setViewport}
        className="min-h-0 flex-1"
        // Room above the first row, or the scroll edge cuts the top of its ring.
        viewportClassName="px-2 pt-1 pb-24 md:pb-2"
      >
        {unsaved.length > 0 && (
          <ul className="mb-2 flex flex-col gap-0.5">
            {unsaved.map(([id, draft]) => (
              <DraftItem key={id} id={id} draft={draft} active={id === activeId} />
            ))}
          </ul>
        )}

        {body()}
      </ScrollArea>

      {/* A phone has its thumb at the bottom, so the way to start a recipe is down there. */}
      <Button
        size="icon-lg"
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 size-14 rounded-2xl shadow-lg md:hidden"
        aria-label="New recipe"
        onClick={() => newRecipe()}
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-6" />
      </Button>

      <DeleteRecipeDialog recipe={doomed} openId={activeId} onClose={() => setDoomed(null)} />
    </>
  )
}

const rowClass =
  "grid min-h-[3.75rem] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 pr-12 outline-none transition-colors hover:bg-background/70 focus-visible:ring-3 focus-visible:ring-ring/50"

function DraftItem({ id, draft, active }: { id: string; draft: Draft; active: boolean }) {
  const { search } = useLocation()
  const user = useUser()

  return (
    <li className="group/row relative">
      <NavLink
        to={{ pathname: `/recipes/${id}`, search }}
        className={cn(
          rowClass,
          "border border-dashed border-draft/60 bg-draft-soft/40",
          active && "bg-draft-soft/70",
        )}
      >
        <Tile
          icon={PencilEdit02Icon}
          label=""
          hue={80}
          className="size-11 bg-draft-soft text-draft-foreground"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn("truncate font-medium", !draft.title && "text-muted-foreground")}>
            {draft.title || "Untitled recipe"}
          </span>
          <span className="text-xs text-muted-foreground">Not saved yet, only on this device</span>
        </span>
        <DraftPill />
      </NavLink>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-1 -translate-y-1/2"
        aria-label="Discard draft"
        onClick={() => {
          draftStore.clear(user.id, id)
          toast("Draft discarded", {
            action: { label: "Undo", onClick: () => draftStore.put(user.id, id, draft) },
          })
        }}
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
      </Button>
    </li>
  )
}

function RecipeItem({
  recipe,
  search,
  draft,
  onDelete,
}: {
  recipe: RecipeSummary
  search: string
  draft?: Draft
  onDelete: (recipe: DoomedRecipe) => void
}) {
  const client = useQueryClient()
  const user = useUser()
  const art = recipeArt(recipe.title)
  const warm = () => void client.prefetchQuery(recipeOptions(recipe.id))

  const actions = [
    ...(draft
      ? [
          {
            label: "Discard draft",
            icon: Undo02Icon,
            run: () => {
              draftStore.clear(user.id, recipe.id)
              toast("Draft discarded", {
                action: { label: "Undo", onClick: () => draftStore.put(user.id, recipe.id, draft) },
              })
            },
          },
        ]
      : []),
    { label: "Delete…", icon: Delete02Icon, destructive: true, run: () => onDelete(recipe) },
  ]

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<li className="group/row relative" />}>
        <NavLink
          to={{ pathname: `/recipes/${recipe.id}`, search }}
          onMouseEnter={warm}
          onFocus={warm}
          onTouchStart={warm}
          className={({ isActive, isPending }) =>
            cn(
              rowClass,
              isActive && "bg-background shadow-xs ring-1 ring-foreground/10",
              isPending && "animate-pulse",
            )
          }
        >
          <span className="relative">
            <Tile
              src={recipe.cover ? `/api/images/${recipe.cover}` : undefined}
              icon={art.icon}
              hue={art.hue}
              label={recipe.title}
              className="size-11"
            />
            {recipe.parentId && (
              <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
                <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2.25} className="size-2.5" />
                <span className="sr-only">A version of another recipe</span>
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{recipe.title}</span>
              {draft && <DraftPill>Edited</DraftPill>}
            </span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={ShoppingBasket01Icon} strokeWidth={2} className="size-3.5" />
                {recipe.ingredients}
                <span className="sr-only">ingredients</span>
              </span>
              {recipe.versions > 0 && (
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-3.5" />
                  {recipe.versions}
                  <span className="sr-only">{recipe.versions === 1 ? "version" : "versions"}</span>
                </span>
              )}
            </span>
          </span>
          <span className="self-start pt-0.5 text-xs text-muted-foreground tabular-nums">
            {shortDate(recipe.updatedAt)}
          </span>
        </NavLink>
        {/* There is no right click on a phone, so the same menu has a button. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 bottom-1 pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:data-popup-open:opacity-100"
                aria-label={`Actions for ${recipe.title}`}
              />
            }
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                variant={action.destructive ? "destructive" : "default"}
                onClick={action.run}
              >
                <HugeiconsIcon icon={action.icon} strokeWidth={2} />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {actions.map((action) => (
          <ContextMenuItem
            key={action.label}
            variant={action.destructive ? "destructive" : "default"}
            onClick={action.run}
          >
            <HugeiconsIcon icon={action.icon} strokeWidth={2} />
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function EmptyState({
  icons,
  title,
  description,
  action,
}: {
  icons: ComponentProps<typeof EmptyArt>["icons"]
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyArt icons={icons} />
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{action}</EmptyContent>
    </Empty>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-11 rounded-xl" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

function LoadMoreFailed({ onRetry }: { onRetry: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // It appears below where the list was scrolled to, so it would be out of sight.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" })
  }, [])

  return (
    <div ref={ref} role="alert" className="flex flex-col items-center gap-2 px-4 py-5 text-center">
      <p className="text-sm text-muted-foreground">Couldn’t load more recipes.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

/**
 * What sits under the last recipe loaded. While there is more, it is also the thing that loads it:
 * scrolling it into view does, and so does pressing the button, for anyone who is not scrolling.
 */
function ListEnd({
  sentinel,
  failed,
  fetching,
  hasMore,
  pagesLoaded,
  onLoadMore,
}: {
  sentinel: Ref<HTMLDivElement>
  failed: boolean
  fetching: boolean
  hasMore: boolean
  pagesLoaded: number
  onLoadMore: () => void
}) {
  if (failed) return <LoadMoreFailed onRetry={onLoadMore} />
  if (fetching) {
    return (
      <div aria-busy aria-label="Loading more recipes">
        {Array.from({ length: 3 }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    )
  }
  if (hasMore) {
    return (
      <div ref={sentinel} className="flex justify-center py-3">
        <Button variant="ghost" size="sm" onClick={onLoadMore}>
          Show more
        </Button>
      </div>
    )
  }
  // A short list ends where it ends. Only one that took a few pages to read needs saying so.
  return pagesLoaded > 1 ? (
    <p className="py-4 text-center text-xs text-muted-foreground">That’s every recipe.</p>
  ) : null
}
