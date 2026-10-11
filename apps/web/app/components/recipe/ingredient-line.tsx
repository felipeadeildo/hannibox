import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { HugeiconsIcon } from "~/components/app/icon"
import {
  Camera01Icon,
  Cancel01Icon,
  DragDropVerticalIcon,
  ScissorsLineDashedIcon,
} from "@hugeicons/core-free-icons"
import { IngredientName, LIMITS, type Unit, firstProblem } from "@hannibox/shared"
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { AdaptivePanel } from "~/components/app/adaptive-panel"
import { Tile } from "~/components/app/tile"
import { AmountField, UnitPicker } from "~/components/recipe/amount-fields"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useDebounced } from "~/hooks/use-debounced"
import { ingredientArt } from "~/lib/art"
import type { DraftLine } from "~/lib/drafts"
import { checkQuantity, formatAmount, formatQuantity, formatTotal } from "~/lib/quantity"
import { type RecipeDetail, ingredientOptions, useSetIngredientPhoto } from "~/lib/recipes"
import { type Part, type Place, partsText, placeName } from "~/lib/sections"

export type Saved = RecipeDetail["sections"][number]["lines"][number]

const reveal =
  "pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover/line:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:data-popup-open:opacity-100"

export function Line({
  id,
  here,
  line,
  saved,
  scale,
  places,
  elsewhere,
  canSplit,
  fresh = false,
  refusedAt,
  onSave,
  onSplit,
  onRemove,
}: {
  /** What the drag and drop knows the line by. */
  id: string
  /** The key of the section the line is in. */
  here: string
  line: DraftLine
  saved?: Saved
  scale: number
  places: Place[]
  /** The same ingredient in the other sections. */
  elsewhere: Part[]
  /** Whether a new section can start at this line. */
  canSplit: boolean
  /** Just added: the line comes into view, which a capped list would otherwise hide. */
  fresh?: boolean
  /** When the line was last dropped on a section that has it. Each time, it shakes. */
  refusedAt?: number
  /** Keeps the line as changed, moved to the section `to` when that is another one. */
  onSave: (line: DraftLine, to: string) => void
  onSplit: () => void
  onRemove: () => void
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: "line" } })
  const [open, setOpen] = useState(false)
  // The name as it is typed, while the name is a field.
  const [naming, setNaming] = useState<string | null>(null)
  const item = useRef<HTMLLIElement | null>(null)
  const shown = naming === null ? line.name : naming.trim().toLowerCase()

  useEffect(() => {
    if (fresh) item.current?.scrollIntoView({ block: "nearest" })
  }, [fresh])

  // Shakes the line where it stayed. It moves `translate`, not `transform`, which the drag sets.
  useEffect(() => {
    if (refusedAt === undefined || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const shake = item.current?.animate(
      [0, -6, 5, -3, 0].map((x) => ({ translate: `${x}px 0` })),
      { duration: 320, easing: "ease-in-out" },
    )
    return () => shake?.cancel()
  }, [refusedAt])

  return (
    <li
      ref={(node) => {
        setNodeRef(node)
        item.current = node
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/line flex items-center gap-2.5 border-b border-border/60 py-2.5 last:border-b-0",
        // The line under the finger is a copy that follows it; this one marks where it will land.
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move ${line.name}`}
        className={cn(
          "-ml-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing pointer-coarse:size-10",
          reveal,
        )}
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} className="size-4" />
      </button>
      {/* Renamed to another ingredient, the photo no longer applies: it shows that one's icon. */}
      <Photo
        key={shown === line.name ? "own" : shown}
        name={shown || "?"}
        saved={shown === line.name ? saved : undefined}
      />
      <div className="min-w-0 flex-1">
        {naming === null ? (
          <button
            type="button"
            onClick={() => setNaming(line.name)}
            aria-label={`Rename ${line.name}`}
            className="-mx-1.5 block max-w-full truncate rounded-md px-1.5 py-0.5 text-left text-[0.95rem] outline-none first-letter:uppercase hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {line.name}
          </button>
        ) : (
          <LineName
            value={naming}
            problem={renameProblem(shown, line, here, places)}
            taken={places.find((place) => place.key === here)?.names ?? new Set()}
            onChange={setNaming}
            onDone={(name) => {
              setNaming(null)
              if (name !== line.name) onSave({ ...line, name }, here)
            }}
            onCancel={() => setNaming(null)}
          />
        )}
      </div>
      <AdaptivePanel
        open={open}
        onOpenChange={setOpen}
        triggerClassName="min-w-[4.5rem] shrink-0 rounded-lg px-2 py-1.5 text-right font-heading text-sm tabular-nums outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted pointer-coarse:py-2.5"
        triggerLabel={`Change ${line.name}`}
        trigger={formatAmount(line.quantity * scale, line.unit)}
        title={line.name}
        description={scale === 1 ? undefined : `Amounts here are shown ×${scale}.`}
      >
        <LineForm
          here={here}
          line={line}
          saved={saved}
          scale={scale}
          places={places}
          elsewhere={elsewhere}
          canSplit={canSplit}
          onSave={(next, to) => {
            onSave(next, to)
            setOpen(false)
          }}
          onSplit={() => {
            setOpen(false)
            onSplit()
          }}
          onRemove={() => {
            setOpen(false)
            onRemove()
          }}
        />
      </AdaptivePanel>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn("-mr-1 text-muted-foreground", reveal, naming !== null && "invisible")}
        aria-label={`Remove ${line.name}`}
        onClick={onRemove}
      >
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
      </Button>
    </li>
  )
}

/**
 * The name of a line, typed where it shows, to fix a typo without leaving the list. It changes this
 * recipe only. Enter or leaving the field keeps it, and so does tapping one of the user's
 * ingredients. A name that can't be kept puts the old one back.
 */
function LineName({
  value,
  problem,
  taken,
  onChange,
  onDone,
  onCancel,
}: {
  value: string
  problem: string | undefined
  /** The names in the line's section, which it can't take. */
  taken: Set<string>
  onChange: (value: string) => void
  onDone: (name: string) => void
  onCancel: () => void
}) {
  const errorId = useId()
  const name = value.trim().toLowerCase()
  const query = useDebounced(name, 250)
  const suggestions = useQuery({ ...ingredientOptions(query), enabled: query !== "" })
  const options = (suggestions.data?.items ?? [])
    .filter((item) => item.name !== name && !taken.has(item.name))
    .slice(0, 6)

  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel()
          if (event.key !== "Enter") return
          event.preventDefault()
          if (!problem) onDone(name)
        }}
        onBlur={() => {
          if (problem) onCancel()
          else onDone(name)
        }}
        aria-label="Ingredient"
        aria-invalid={problem !== undefined}
        aria-describedby={errorId}
        maxLength={LIMITS.ingredientName}
        enterKeyHint="done"
        autoComplete="off"
        className="h-7 w-full border-b-2 border-primary bg-transparent text-base outline-none md:text-[0.95rem] pointer-coarse:h-9"
      />
      <p id={errorId} className="text-sm text-destructive empty:hidden" aria-live="polite">
        {problem}
      </p>
      {options.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Ingredients you already use"
        >
          {options.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="outline"
              size="sm"
              // Keeps the focus in the field, so its blur does not save before the click picks a name.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onDone(item.name)}
            >
              {item.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The ingredient's picture: its photo, or an icon from its name. The photo is shared by every recipe. */
function Photo({ name, saved, className }: { name: string; saved?: Saved; className?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const set = useSetIngredientPhoto()
  const art = ingredientArt(name)

  const tile = (
    <Tile
      src={saved?.imageId ? `/api/images/${saved.imageId}` : undefined}
      icon={art.known ? art.icon : undefined}
      hue={art.hue}
      label={name}
      className={cn("size-10", className)}
    />
  )
  if (!saved) return <span title="Save the recipe to give this ingredient a photo">{tile}</span>

  return (
    <>
      <button
        type="button"
        className="group/photo relative shrink-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`Change the photo of ${name}`}
        onClick={() => input.current?.click()}
        disabled={set.isPending}
      >
        {tile}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-white opacity-0 transition-opacity group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100",
            set.isPending && "opacity-100",
          )}
        >
          {set.isPending ? (
            <Spinner />
          ) : (
            <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-4" />
          )}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          set.mutate(
            { id: saved.ingredientId, file },
            {
              onError: (error) =>
                toast.error("The photo was not changed", { description: error.message }),
            },
          )
        }}
      />
    </>
  )
}

/** Why the line in section `here` cannot be called `name` in section `to`, or undefined when it can. */
function renameProblem(
  name: string,
  line: DraftLine,
  here: string,
  places: Place[],
  to = here,
): string | undefined {
  const named = IngredientName.safeParse(name)
  if (!named.success) return firstProblem(named.error)
  const place = places.find((each) => each.key === to)
  const itself = to === here && name === line.name
  if (place && !itself && place.names.has(name)) {
    return `${name} is already in ${placeName(place.title, places.length > 1)}.`
  }
  return undefined
}

/** "Also 535 g in Dough. 595 g in all." */
function elsewhereText(line: DraftLine, elsewhere: Part[], scale: number): string {
  return `Also ${partsText(elsewhere, scale)}. ${formatTotal([line, ...elsewhere], scale)} in all.`
}

function LineForm({
  here,
  line,
  saved,
  scale,
  places,
  elsewhere,
  canSplit,
  onSave,
  onSplit,
  onRemove,
}: {
  here: string
  line: DraftLine
  saved?: Saved
  scale: number
  places: Place[]
  elsewhere: Part[]
  canSplit: boolean
  onSave: (line: DraftLine, to: string) => void
  onSplit: () => void
  onRemove: () => void
}) {
  const [name, setName] = useState(line.name)
  const [quantity, setQuantity] = useState(formatQuantity(line.quantity * scale))
  const [unit, setUnit] = useState<Unit | null>(line.unit)
  const [to, setTo] = useState(here)
  const nameErrorId = useId()

  // Checked as it is typed, the way the API will check it. The amount says what is wrong with it
  // under its own field; the name, under this one.
  const amount = checkQuantity(quantity, scale)
  const clean = name.trim().toLowerCase()
  const many = places.length > 1
  // Renamed and moved at once, the line also has to be free of a twin where it is now.
  const nameError =
    renameProblem(clean, line, here, places, to) ??
    (to === here ? undefined : renameProblem(clean, line, here, places))

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (amount.value !== undefined && !nameError) {
          onSave({ name: clean, quantity: amount.value, unit }, to)
        }
      }}
    >
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Ingredient</span>
        <div className="flex items-center gap-2">
          {/* Renamed to another ingredient, the photo no longer applies: it shows that one's icon. */}
          <Photo
            key={clean === line.name ? "own" : clean}
            name={clean || "?"}
            saved={clean === line.name ? saved : undefined}
            className="size-9 pointer-coarse:size-10"
          />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            aria-label="Ingredient"
            aria-invalid={nameError !== undefined}
            aria-describedby={nameErrorId}
          />
        </div>
        <p id={nameErrorId} className="text-sm text-destructive empty:hidden" aria-live="polite">
          {nameError}
        </p>
      </div>
      <AmountField
        label="Amount"
        value={quantity}
        unit={unit}
        scale={scale}
        onChange={setQuantity}
      />
      <UnitPicker value={unit} onChange={setUnit} />
      {many && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Section</span>
          <ToggleGroup
            value={[to]}
            onValueChange={(next) => setTo(next[0] ?? to)}
            variant="outline"
            size="sm"
            spacing={1}
            className="flex-wrap"
            aria-label="Section"
          >
            {places.map((place) => (
              <ToggleGroupItem key={place.key} value={place.key} className="max-w-full">
                <span className="truncate">{place.title || "First section"}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
      {(elsewhere.length > 0 || canSplit) && (
        <div className="flex flex-col items-start gap-2">
          {elsewhere.length > 0 && (
            <p className="text-sm text-muted-foreground">{elsewhereText(line, elsewhere, scale)}</p>
          )}
          {canSplit && (
            <Button type="button" variant="outline" size="sm" onClick={onSplit}>
              <HugeiconsIcon
                icon={ScissorsLineDashedIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Start a section here
            </Button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          Remove
        </Button>
        <Button
          type="submit"
          className="ml-auto min-w-24"
          disabled={amount.value === undefined || nameError !== undefined}
        >
          Done
        </Button>
      </div>
    </form>
  )
}
