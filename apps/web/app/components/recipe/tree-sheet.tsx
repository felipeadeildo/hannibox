import { HugeiconsIcon } from "~/components/app/icon"
import { Add01Icon, GitBranchIcon } from "@hugeicons/core-free-icons"
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useMemo, useState } from "react"
import { Link } from "react-router"

import { DraftPill } from "~/components/app/draft-pill"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card"
import { ScrollArea } from "~/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { Skeleton } from "~/components/ui/skeleton"
import { useMedia } from "~/hooks/use-media"
import { useUser } from "~/hooks/use-user"
import { isLocalId, useDrafts } from "~/lib/drafts"
import { longDate, shortDate } from "~/lib/format"
import { recipeOptions, type TreeData } from "~/lib/recipes"
import { type Row, layoutTree, lineageOf } from "~/lib/tree"

const ROW = 64
const INDENT = 24
const PAD = 24
const CURVE = 14

/** The versions of a recipe as a tree, with the one you are on lit from the original down to it. */
export function TreeSheet({
  open,
  onOpenChange,
  currentId,
  tree,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentId: string
  tree: TreeData | undefined
}) {
  const wide = useMedia("(min-width: 768px)")
  const user = useUser()
  const drafts = useDrafts(user.id)

  const rows = useMemo(() => {
    if (!tree) return []
    const titles = new Map(
      [...drafts].filter(([id]) => !isLocalId(id)).map(([id, draft]) => [id, draft.title]),
    )
    return layoutTree(tree.nodes, tree.rootId, titles, currentId)
  }, [tree, drafts, currentId])
  const lit = useMemo(
    () => new Set(tree ? lineageOf(tree.nodes, currentId) : []),
    [tree, currentId],
  )
  const versions = tree?.nodes.length ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={cn("gap-0", wide ? "w-full sm:max-w-md" : "max-h-[88svh] rounded-t-3xl")}
      >
        {!wide && <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted" />}
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={GitBranchIcon}
              strokeWidth={2}
              className="size-5 text-muted-foreground"
            />
            Versions
          </SheetTitle>
          <SheetDescription>
            {versions > 1
              ? `${versions} versions of this recipe. Open one to cook it or to change it.`
              : "Every time you save a change, it becomes a version you can come back to."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {tree ? (
            <Graph
              rows={rows}
              lit={lit}
              currentId={currentId}
              hasDraft={drafts.has(currentId)}
              onOpen={() => onOpenChange(false)}
              onStartEditing={() => {
                onOpenChange(false)
                setTimeout(() => document.getElementById("recipe-content")?.focus(), 250)
              }}
            />
          ) : (
            <div className="flex flex-col gap-3 p-4" aria-busy aria-label="Loading versions">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" style={{ marginLeft: i * 18 }} />
              ))}
            </div>
          )}
        </ScrollArea>

        <ul className="flex items-center gap-4 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/50" /> saved
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary" /> you are here
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-draft" /> draft
          </li>
        </ul>
      </SheetContent>
    </Sheet>
  )
}

function Graph({
  rows,
  lit,
  currentId,
  hasDraft,
  onOpen,
  onStartEditing,
}: {
  rows: Row[]
  lit: Set<string>
  currentId: string
  hasDraft: boolean
  onOpen: () => void
  onStartEditing: () => void
}) {
  const x = (depth: number) => PAD + depth * INDENT
  const y = (index: number) => index * ROW + ROW / 2

  // Each version draws only its own stretch of the line: from the sibling above it, or from its
  // parent, down to itself. That keeps a draft at the end from colouring the whole trunk.
  const links = rows
    .map((row, index) => {
      if (row.parent === null) return null
      let from = row.parent
      for (let above = index - 1; above > row.parent; above--) {
        if (rows[above]?.parent === row.parent) {
          from = above
          break
        }
      }
      return { row, index, from }
    })
    .filter((link) => link !== null)
    // The lines the path lights up go last, so they are drawn over the grey ones.
    .sort((a, b) => Number(lit.has(a.row.id)) - Number(lit.has(b.row.id)))

  return (
    <div className="relative my-2" style={{ height: rows.length * ROW }}>
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        {links.map(({ row, index, from: start }) => {
          const parent = rows[row.parent ?? 0]
          if (!parent) return null
          const x0 = x(parent.depth)
          // From a sibling, the run starts a curve above its centre, where that sibling's own line leaves the trunk.
          const startY = start === row.parent ? y(start) : y(start) - CURVE
          const to = { x: x(row.depth), y: y(index) }
          const on = lit.has(row.id) && lit.has(parent.id)
          return (
            <path
              key={row.id}
              d={`M ${x0} ${startY} V ${to.y - CURVE} Q ${x0} ${to.y} ${x0 + CURVE} ${to.y} H ${to.x}`}
              fill="none"
              strokeWidth={on ? 2.5 : 2}
              strokeLinecap="round"
              strokeDasharray={row.kind === "saved" ? undefined : "2 6"}
              className={cn(
                row.kind === "draft"
                  ? "stroke-draft"
                  : on
                    ? "stroke-primary"
                    : "stroke-muted-foreground/45",
              )}
            />
          )
        })}
      </svg>
      {rows.map((row, index) => (
        <Node
          key={row.id}
          row={row}
          top={index * ROW}
          x={x(row.depth)}
          current={row.id === currentId}
          lit={lit.has(row.id)}
          draftHere={row.id === currentId && hasDraft}
          onOpen={onOpen}
          onStartEditing={onStartEditing}
        />
      ))}
    </div>
  )
}

