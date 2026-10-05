import { HugeiconsIcon } from "~/components/app/icon"
import { Add01Icon, AlertCircleIcon, HeadingIcon } from "@hugeicons/core-free-icons"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { IngredientLine, LIMITS, firstProblem } from "@hannibox/shared"
import { cn } from "cn"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { Tile } from "~/components/app/tile"
import { Button } from "~/components/ui/button"
import { Kbd } from "~/components/ui/kbd"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Skeleton } from "~/components/ui/skeleton"
import { useDebounced } from "~/hooks/use-debounced"
import { ingredientArt } from "~/lib/art"
import type { DraftLine, DraftSection } from "~/lib/drafts"
import { type ParsedLine, formatAmount, parseLine, unscale } from "~/lib/quantity"
import { ingredientOptions } from "~/lib/recipes"
import { type Place, lineCount, placeName, titleProblem } from "~/lib/sections"

/** The section a new line goes to. With none yet, a first one starts. */
type Target = Pick<Place, "title" | "names">

/** "Dough:" heads a new section, the way a recipe book heads its lists. */
function parseHeading(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.endsWith(":")) return null
  const title = trimmed.slice(0, -1).trim()
  return title === "" ? null : title
}

/** What the field understood, or why it can't be added. A clash carries the line it refused. */
type Reading =
  | { kind: "empty" }
  | { kind: "line"; line: DraftLine; parsed: ParsedLine }
  | { kind: "heading"; title: string }
  | { kind: "problem"; problem: string; clash?: DraftLine }

/** Reads what was typed the way the API will check it. */
function read(text: string, target: Target, sections: DraftSection[], scale: number): Reading {
  const heading = parseHeading(text)
  if (heading !== null) {
    if (sections.length >= LIMITS.sections) {
      return { kind: "problem", problem: `A recipe takes up to ${LIMITS.sections} sections.` }
    }
    const problem = titleProblem(heading, sections.length, sections)
    return problem ? { kind: "problem", problem } : { kind: "heading", title: heading }
  }

  const parsed = parseLine(text)
  if (!parsed) return { kind: "empty" }
  const checked = IngredientLine.safeParse({ ...parsed, quantity: unscale(parsed.quantity, scale) })
  const name = parsed.name.toLowerCase()
  if (target.names.has(name)) {
    const where = placeName(target.title, sections.length > 1)
    const clash = checked.success ? asLine(checked.data) : undefined
    return { kind: "problem", problem: `${name} is already in ${where}.`, clash }
  }
  if (lineCount(sections) >= LIMITS.ingredients) {
    return { kind: "problem", problem: `A recipe takes up to ${LIMITS.ingredients} ingredients.` }
  }
  if (!checked.success) return { kind: "problem", problem: firstProblem(checked.error) }
  return { kind: "line", line: asLine(checked.data), parsed }
}

function asLine({ name, quantity, unit }: IngredientLine): DraftLine {
  return { name, quantity, unit: unit ?? null }
}

const EXAMPLES = [
  "Add “2 cups flour”…",
  "Add “1/2 tsp salt”…",
  "Add “3 eggs”…",
  "Start a section with “Filling:”…",
  "Add “200 g butter”…",
  "Add “1 pinch of sugar”…",
]

/**
 * One field to add an ingredient. Type it the way you would say it and it opens up to show what it
 * understood, with a picture, before you add it. A line that ends in a colon starts a section.
 */
// In a section's card the rows under the field start where the pictures of the lines do.
const ROWS = "pr-3 pl-[2.875rem] pointer-coarse:pl-[3.375rem]"

