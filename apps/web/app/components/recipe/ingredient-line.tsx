import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { HugeiconsIcon } from "~/components/app/icon"
import {
  Camera01Icon,
  Cancel01Icon,
  DragDropVerticalIcon,
  ScissorsLineDashedIcon,
} from "@hugeicons/core-free-icons"
import { IngredientName, type Unit, firstProblem } from "@hannibox/shared"
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
import { ingredientArt } from "~/lib/art"
import type { DraftLine } from "~/lib/drafts"
import { checkQuantity, formatAmount, formatQuantity, formatTotal } from "~/lib/quantity"
import { type RecipeDetail, useSetIngredientPhoto } from "~/lib/recipes"
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
  const item = useRef<HTMLLIElement | null>(null)

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
      <Photo name={line.name} saved={saved} />
      <span className="min-w-0 flex-1 truncate text-[0.95rem] first-letter:uppercase">
        {line.name}
      </span>
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
        className={cn("-mr-1 text-muted-foreground", reveal)}
        aria-label={`Remove ${line.name}`}
        onClick={onRemove}
      >
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
      </Button>
    </li>
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

/** Why the line cannot be called `name` in `place`, or undefined when it can. */
function renameProblem(
  name: string,
  line: DraftLine,
  place: Place | undefined,
  here: string,
  many: boolean,
): string | undefined {
  const named = IngredientName.safeParse(name)
  if (!named.success) return firstProblem(named.error)
  const itself = place?.key === here && name === line.name
  if (place && !itself && place.names.has(name)) {
    return `${name} is already in ${placeName(place.title, many)}.`
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
  const placeOf = (key: string) => places.find((place) => place.key === key)
  // Renamed and moved at once, the line also has to be free of a twin where it is now.
  const nameError =
    renameProblem(clean, line, placeOf(to), here, many) ??
    (to === here ? undefined : renameProblem(clean, line, placeOf(here), here, many))

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
