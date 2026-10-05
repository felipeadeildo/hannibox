import { HugeiconsIcon } from "~/components/app/icon"
import {
  Add01Icon,
  GitBranchIcon,
  Logout01Icon,
  Moon02Icon,
  ShoppingBasket01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons"
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { type ReactNode, createContext, use, useCallback, useMemo, useState } from "react"
import { useNavigate, useSubmit } from "react-router"

import { Tile } from "~/components/app/tile"
import { Kbd } from "~/components/ui/kbd"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/components/ui/command"
import { useDebounced } from "~/hooks/use-debounced"
import { useHotkey } from "~/hooks/use-hotkey"
import { useUser } from "~/hooks/use-user"
import { recipeArt } from "~/lib/art"
import { draftStore, emptyDraft, newDraftId, useDrafts } from "~/lib/drafts"
import { shortDate } from "~/lib/format"
import { searchOptions } from "~/lib/recipes"
import { useTheme } from "~/lib/theme"

type Commands = {
  openPalette: () => void
  newRecipe: (title?: string) => void
}

const CommandsContext = createContext<Commands | null>(null)

export function useCommands() {
  const commands = use(CommandsContext)
  if (!commands) throw new Error("useCommands only works inside CommandsProvider")
  return commands
}

export function CommandsProvider({ children }: { children: ReactNode }) {
  const user = useUser()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const newRecipe = useCallback(
    (title = "") => {
      const id = newDraftId()
      if (title) draftStore.put(user.id, id, { ...emptyDraft(), title, touchedAt: Date.now() })
      setOpen(false)
      void navigate(`/recipes/${id}`)
    },
    [navigate, user.id],
  )

  useHotkey("mod+k", (event) => {
    event.preventDefault()
    setOpen((current) => !current)
  })
  useHotkey("n", (event) => {
    event.preventDefault()
    newRecipe()
  })

  const commands = useMemo(() => ({ openPalette: () => setOpen(true), newRecipe }), [newRecipe])

  return (
    <CommandsContext value={commands}>
      {children}
      <Palette open={open} onOpenChange={setOpen} onNew={newRecipe} />
    </CommandsContext>
  )
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-primary">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  )
}

function Palette({
  open,
  onOpenChange,
  onNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNew: (title?: string) => void
}) {
  const user = useUser()
  const navigate = useNavigate()
  const submit = useSubmit()
  const { resolved, setTheme } = useTheme()
  const [text, setText] = useState("")
  const q = text.trim()

  // The server does the matching, so a recipe is found by what it says and not only by its start.
  const found = useQuery({
    ...searchOptions(useDebounced(q, 150)),
    enabled: open,
  })
  const drafts = useDrafts(user.id)
  const recipes = found.data?.items ?? []

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) setText("")
  }
  const run = (action: () => void) => {
    close(false)
    action()
  }
  const nextTheme = resolved === "dark" ? "light" : "dark"

  return (
    <CommandDialog
      open={open}
      onOpenChange={close}
      title="Search or create"
      description="Find a recipe, or start a new one."
      className="top-[8svh] sm:max-w-xl md:top-[18svh]"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={text}
          onValueChange={setText}
          placeholder="Search recipes, or type a name to start one…"
        />
        <CommandList
          className={cn(
            "max-h-[min(24rem,62svh)] transition-opacity",
            found.isFetching && q && "opacity-70",
          )}
        >
          {/* What was found comes first, so Enter opens it. Creating is the default only when nothing matches. */}
          {found.isPending && (
            <CommandGroup heading={q ? "Recipes" : "Recent"} aria-busy aria-label="Loading recipes">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </CommandGroup>
          )}
          {recipes.length > 0 && (
            <CommandGroup heading={q ? "Recipes" : "Recent"}>
              {recipes.map((recipe) => {
                const art = recipeArt(recipe.title)
                return (
                  <CommandItem
                    key={recipe.id}
                    value={recipe.id}
                    onSelect={() => run(() => void navigate(`/recipes/${recipe.id}`))}
                    className="gap-3 py-2 pointer-coarse:py-2.5"
                  >
                    <Tile
                      src={recipe.cover ? `/api/images/${recipe.cover}` : undefined}
                      icon={art.icon}
                      hue={art.hue}
                      label={recipe.title}
                      className="size-9 rounded-lg"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        <Highlight text={recipe.title} query={q} />
                      </span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <HugeiconsIcon
                            icon={ShoppingBasket01Icon}
                            strokeWidth={2}
                            className="size-3.5"
                          />
                          {recipe.ingredients}
                        </span>
                        {recipe.versions > 0 && (
                          <span className="flex items-center gap-1">
                            <HugeiconsIcon
                              icon={GitBranchIcon}
                              strokeWidth={2}
                              className="size-3.5"
                            />
                            {recipe.versions}
                          </span>
                        )}
                        {drafts.has(recipe.id) && (
                          <span className="text-draft-foreground">Edited</span>
                        )}
                      </span>
                    </span>
                    <CommandShortcut className="tabular-nums">
                      {shortDate(recipe.updatedAt)}
                    </CommandShortcut>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
          {found.isSuccess && recipes.length === 0 && !q && (
            <CommandEmpty>No recipes yet. Type a name to start one.</CommandEmpty>
          )}
          {q && (
            <CommandGroup heading="Create">
              <CommandItem
                value="create"
                onSelect={() => run(() => onNew(q))}
                className="gap-3 py-2"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-primary/50 text-primary">
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
                </span>
                <span className="min-w-0 truncate">
                  Start a recipe called “<span className="font-medium">{q}</span>”
                </span>
              </CommandItem>
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem value="new" onSelect={() => run(() => onNew())}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              New recipe
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem value="theme" onSelect={() => run(() => setTheme(nextTheme))}>
              <HugeiconsIcon icon={nextTheme === "dark" ? Moon02Icon : Sun03Icon} strokeWidth={2} />
              Switch to the {nextTheme} theme
            </CommandItem>
            <CommandItem
              value="sign-out"
              onSelect={() =>
                run(() => void submit({ intent: "sign-out" }, { method: "post", action: "/auth" }))
              }
            >
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <p className="hidden items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground md:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> to open
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>esc</Kbd> to close
          </span>
        </p>
      </Command>
    </CommandDialog>
  )
}