export function QuickAdd({
  bare = false,
  text,
  onText,
  target,
  sections,
  scale,
  autoFocus,
  onFocused,
  onAdd,
  onSection,
  onSplit,
}: {
  /** As the last row of a section's card, with no box of its own. */
  bare?: boolean
  text: string
  onText: (text: string) => void
  target: Target
  sections: DraftSection[]
  scale: number
  /** Takes the focus when it shows up under another section, so the keyboard stays up. */
  autoFocus: boolean
  onFocused: () => void
  onAdd: (line: DraftLine) => void
  onSection: (title: string) => void
  /** Starts a new section with a line this one already has. */
  onSplit: (line: DraftLine) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [example, setExample] = useState(0)
  const reading = read(text, target, sections, scale)
  const heading = parseHeading(text) !== null
  const name = heading ? "" : (parseLine(text)?.name.toLowerCase() ?? "")
  const room = sections.length < LIMITS.sections && lineCount(sections) < LIMITS.ingredients
  const split = reading.kind === "problem" && room ? reading.clash : undefined

  // A layout effect moves the focus while the key press that moved the field is still going on, so
  // a phone keeps its keyboard up.
  useLayoutEffect(() => {
    if (!autoFocus) return
    input.current?.focus()
    onFocused()
  }, [autoFocus, onFocused])

  // While it is empty, the placeholder walks through a few ways to write one.
  useEffect(() => {
    if (text) return
    const timer = setInterval(() => setExample((current) => (current + 1) % EXAMPLES.length), 3200)
    return () => clearInterval(timer)
  }, [text])

  const query = useDebounced(name, 250)
  // The last answer stays up while the next one loads, so the chips do not blink at every letter.
  const suggestions = useQuery({
    ...ingredientOptions(query),
    enabled: query !== "",
    placeholderData: keepPreviousData,
  })
  // Nothing typed, nothing to suggest, even with an earlier answer still in the cache.
  const options =
    name === ""
      ? []
      : (suggestions.data?.items ?? [])
          .filter((item) => item.name !== name && !target.names.has(item.name))
          .slice(0, 12)
  const loadingOptions = name !== "" && suggestions.isPending && options.length === 0

  function submit() {
    switch (reading.kind) {
      case "heading":
        onSection(reading.title)
        break
      case "line":
        onAdd(reading.line)
        break
      default:
        return
    }
    onText("")
    input.current?.focus()
  }

  const ready = reading.kind === "line" || reading.kind === "heading"

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className={cn(
        bare
          ? "rounded-b-2xl border-t border-dashed border-border/70"
          : "overflow-hidden rounded-2xl border bg-muted/40 transition-[background-color,border-color,box-shadow] focus-within:border-primary/60 focus-within:bg-background focus-within:ring-3 focus-within:ring-primary/15",
        !bare && reading.kind !== "empty" && "bg-background",
      )}
    >
      <div className={cn("flex items-center py-2.5", bare ? "gap-2.5 px-2" : "gap-3 px-3")}>
        {bare && <span aria-hidden className="-ml-1 size-8 shrink-0 pointer-coarse:size-10" />}
        <Sign heading={heading} name={name} />
        <input
          ref={input}
          id="quick-add"
          value={text}
          onChange={(event) => onText(event.target.value)}
          placeholder={EXAMPLES[example]}
          aria-label={target.title ? `Add an ingredient to ${target.title}` : "Add an ingredient"}
          autoComplete="off"
          enterKeyHint="done"
          className="h-9 min-w-0 flex-1 truncate bg-transparent text-base outline-none placeholder:text-muted-foreground/70 md:text-sm pointer-coarse:h-10"
        />
        {ready && (
          <Button type="submit" size="sm" className="animate-in duration-150 zoom-in-95 fade-in">
            Add
            <Kbd className="hidden bg-primary-foreground/15 text-primary-foreground md:inline-flex">
              ↵
            </Kbd>
          </Button>
        )}
      </div>

      {reading.kind !== "empty" && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-dashed py-2 text-sm",
            bare ? ROWS : "px-3",
            reading.kind === "problem" ? "text-destructive" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          <Understood reading={reading} />
          {split && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-foreground"
              onClick={() => {
                onSplit(split)
                onText("")
              }}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              Start a new section
            </Button>
          )}
        </div>
      )}

      {(options.length > 0 || loadingOptions) && (
        <div
          className={cn("border-t border-dashed pt-2", bare ? ROWS : "px-3")}
          role="group"
          aria-label="Ingredients you already use"
        >
          <ScrollArea orientation="horizontal" fade="x">
            <div className="flex gap-1.5 pb-2.5" aria-busy={loadingOptions}>
              {loadingOptions
                ? Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-lg pointer-coarse:h-9" />
                  ))
                : options.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        // Keep the amount and the unit, and swap in the name that was suggested.
                        const at = text.toLowerCase().lastIndexOf(name)
                        onText(`${text.slice(0, at)}${item.name}`)
                        input.current?.focus()
                      }}
                    >
                      {item.name}
                    </Button>
                  ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </form>
  )
}

/** The square at the start of the field: a plus while it is empty, then what it is adding. */
function Sign({ heading, name }: { heading: boolean; name: string }) {
  if (heading) {
    return (
      <span className="flex size-9 shrink-0 animate-in items-center justify-center rounded-xl bg-primary/12 text-primary duration-200 zoom-in-75 pointer-coarse:size-10">
        <HugeiconsIcon icon={HeadingIcon} strokeWidth={2} className="size-4" />
      </span>
    )
  }
  if (name === "") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-primary/50 text-primary pointer-coarse:size-10">
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
      </span>
    )
  }
  const art = ingredientArt(name)
  return (
    <Tile
      key={String(art.known) + art.hue}
      icon={art.known ? art.icon : undefined}
      hue={art.hue}
      label={name}
      className="size-9 animate-in duration-200 zoom-in-75 pointer-coarse:size-10"
    />
  )
}

/** The row under the field that says what will be added, or what is wrong with it. */
function Understood({ reading }: { reading: Reading }) {
  switch (reading.kind) {
    case "problem":
      return (
        <>
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 first-letter:uppercase">{reading.problem}</span>
        </>
      )
    case "heading":
      return (
        <>
          <span className="rounded-md bg-primary/12 px-1.5 py-0.5 text-xs font-medium text-primary">
            New section
          </span>
          <span className="min-w-0 truncate font-heading text-foreground">{reading.title}</span>
        </>
      )
    case "line":
      return (
        <>
          <span className="rounded-md bg-primary/12 px-1.5 py-0.5 font-heading text-xs font-medium text-primary tabular-nums">
            {formatAmount(reading.parsed.quantity, reading.parsed.unit)}
          </span>
          <span className="min-w-0 truncate text-foreground first-letter:uppercase">
            {reading.line.name}
          </span>
        </>
      )
    case "empty":
      return null
  }
}