const linkClass =
  "absolute right-3 flex items-center rounded-xl px-3 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"

function Node({
  row,
  top,
  x,
  current,
  lit,
  draftHere,
  onOpen,
  onStartEditing,
}: {
  row: Row
  top: number
  x: number
  current: boolean
  lit: boolean
  draftHere: boolean
  onOpen: () => void
  onStartEditing: () => void
}) {
  const [peek, setPeek] = useState(false)
  const placement = { top, height: ROW, left: x + 20 }
  // A draft belongs to the version it hangs from, and that is where it opens.
  const id = row.id.replace(/^(draft|hint):/, "")

  const dot = (
    <span
      aria-hidden
      className={cn(
        "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full",
        row.kind === "draft" &&
          "size-3.5 border-[3px] border-draft bg-background ring-2 ring-background",
        row.kind === "hint" &&
          "size-3 border-2 border-dashed border-muted-foreground/60 bg-background ring-2 ring-background",
        row.kind === "saved" &&
          (current
            ? "size-4 bg-primary ring-4 ring-primary/25"
            : lit
              ? "size-3 bg-primary ring-2 ring-background"
              : "size-3 bg-muted-foreground/60 ring-2 ring-background"),
      )}
      style={{ left: x, top: top + ROW / 2 }}
    />
  )

  if (row.kind === "hint") {
    return (
      <>
        {dot}
        <button
          type="button"
          onClick={onStartEditing}
          className={cn(linkClass, "gap-3")}
          style={placement}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">Your next version grows here</span>
            <span className="text-xs text-muted-foreground">Change this recipe, then save it.</span>
          </span>
        </button>
      </>
    )
  }

  const link = (
    <Link
      to={`/recipes/${id}`}
      onClick={onOpen}
      aria-current={current && row.kind === "saved" ? "true" : undefined}
      className={cn(linkClass, "gap-3")}
      style={placement}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "truncate",
              current && row.kind === "saved" ? "font-semibold" : "font-medium",
            )}
          >
            {row.title || "Untitled"}
          </span>
          {current && row.kind === "saved" && (
            <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">
              You are here
            </span>
          )}
          {row.kind === "draft" && <DraftPill />}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {row.kind === "draft" ? (
            <span>Not saved, only on this device</span>
          ) : (
            <>
              {row.depth === 0 && <span>Original</span>}
              {row.createdAt && (
                <span className="tabular-nums" title={longDate(row.createdAt)}>
                  {shortDate(row.createdAt)}
                </span>
              )}
              {row.versions > 0 && (
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-3.5" />
                  {row.versions} {row.versions === 1 ? "version" : "versions"}
                </span>
              )}
              {draftHere && <span className="text-draft-foreground">Edited</span>}
            </>
          )}
        </span>
      </span>
    </Link>
  )

  return (
    <>
      {dot}
      {row.kind === "draft" ? (
        link
      ) : (
        <HoverCard open={peek} onOpenChange={setPeek}>
          <HoverCardTrigger delay={350} render={link} />
          <HoverCardContent side="left" align="start" className="w-72">
            <Preview id={row.id} enabled={peek} />
          </HoverCardContent>
        </HoverCard>
      )}
    </>
  )
}

/** A glance at a version, for a mouse. A phone just opens it. */
function Preview({ id, enabled }: { id: string; enabled: boolean }) {
  const recipe = useQuery({ ...recipeOptions(id), enabled })
  if (!recipe.data) return <Skeleton className="h-16 w-full" />
  const { title, ingredients, content } = recipe.data

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-medium">{title}</p>
      {ingredients.length > 0 && (
        <p className="text-muted-foreground">
          {ingredients
            .slice(0, 5)
            .map((line) => line.name)
            .join(", ")}
          {ingredients.length > 5 && ` and ${ingredients.length - 5} more`}
        </p>
      )}
      {content && <p className="line-clamp-3 text-muted-foreground">{content}</p>}
    </div>
  )
}
