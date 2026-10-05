import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  type Over,
  PointerSensor,
  type UniqueIdentifier,
  closestCenter,
  useSensor,
  useSensors,
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
  Delete02Icon,
  DragDropVerticalIcon,
  EggsIcon,
  MilkBottleIcon,
  MoreHorizontalIcon,
  MoveDownIcon,
  MoveUpIcon,
  PencilEdit02Icon,
  WheatIcon,
} from "@hugeicons/core-free-icons"
import { LIMITS, sameTitle } from "@hannibox/shared"
import { cn } from "cn"
import { type ReactNode, useCallback, useId, useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyArt } from "~/components/app/empty-art"
import { Tile } from "~/components/app/tile"
import { Line, type Saved } from "~/components/recipe/ingredient-line"
import { QuickAdd } from "~/components/recipe/quick-add"
import { Totals } from "~/components/recipe/totals"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ScrollArea } from "~/components/ui/scroll-area"
import { useMedia } from "~/hooks/use-media"
import { ingredientArt } from "~/lib/art"
import type { DraftLine, DraftSection } from "~/lib/drafts"
import { sentence } from "~/lib/format"
import { formatAmount } from "~/lib/quantity"
import type { RecipeDetail } from "~/lib/recipes"
import {
  addLine,
  canMove,
  changeLine,
  insertAt,
  moveSection,
  newSectionKey,
  placeLine,
  placeName,
  placeholderTitle,
  placesOf,
  removeLine,
  removeSection,
  renameSection,
  restoreLine,
  restoreSection,
  splitSection,
  titleProblem,
  totalsOf,
} from "~/lib/sections"

/** Changes the sections as they are when the change runs, so a late Undo cannot undo too much. */
export type EditSections = (change: (sections: DraftSection[]) => DraftSection[]) => void

/** Names to tap for a new section. */
const SUGGESTED = ["Dough", "Filling", "Topping", "Sauce", "Frosting", "Glaze"]

type Row = { id: string; line: DraftLine }
type Column = { key: string; rows: Row[] }
type Dragged = { section: DraftSection } | { row: Row; from: string }

function lineId(key: string, name: string): string {
  return `${key}:${name}`
}

function columnsOf(sections: DraftSection[]): Column[] {
  return sections.map(({ key, lines }) => ({
    key,
    rows: lines.map((line) => ({ id: lineId(key, line.name), line })),
  }))
}

/** Once as a drag starts or crosses sections, twice for a refusal. */
function buzz(pattern: number | number[] = 8): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
  if ("vibrate" in navigator) navigator.vibrate(pattern)
}

const reveal =
  "pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover/head:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:data-popup-open:opacity-100"

/**
 * The ingredients, in sections when the recipe has them, which you can change at any scale. The
 * scale is a lens: what you see is what you edit, and it is turned back into the recipe's own size
 * when it is kept.
 */
