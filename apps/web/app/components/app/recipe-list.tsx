import { HugeiconsIcon } from "~/components/app/icon"
import {
  AlertCircleIcon,
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
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
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { useEffect, useState } from "react"
import { Link, NavLink, useLocation, useSearchParams } from "react-router"
import { toast } from "sonner"

import { useCommands } from "~/components/app/commands"
import { DeleteRecipeDialog, type DoomedRecipe } from "~/components/app/delete-recipe-dialog"
import { DraftPill } from "~/components/app/draft-pill"
import { EmptyArt } from "~/components/app/empty-art"
import { Tile } from "~/components/app/tile"
import { Button, buttonVariants } from "~/components/ui/button"
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
import { Pagination, PaginationContent, PaginationItem } from "~/components/ui/pagination"
import { Skeleton } from "~/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useDebounced } from "~/hooks/use-debounced"
import { useHotkey } from "~/hooks/use-hotkey"
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
  const page = Math.max(1, Number(params.get("page")) || 1)

  const [text, setText] = useState(q)
  const typed = useDebounced(text.trim(), 250)
  useEffect(() => {
    if (typed === q) return
    setParams(
      (existing) => {
        const next = new URLSearchParams(existing)
        if (typed) next.set("q", typed)
        else next.delete("q")
        next.delete("page")
        return next
      },
      { replace: true },
    )
  }, [typed, q, setParams])

  const list = useQuery(listOptions({ q, original, page }))
  const drafts = useDrafts(user.id)
  const [doomed, setDoomed] = useState<DoomedRecipe | null>(null)

  /** The query string with these changes, for a link. A null removes the key. */
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
  const { items = [], pages = 1, total = 0 } = list.data ?? {}

  return (
    <>
      <div className="flex flex-col gap-3 p-3 pb-2">
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
              setParams(search({ show: value[0] === "originals" ? "originals" : null, page: null }))
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

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-24 md:pb-2">
        {unsaved.length > 0 && (
          <ul className="mb-2 flex flex-col gap-0.5">
            {unsaved.map(([id, draft]) => (
              <DraftItem key={id} id={id} draft={draft} active={id === activeId} />
            ))}
          </ul>
        )}

        {list.isPending ? (
          <div className="flex flex-col" aria-busy aria-label="Loading recipes">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-11 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyArt icons={[WheatIcon, AlertCircleIcon, EggsIcon]} />
              <EmptyTitle>Could not load your recipes</EmptyTitle>
              <EmptyDescription>
                {list.error.message}. Check your connection and try again.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => void list.refetch()}>
                Try again
              </Button>
            </EmptyContent>
          </Empty>
        ) : items.length === 0 && unsaved.length === 0 ? (
          q ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyArt icons={[SoupIcon, FileSearchIcon, CakeIcon]} />
                <EmptyTitle>Nothing matches “{q}”</EmptyTitle>
                <EmptyDescription>
                  Try another word, or write it down as a new recipe.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => newRecipe(q)}>
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                  Start “{q}”
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyArt icons={[EggFriedIcon, ChefHatIcon, Bread01Icon]} />
                <EmptyTitle>Your recipe box is empty</EmptyTitle>
                <EmptyDescription>
                  Write down the first one. Every change you make after that is kept as a version,
                  so nothing is lost.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => newRecipe()}>
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                  Write the first recipe
                </Button>
              </EmptyContent>
            </Empty>
          )
        ) : (
          // The page that was there stays, dimmed, until the next one arrives.
          <ul
            className={cn(
              "flex flex-col gap-0.5 transition-opacity",
              list.isPlaceholderData && "opacity-60",
            )}
          >
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
        )}
      </div>

      {pages > 1 && (
        <Pager
          page={page}
          pages={pages}
          to={(next) => search({ page: next > 1 ? String(next) : null })}
        />
      )}

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
  // Warm the cache before the click, so the recipe is there when the page is.
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

/** 1 … 4 5 6 … 9: the first, the last, and the pages around this one. */
function windowOf(page: number, pages: number) {
  const shown = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
  const out: (number | "gap")[] = []
  let last = 0
  for (const n of [...shown].sort((a, b) => a - b)) {
    if (n - last > 1) out.push("gap")
    out.push(n)
    last = n
  }
  return out
}

function Pager({ page, pages, to }: { page: number; pages: number; to: (page: number) => string }) {
  const link = (target: number, label: string, children: React.ReactNode, active = false) => (
    <Link
      to={to(target)}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={buttonVariants({ variant: active ? "outline" : "ghost", size: "icon" })}
    >
      {children}
    </Link>
  )
  const edge = (label: string, icon: typeof ArrowLeft01Icon) => (
    <Button variant="ghost" size="icon" disabled aria-label={label}>
      <HugeiconsIcon icon={icon} strokeWidth={2} />
    </Button>
  )

  return (
    <Pagination className="border-t bg-background p-2">
      <PaginationContent>
        <PaginationItem>
          {page > 1
            ? link(
                page - 1,
                "Previous page",
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />,
              )
            : edge("Previous page", ArrowLeft01Icon)}
        </PaginationItem>
        {windowOf(page, pages).map((entry, index) => (
          <PaginationItem key={entry === "gap" ? `gap-${index}` : entry}>
            {entry === "gap" ? (
              <span
                aria-hidden
                className="flex size-8 items-center justify-center text-muted-foreground"
              >
                …
              </span>
            ) : (
              link(
                entry,
                `Page ${entry}`,
                <span className="tabular-nums">{entry}</span>,
                entry === page,
              )
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          {page < pages
            ? link(page + 1, "Next page", <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />)
            : edge("Next page", ArrowRight01Icon)}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
