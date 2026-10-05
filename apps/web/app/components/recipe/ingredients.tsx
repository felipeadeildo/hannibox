import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { HugeiconsIcon } from "~/components/app/icon"
import {
  Add01Icon,
  AlertCircleIcon,
  Camera01Icon,
  Cancel01Icon,
  DragDropVerticalIcon,
  EggsIcon,
  MilkBottleIcon,
  WheatIcon,
} from "@hugeicons/core-free-icons"
import { useQuery } from "@tanstack/react-query"
import { IngredientLine, IngredientName, LIMITS, type Unit, firstProblem } from "@hannibox/shared"
import { cn } from "cn"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { AdaptivePanel } from "~/components/app/adaptive-panel"
import { EmptyArt } from "~/components/app/empty-art"
import { Tile } from "~/components/app/tile"
import { AmountField, UnitPicker } from "~/components/recipe/amount-fields"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Kbd } from "~/components/ui/kbd"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useDebounced } from "~/hooks/use-debounced"
import { ingredientArt } from "~/lib/art"
import type { DraftLine } from "~/lib/drafts"
import {
  type ParsedLine,
  checkQuantity,
  formatQuantity,
  parseLine,
  unitLabel,
  unscale,
} from "~/lib/quantity"
import { type RecipeDetail, ingredientOptions, useSetIngredientPhoto } from "~/lib/recipes"

/** Changes the list as it is when the change runs, so a late Undo cannot undo more than it should. */
export type EditLines = (change: (lines: DraftLine[]) => DraftLine[]) => void

type Saved = RecipeDetail["ingredients"][number]

/**
 * The list, which you can change at any scale. The scale is a lens: what you see is what you
 * edit, and it is turned back into the recipe's own size when it is kept.
 */