export function Ingredients({
  sections,
  base,
  scale,
  onEdit,
}: {
  sections: DraftSection[]
  base?: RecipeDetail
  scale: number
  onEdit: EditSections
}) {
  const wide = useMedia("(min-width: 768px)")
  const [active, setActive] = useState<string>()
  const [naming, setNaming] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [focusAdd, setFocusAdd] = useState(false)
  const [fresh, setFresh] = useState<string>()
  const onFocused = useCallback(() => setFocusAdd(false), [])

  // While a line is dragged, the lines stay here, so it can pass through other sections without
  // the draft changing at every step. The draft changes once, when it is dropped.
  const [columns, setColumns] = useState<Column[] | null>(null)
  const [dragged, setDragged] = useState<Dragged | null>(null)
  // The section a dragged line is over, when it is not the one it came from. `clash` when that
  // section has the ingredient already, and the line cannot go in.
  const [landing, setLanding] = useState<{ key: string; clash: boolean } | null>(null)
  // The line just dropped on a section that has it, and when, so it shakes.
  const [refused, setRefused] = useState<{ id: string; at: number } | null>(null)

  const saved = useMemo(
    () =>
      new Map(
        (base?.sections ?? []).flatMap((section) => section.lines.map((line) => [line.name, line])),
      ),
    [base],
  )
  const sectioned = sections.length > 1 || Boolean(sections[0]?.title)
  const places = placesOf(sections)
  // The field adds to the section last picked, or else to the last one.
  const target = places.find((place) => place.key === active) ?? places.at(-1)
  const view = columns ?? columnsOf(sections)

  const totals = totalsOf(sections)
  const partsOf = new Map(totals.map(({ name, parts }) => [name, parts]))

  /** A new section at the end. With a name, the field moves into it. Without one, it asks for one. */
  function startSection(title: string, lines: DraftLine[] = [], ask = false) {
    const key = newSectionKey()
    onEdit((current) => [...current, { key, title, lines }])
    setActive(key)
    if (ask) setNaming(key)
    else setFocusAdd(true)
  }

  function rename(key: string, title: string, then: "stay" | "add") {
    onEdit((current) => renameSection(current, key, title))
    setNaming(null)
    if (then === "add" && key === target?.key) setFocusAdd(true)
  }

  function remove(section: DraftSection) {
    const index = sections.findIndex((other) => other.key === section.key)
    onEdit((current) => removeSection(current, section.key))
    toast(`Removed ${placeName(section.title, true)}`, {
      description: linesGone(section.lines.length),
      action: {
        label: "Undo",
        onClick: () => onEdit((current) => restoreSection(current, section, index)),
      },
    })
  }

  /** Saves a line edited in its sheet, and moves it to section `to` when that is another one. */
  function saveLine(key: string, name: string, next: DraftLine, to: string) {
    onEdit((current) => {
      const changed = changeLine(current, key, name, next)
      return to === key ? changed : placeLine(changed, key, next.name, to)
    })
  }

  /** Starts a section at line `at` of section `key`, and asks for its name. */
  function splitAt(key: string, at: number) {
    const fresh = newSectionKey()
    onEdit((current) =>
      splitSection(current, key, at, { key: fresh, title: placeholderTitle(current) }),
    )
    setActive(fresh)
    setNaming(fresh)
  }

  function removeFrom(section: DraftSection, line: DraftLine) {
    const index = section.lines.indexOf(line)
    const at = sections.indexOf(section)
    onEdit((current) => removeLine(current, section.key, line.name))
    toast(`Removed ${line.name}`, {
      action: {
        label: "Undo",
        // The first section goes when its last line does, so Undo may have to bring it back.
        onClick: () =>
          onEdit((current) =>
            current.some((other) => other.key === section.key)
              ? restoreLine(current, section.key, index, line)
              : restoreSection(current, { ...section, lines: [line] }, at),
          ),
      },
    })
  }

  // The handle is the only thing that drags and it does not scroll (`touch-none`), so a few pixels
  // of movement is enough for a finger as much as for a mouse.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // A section lands among sections. A line lands on another line, or in a section with no lines.
  const detect: CollisionDetection = (args) => {
    const kind = args.active.data.current?.type
    const droppableContainers = args.droppableContainers.filter((container) => {
      const data = container.data.current
      if (kind === "section") return data?.type === "section"
      return data?.type === "line" || (data?.type === "section" && data.empty === true)
    })
    return closestCenter({ ...args, droppableContainers })
  }

  function onDragStart({ active }: DragStartEvent) {
    buzz()
    const data = active.data.current
    if (data?.type === "section") {
      const section = sections.find((other) => other.key === data.key)
      if (section) setDragged({ section })
      return
    }
    const start = columnsOf(sections)
    setColumns(start)
    const column = start.find((other) => other.rows.some((row) => row.id === active.id))
    const row = column?.rows.find((other) => other.id === active.id)
    // The section it started in. Its row only says where it is now, which changes as it moves.
    if (column && row) setDragged({ row, from: column.key })
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!columns || !dragged || !("row" in dragged)) return
    if (!over) {
      setLanding(null)
      return
    }
    const into = over.data.current?.type === "section" ? over.data.current.key : undefined
    const from = columns.find((column) => column.rows.some((row) => row.id === active.id))
    const to = columns.find((column) =>
      into ? column.key === into : column.rows.some((row) => row.id === over.id),
    )
    if (!from || !to) return
    const { row } = dragged
    const clash = to.key !== from.key && to.rows.some((other) => other.line.name === row.line.name)
    setLanding(to.key === dragged.from && !clash ? null : { key: to.key, clash })
    if (clash || to.key === from.key) return

    // Over a line, it goes before it, or after it when the dragged one is past its middle.
    const moving = active.rect.current.translated
    const below =
      moving !== null && moving.top + moving.height / 2 > over.rect.top + over.rect.height / 2
    const at = into
      ? to.rows.length
      : to.rows.findIndex((other) => other.id === over.id) + (below ? 1 : 0)
    setColumns(
      columns.map((column) => {
        if (column.key === from.key) {
          return { ...column, rows: column.rows.filter((other) => other.id !== active.id) }
        }
        if (column.key === to.key) {
          return { ...column, rows: insertAt(column.rows, at, row) }
        }
        return column
      }),
    )
    buzz()
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (dragged && "section" in dragged && over && over.id !== active.id) {
      const { key } = dragged.section
      const onto = over.data.current?.key
      onEdit((current) => {
        const at = current.findIndex((section) => section.key === onto)
        return at === -1 ? current : moveSection(current, key, at)
      })
    }
    if (dragged && "row" in dragged && columns) {
      const { from, row } = dragged
      const column = columns.find((each) => each.rows.some((other) => other.id === row.id))
      if (column) {
        const at = column.rows.findIndex((other) => other.id === row.id)
        const onto = over ? column.rows.findIndex((other) => other.id === over.id) : -1
        const rows = onto === -1 ? column.rows : arrayMove(column.rows, at, onto)
        const index = rows.findIndex((other) => other.id === row.id)
        onEdit((current) => placeLine(current, from, row.line.name, column.key, index))
        if (landing?.clash) refuse(row.line.name, column.key, landing.key)
      }
    }
    endDrag()
  }

  /** Says why a line stayed out of a section, and shakes it where it stayed. */
  function refuse(name: string, stays: string, wanted: string) {
    const title = sections.find((section) => section.key === wanted)?.title ?? ""
    toast(sentence(`${name} is already in ${placeName(title, true)}.`))
    setRefused({ id: lineId(stays, name), at: Date.now() })
    buzz([12, 60, 12])
  }

  function endDrag() {
    setColumns(null)
    setDragged(null)
    setLanding(null)
  }

  // What a screen reader hears. The ids are internal, so the names come from the sections.
  function spoken(id: UniqueIdentifier): string {
    const text = String(id)
    if (text.startsWith("section:")) return `the section ${sectionSpoken(text.slice(8))}`
    return text.slice(text.indexOf(":") + 1)
  }
  function sectionSpoken(key: string): string {
    const title = sections.find((section) => section.key === key)?.title ?? ""
    return placeName(title, sections.length > 1)
  }
  function placeSpoken(active: UniqueIdentifier, over: Over | null): string {
    if (!over || String(active).startsWith("section:")) return ""
    const data = over.data.current
    if (data?.type === "section") return ` in ${sectionSpoken(data.key)}`
    const column = columns?.find((each) => each.rows.some((row) => row.id === over.id))
    return column ? ` in ${sectionSpoken(column.key)}` : ""
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${spoken(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${spoken(active.id)} is over ${spoken(over.id)}${placeSpoken(active.id, over)}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${spoken(active.id)}${placeSpoken(active.id, over)}.`
        : `Dropped ${spoken(active.id)} where it was.`,
    onDragCancel: ({ active }) => `Cancelled. ${spoken(active.id)} stays where it was.`,
  }

  const quickAdd = (
    <QuickAdd
      bare
      text={text}
      onText={setText}
      target={target ?? { title: "", names: new Set() }}
      sections={sections}
      scale={scale}
      autoFocus={focusAdd}
      onFocused={onFocused}
      onAdd={(line) => {
        onEdit((current) => addLine(current, target?.key, line))
        setFresh(lineId(target?.key ?? "", line.name))
      }}
      onSection={(title) => startSection(title)}
      onSplit={(line) => startSection(placeholderTitle(sections), [line], true)}
    />
  )

  if (sections.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-4 pt-5 pb-4 text-center">
          <EmptyArt icons={[WheatIcon, EggsIcon, MilkBottleIcon]} />
          <p className="font-medium">What goes in?</p>
          <p className="max-w-xs text-sm text-pretty text-muted-foreground">
            Type it the way you would say it: “2 cups flour”, “1/2 tsp salt”, “3 eggs”. A line that
            ends in a colon, like “Dough:”, starts a section.
          </p>
        </div>
        {quickAdd}
      </div>
    )
  }

  const list = (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      collisionDetection={detect}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <SortableContext
        items={sections.map((section) => `section:${section.key}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-3">
          {sections.map((section, index) => {
            const rows = view.find((column) => column.key === section.key)?.rows ?? []
            const lines = (
              <SortableContext
                items={rows.map((row) => row.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col px-2">
                  {rows.map((row, at) => (
                    <Line
                      key={row.id}
                      id={row.id}
                      here={section.key}
                      line={row.line}
                      saved={saved.get(row.line.name)}
                      scale={scale}
                      places={places}
                      elsewhere={(partsOf.get(row.line.name) ?? []).filter(
                        (part) => part.key !== section.key,
                      )}
                      canSplit={at > 0 && sections.length < LIMITS.sections}
                      fresh={row.id === fresh}
                      refusedAt={refused?.id === row.id ? refused.at : undefined}
                      onSave={(next, to) => saveLine(section.key, row.line.name, next, to)}
                      onSplit={() => splitAt(section.key, at)}
                      onRemove={() => removeFrom(section, row.line)}
                    />
                  ))}
                </ul>
              </SortableContext>
            )
            return (
              <Group
                key={section.key}
                section={section}
                sectioned={sectioned}
                movable={canMove(sections, index, -1) || canMove(sections, index, 1)}
                empty={rows.length === 0}
                folded={dragged !== null && "section" in dragged}
                header={
                  naming === section.key ? (
                    <SectionName
                      title={section.title}
                      index={index}
                      sections={sections}
                      onDone={(title, then) => rename(section.key, title, then)}
                      onCancel={() => setNaming(null)}
                    />
                  ) : (
                    <SectionHead
                      section={section}
                      count={section.lines.length}
                      landing={landing?.key === section.key ? landing : undefined}
                      canUp={canMove(sections, index, -1)}
                      canDown={canMove(sections, index, 1)}
                      onRename={() => setNaming(section.key)}
                      onMove={(by) =>
                        onEdit((current) => moveSection(current, section.key, index + by))
                      }
                      onRemove={() => remove(section)}
                    />
                  )
                }
              >
                {/* One list is capped on a desk, where a wheel scrolls it. On a phone the page
                    scrolls, and a list that scrolls inside it would catch a thumb that is only
                    trying to get past. Sections are not capped: each has its own field to add to. */}
                {wide && !sectioned ? (
                  <ScrollArea fade="y" className="max-h-[32rem]">
                    {lines}
                  </ScrollArea>
                ) : (
                  lines
                )}
                {section.key === target?.key ? (
                  quickAdd
                ) : (
                  <AddRow
                    title={section.title}
                    onClick={() => {
                      setActive(section.key)
                      setFocusAdd(true)
                    }}
                  />
                )}
              </Group>
            )
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {dragged && <Ghost dragged={dragged} scale={scale} saved={saved} />}
      </DragOverlay>
    </DndContext>
  )

  return (
    <div className="flex flex-col gap-3">
      {list}
      <div className="flex items-center gap-2 empty:hidden">
        {sections.length < LIMITS.sections && (
          <Button
            variant="outline"
            size="sm"
            className="border-dashed text-muted-foreground hover:text-foreground"
            onClick={() => startSection(placeholderTitle(sections), [], true)}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            New section
          </Button>
        )}
        {/* Worth adding up only when an ingredient goes in more than one section. */}
        {totals.some(({ parts }) => parts.length > 1) && (
          <div className="ml-auto">
            <Totals totals={totals} saved={saved} scale={scale} />
          </div>
        )}
      </div>
    </div>
  )
}

function linesGone(count: number): string | undefined {
  if (count === 0) return undefined
  if (count === 1) return "And its ingredient."
  return `And its ${count} ingredients.`
}

/**
 * One section: its heading, its lines and a way to add to it. It moves as a whole, and while a
 * section is dragged every one of them folds to its heading, so they are short to move past.
 */
function Group({
  section,
  sectioned,
  movable,
  empty,
  folded,
  header,
  children,
}: {
  section: DraftSection
  sectioned: boolean
  movable: boolean
  empty: boolean
  folded: boolean
  header: ReactNode
  children: ReactNode
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `section:${section.key}`,
    data: { type: "section", key: section.key, empty },
    disabled: !movable,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      role={sectioned ? "group" : undefined}
      aria-label={sectioned ? section.title || "First section" : undefined}
      className={cn(
        "flex flex-col rounded-2xl border border-border/70 bg-background transition-colors focus-within:border-primary/50",
        // Folded to its heading, the card keeps a little room so the heading does not sit on its corners.
        folded && "pb-2",
        isDragging && "opacity-40",
      )}
    >
      {sectioned && (
        <div className="group/head sticky top-0 z-10 flex items-start gap-2.5 rounded-t-2xl bg-background px-2 pt-2 max-md:top-[calc(3.5rem+env(safe-area-inset-top))]">
          {movable ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Move ${placeName(section.title, true)}`}
              className={cn(
                "-ml-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing pointer-coarse:size-10",
                reveal,
              )}
            >
              <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} className="size-4" />
            </button>
          ) : (
            <span aria-hidden className="-ml-1 size-8 shrink-0 pointer-coarse:size-10" />
          )}
          <div className="min-w-0 flex-1">{header}</div>
        </div>
      )}
      {!folded && children}
    </div>
  )
}

function SectionHead({
  section,
  count,
  landing,
  canUp,
  canDown,
  onRename,
  onMove,
  onRemove,
}: {
  section: DraftSection
  count: number
  /** Set while a dragged line is over this section. Teal if it can go in, red if it can't. */
  landing?: { clash: boolean }
  canUp: boolean
  canDown: boolean
  onRename: () => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const name = placeName(section.title, true)
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2.5 transition-colors pointer-coarse:h-10",
        landing && (landing.clash ? "text-destructive" : "text-primary"),
      )}
    >
      <h3 className="-mx-1.5 min-w-0">
        <button
          type="button"
          onClick={onRename}
          className="block max-w-full truncate rounded-md px-1.5 py-0.5 text-left font-heading text-[0.95rem] font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {section.title || (
            <span className={cn("font-normal", !landing && "text-muted-foreground")}>
              Name this section
            </span>
          )}
        </button>
      </h3>
      <span className="flex-1" />
      <span className="px-2 font-heading text-xs text-muted-foreground tabular-nums">
        {count}
        <span className="sr-only">{count === 1 ? " ingredient" : " ingredients"}</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More for ${name}`}
              className={cn("-mr-1 text-muted-foreground", reveal)}
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onRename}>
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canUp} onClick={() => onMove(-1)}>
            <HugeiconsIcon icon={MoveUpIcon} strokeWidth={2} />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canDown} onClick={() => onMove(1)}>
            <HugeiconsIcon icon={MoveDownIcon} strokeWidth={2} />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onRemove}>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            Remove section
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * The name of a section, typed where it shows. Enter or a suggestion keeps it and moves on to adding
 * lines; leaving the field keeps it too, and a name that can't be kept puts the old one back.
 */
function SectionName({
  title,
  index,
  sections,
  onDone,
  onCancel,
}: {
  title: string
  index: number
  sections: DraftSection[]
  onDone: (title: string, then: "stay" | "add") => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(title)
  const errorId = useId()
  const problem = titleProblem(value, index, sections)
  const suggestions = SUGGESTED.filter(
    (suggestion) => !sections.some((section) => sameTitle(section.title, suggestion)),
  )

  return (
    <div className="flex flex-col gap-2 pb-1">
      <input
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel()
          if (event.key !== "Enter") return
          event.preventDefault()
          if (!problem) onDone(value, "add")
        }}
        onBlur={() => {
          if (problem) onCancel()
          else onDone(value, "stay")
        }}
        placeholder={index === 0 ? "No name" : "Name this section"}
        aria-label="Section name"
        aria-invalid={problem !== undefined}
        aria-describedby={errorId}
        maxLength={LIMITS.sectionTitle}
        enterKeyHint="done"
        autoComplete="off"
        className="h-8 w-full border-b-2 border-primary bg-transparent font-heading text-[0.95rem] font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground pointer-coarse:h-10"
      />
      <p id={errorId} className="text-sm text-destructive empty:hidden" aria-live="polite">
        {value.trim() === title ? undefined : problem}
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Names to pick">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              // Keeps the focus in the field, so its blur does not save before the click picks a name.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onDone(suggestion, "add")}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

// The last row of a section: the quiet twin of the field in `QuickAdd`, until it is tapped.
function AddRow({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/add flex w-full items-center gap-2.5 rounded-b-2xl border-t border-dashed border-border/70 px-2 py-2.5 text-left text-base text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted/40 md:text-sm"
    >
      <span aria-hidden className="-ml-1 size-8 shrink-0 pointer-coarse:size-10" />
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors group-hover/add:text-primary pointer-coarse:size-10">
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
      </span>
      {title ? `Add to ${title}` : "Add an ingredient"}
    </button>
  )
}

/** What follows the finger or the pointer while something is dragged. */
function Ghost({
  dragged,
  scale,
  saved,
}: {
  dragged: Dragged
  scale: number
  saved: Map<string, Saved>
}) {
  if ("section" in dragged) {
    const { section } = dragged
    return (
      <div className="flex h-11 items-center gap-2 rounded-xl border bg-background px-3 shadow-lg">
        <HugeiconsIcon
          icon={DragDropVerticalIcon}
          strokeWidth={2}
          className="size-4 text-muted-foreground"
        />
        <span className="truncate font-heading text-[0.95rem] font-medium">{section.title}</span>
        <span className="ml-auto font-heading text-xs text-muted-foreground tabular-nums">
          {section.lines.length}
        </span>
      </div>
    )
  }
  const { line } = dragged.row
  const art = ingredientArt(line.name)
  const photo = saved.get(line.name)?.imageId
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-background px-2 py-2.5 shadow-lg">
      <HugeiconsIcon
        icon={DragDropVerticalIcon}
        strokeWidth={2}
        className="size-4 text-muted-foreground"
      />
      <Tile
        src={photo ? `/api/images/${photo}` : undefined}
        icon={art.known ? art.icon : undefined}
        hue={art.hue}
        label={line.name}
      />
      <span className="min-w-0 flex-1 truncate text-[0.95rem] first-letter:uppercase">
        {line.name}
      </span>
      <span className="px-2 font-heading text-sm tabular-nums">
        {formatAmount(line.quantity * scale, line.unit)}
      </span>
    </div>
  )
}