export function Ingredients({
  lines,
  base,
  scale,
  onEdit,
}: {
  lines: DraftLine[]
  base?: RecipeDetail
  scale: number
  onEdit: EditLines
}) {
  const saved = useMemo(
    () => new Map((base?.ingredients ?? []).map((line) => [line.name, line])),
    [base],
  )
  const names = useMemo(() => new Set(lines.map((line) => line.name)), [lines])

  // The handle is the only thing that drags and it does not scroll (`touch-none`), so a few pixels
  // of movement is enough for a finger as much as for a mouse.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    onEdit((current) =>
      arrayMove(
        current,
        current.findIndex((line) => line.name === active.id),
        current.findIndex((line) => line.name === over.id),
      ),
    )
  }

  function remove(line: DraftLine) {
    const index = lines.findIndex((other) => other.name === line.name)
    onEdit((current) => current.filter((other) => other.name !== line.name))
    toast(`Removed ${line.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          onEdit((current) =>
            current.some((other) => other.name === line.name)
              ? current
              : [...current.slice(0, index), line, ...current.slice(index)],
          ),
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-4 pt-5 pb-4 text-center">
          <EmptyArt icons={[WheatIcon, EggsIcon, MilkBottleIcon]} />
          <p className="font-medium">What goes in?</p>
          <p className="max-w-xs text-sm text-pretty text-muted-foreground">
            Type it the way you would say it: “2 cups flour”, “1/2 tsp salt”, “3 eggs”.
          </p>
        </div>
      ) : (
        // Capped on a desk, where a wheel scrolls it. On a phone the page scrolls, and a list that
        // scrolls inside it would catch a thumb that is only trying to get past.
        <ScrollArea fade="y" className="md:max-h-[32rem]">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={lines.map((line) => line.name)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col">
                {lines.map((line) => (
                  <Line
                    key={line.name}
                    line={line}
                    saved={saved.get(line.name)}
                    scale={scale}
                    taken={names}
                    onChange={(next) =>
                      onEdit((current) =>
                        current.map((other) => (other.name === line.name ? next : other)),
                      )
                    }
                    onRemove={() => remove(line)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </ScrollArea>
      )}
      <QuickAdd
        taken={names}
        scale={scale}
        onAdd={(line) =>
          onEdit((current) =>
            current.some((other) => other.name === line.name) ? current : [...current, line],
          )
        }
      />
    </div>
  )
}

const reveal =
  "pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover/line:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:data-popup-open:opacity-100"

function Line({
  line,
  saved,
  scale,
  taken,
  onChange,
  onRemove,
}: {
  line: DraftLine
  saved?: Saved
  scale: number
  taken: Set<string>
  onChange: (line: DraftLine) => void
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
  } = useSortable({ id: line.name })
  const [open, setOpen] = useState(false)
  const amount = line.quantity * scale
  const text = `${formatQuantity(amount)}${line.unit ? ` ${unitLabel(line.unit, amount)}` : ""}`

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/line flex items-center gap-2.5 border-b border-border/60 py-2.5 last:border-b-0",
        isDragging && "relative z-10 rounded-xl border bg-background px-2 shadow-lg select-none",
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
        trigger={text}
        title={line.name}
        description={scale === 1 ? undefined : `Amounts here are shown ×${scale}.`}
      >
        <LineForm
          line={line}
          saved={saved}
          scale={scale}
          taken={taken}
          onSave={(next) => {
            onChange(next)
            setOpen(false)
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

/** Why a line cannot take this name, or undefined when it can. `current` is the one it has. */
function renameProblem(name: string, current: string, taken: Set<string>) {
  const named = IngredientName.safeParse(name)
  if (!named.success) return firstProblem(named.error)
  if (name !== current && taken.has(name)) return `${name} is already in this recipe.`
  return undefined
}

function LineForm({
  line,
  saved,
  scale,
  taken,
  onSave,
  onRemove,
}: {
  line: DraftLine
  saved?: Saved
  scale: number
  taken: Set<string>
  onSave: (line: DraftLine) => void
  onRemove: () => void
}) {
  const [name, setName] = useState(line.name)
  const [quantity, setQuantity] = useState(formatQuantity(line.quantity * scale))
  const [unit, setUnit] = useState<Unit | null>(line.unit)
  const nameErrorId = useId()

  // Checked as it is typed, the way the API will check it. The amount says what is wrong with it
  // under its own field; the name, under this one.
  const amount = checkQuantity(quantity, scale)
  const clean = name.trim().toLowerCase()
  const nameError = renameProblem(clean, line.name, taken)
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (amount.value !== undefined && !nameError)
          onSave({ name: clean, quantity: amount.value, unit })
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

/** The line as the recipe would keep it, checked the way the API will check it, or why it can't be. */
function checkNewLine(
  parsed: ParsedLine,
  scale: number,
  taken: Set<string>,
): { line: DraftLine; problem?: undefined } | { problem: string } {
  const name = parsed.name.toLowerCase()
  if (taken.has(name)) return { problem: `${name} is already in this recipe.` }
  if (taken.size >= LIMITS.ingredients) {
    return { problem: `A recipe takes up to ${LIMITS.ingredients} ingredients.` }
  }
  const checked = IngredientLine.safeParse({ ...parsed, quantity: unscale(parsed.quantity, scale) })
  if (!checked.success) return { problem: firstProblem(checked.error) }
  return { line: { ...checked.data, unit: checked.data.unit ?? null } }
}

const EXAMPLES = ["2 cups flour", "1/2 tsp salt", "3 eggs", "200 g butter", "1 pinch of sugar"]

/**
 * One field to add an ingredient. Type it the way you would say it and it opens up to show what
 * it understood, with a picture, before you add it.
 */
function QuickAdd({
  taken,
  scale,
  onAdd,
}: {
  taken: Set<string>
  scale: number
  onAdd: (line: DraftLine) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState("")
  const [example, setExample] = useState(0)
  const parsed = parseLine(text)
  const name = parsed?.name.toLowerCase() ?? ""
  const art = ingredientArt(name)
  const checked = parsed && checkNewLine(parsed, scale, taken)
  const problem = checked ? checked.problem : undefined

  // While it is empty, the placeholder walks through a few ways to write one.
  useEffect(() => {
    if (text) return
    const timer = setInterval(() => setExample((current) => (current + 1) % EXAMPLES.length), 3200)
    return () => clearInterval(timer)
  }, [text])

  const suggestions = useQuery({
    ...ingredientOptions(useDebounced(name, 150)),
    enabled: name !== "",
  })
  const options = (suggestions.data?.items ?? [])
    .filter((item) => item.name !== name && !taken.has(item.name))
    .slice(0, 12)
  const loadingOptions = name !== "" && suggestions.isFetching && options.length === 0

  function submit() {
    if (!checked || checked.problem !== undefined) return
    onAdd(checked.line)
    setText("")
    input.current?.focus()
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className={cn(
        "overflow-hidden rounded-2xl border bg-muted/40 transition-[background-color,border-color,box-shadow] focus-within:border-primary/60 focus-within:bg-background focus-within:ring-3 focus-within:ring-primary/15",
        parsed && "bg-background",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {parsed ? (
          <Tile
            key={String(art.known) + art.hue}
            icon={art.known ? art.icon : undefined}
            hue={art.hue}
            label={name}
            className="size-9 animate-in duration-200 zoom-in-75"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-primary/50 text-primary">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
          </span>
        )}
        <input
          ref={input}
          id="quick-add"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Add “${EXAMPLES[example]}”…`}
          aria-label="Add an ingredient"
          autoComplete="off"
          enterKeyHint="done"
          className="h-9 min-w-0 flex-1 truncate bg-transparent text-base outline-none placeholder:text-muted-foreground/70 md:text-sm"
        />
        {parsed && !problem && (
          <Button type="submit" size="sm" className="animate-in duration-150 zoom-in-95 fade-in">
            Add
            <Kbd className="hidden bg-primary-foreground/15 text-primary-foreground md:inline-flex">
              ↵
            </Kbd>
          </Button>
        )}
      </div>

      {parsed && (
        <p
          className={cn(
            "flex items-center gap-2 border-t border-dashed px-3 py-2 text-sm",
            problem ? "text-destructive" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {problem ? (
            <>
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 shrink-0" />
              <span className="min-w-0">{problem}</span>
            </>
          ) : (
            <>
              <span className="rounded-md bg-primary/12 px-1.5 py-0.5 font-heading text-xs font-medium text-primary tabular-nums">
                {formatQuantity(parsed.quantity)}
                {parsed.unit ? ` ${unitLabel(parsed.unit, parsed.quantity)}` : ""}
              </span>
              <span className="min-w-0 truncate text-foreground first-letter:uppercase">
                {name}
              </span>
            </>
          )}
        </p>
      )}

      {(options.length > 0 || loadingOptions) && (
        <div
          className="border-t border-dashed px-3 pt-2"
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
                        setText(`${text.slice(0, at)}${item.name}`)
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
