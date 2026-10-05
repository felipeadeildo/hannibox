import {
  CheckListIcon,
  Heading02Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  QuoteDownIcon,
  TextBoldIcon,
  TextItalicIcon,
} from "@hugeicons/core-free-icons"
import { LIMITS } from "@hannibox/shared"
import { cn } from "cn"
import type { KeyboardEvent, RefObject } from "react"

import { HugeiconsIcon } from "~/components/app/icon"
import { Tinted } from "~/components/recipe/tinted"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import type { Icon } from "~/lib/art"
import {
  continueList,
  type Edit,
  type LineKind,
  toggleLines,
  toggleWrap,
} from "~/lib/markdown-edit"

type Tool = { label: string; icon: Icon; key?: string; edit: (field: HTMLTextAreaElement) => Edit }

function lines(kind: LineKind): Tool["edit"] {
  return (field) => toggleLines(field.value, field.selectionStart, field.selectionEnd, kind)
}

function wrap(mark: string): Tool["edit"] {
  return (field) => toggleWrap(field.value, field.selectionStart, field.selectionEnd, mark)
}

const TOOLS: Tool[] = [
  { label: "Numbered steps", icon: LeftToRightListNumberIcon, edit: lines("number") },
  { label: "List", icon: LeftToRightListBulletIcon, edit: lines("bullet") },
  { label: "Checklist", icon: CheckListIcon, edit: lines("task") },
  { label: "Part of the recipe", icon: Heading02Icon, edit: lines("heading") },
  { label: "Bold", icon: TextBoldIcon, key: "b", edit: wrap("**") },
  { label: "Italic", icon: TextItalicIcon, key: "i", edit: wrap("_") },
  { label: "Tip", icon: QuoteDownIcon, edit: lines("quote") },
]

const TEXT =
  "block w-full px-4 pt-1 pb-3.5 text-base leading-7 tracking-normal break-words whitespace-pre-wrap"

// `insertText` is deprecated, but nothing else puts the edit in the browser's undo history.
function applyEdit(field: HTMLTextAreaElement, edit: Edit, onChange: (text: string) => void): void {
  field.focus()
  field.setSelectionRange(edit.from, edit.to)
  const typed = edit.insert
    ? document.execCommand("insertText", false, edit.insert)
    : document.execCommand("delete")
  if (!typed) {
    field.setRangeText(edit.insert, edit.from, edit.to)
    onChange(field.value)
  }
  field.setSelectionRange(...edit.select)
}

export function ContentEditor({
  value,
  onChange,
  onDone,
  field,
}: {
  value: string
  onChange: (text: string) => void
  onDone: () => void
  field: RefObject<HTMLTextAreaElement | null>
}) {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const area = event.currentTarget
    if (event.key === "Escape") {
      onDone()
      return
    }
    const mod = event.metaKey || event.ctrlKey
    // Ctrl+Alt is how AltGr arrives on Windows, and that types a letter.
    const bare = mod && !event.shiftKey && !event.altKey
    const tool = bare && TOOLS.find((each) => each.key === event.key.toLowerCase())
    if (tool) {
      event.preventDefault()
      applyEdit(area, tool.edit(area), onChange)
      return
    }
    if (event.key !== "Enter" || mod || event.shiftKey || event.altKey) return
    if (event.nativeEvent.isComposing || area.selectionStart !== area.selectionEnd) return
    const edit = continueList(area.value, area.selectionStart)
    if (!edit) return
    event.preventDefault()
    applyEdit(area, edit, onChange)
  }

  return (
    <div className="group rounded-2xl bg-(--box) ring-primary/40 [--box:color-mix(in_oklab,var(--muted)_55%,var(--background))] has-focus-visible:ring-1 dark:[--box:color-mix(in_oklab,var(--muted)_35%,var(--background))]">
      <Toolbar
        onTool={(tool) => {
          if (field.current) applyEdit(field.current, tool.edit(field.current), onChange)
        }}
        onDone={onDone}
      />
      {/* The text is drawn twice: tinted underneath, and typed into on top with its letters
          see-through. Only colours differ, so every letter lands in the same place, and the
          tinted copy sets the height. */}
      <div className="relative">
        <div aria-hidden className={cn(TEXT, "min-h-64 text-foreground")}>
          <Tinted source={value} />
          {/* A last empty line still takes room. */}
          {"\u200b"}
        </div>
        <textarea
          ref={field}
          id="recipe-content"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write the steps, one to a line…"
          aria-label="Steps"
          maxLength={LIMITS.content}
          spellCheck
          className={cn(
            TEXT,
            "absolute inset-0 size-full resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/25 placeholder:text-muted-foreground",
          )}
        />
      </div>
    </div>
  )
}

// Pressing a button keeps the focus in the text, or the keyboard would close on a phone.
function Toolbar({ onTool, onDone }: { onTool: (tool: Tool) => void; onDone: () => void }) {
  return (
    <div
      role="toolbar"
      aria-label="Format the steps"
      aria-controls="recipe-content"
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 flex items-center gap-1 rounded-t-2xl bg-(--box) p-1.5 md:top-0"
    >
      <div className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto">
        {TOOLS.map((tool) => (
          <Tooltip key={tool.label}>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tool.label}
                  // Seven of these and Done have to fit a 375px phone.
                  className="shrink-0 text-muted-foreground hover:text-foreground pointer-coarse:size-9"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onTool(tool)}
                />
              }
            >
              <HugeiconsIcon icon={tool.icon} strokeWidth={2} className="size-[1.1rem]" />
            </TooltipTrigger>
            <TooltipContent>
              {tool.label}
              {tool.key && <span className="ml-1.5 text-background/60">{shortcut(tool.key)}</span>}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="invisible shrink-0 font-medium text-primary group-focus-within:visible hover:text-primary"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDone}
      >
        Done
      </Button>
    </div>
  )
}

function shortcut(key: string): string {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+"
  return mod + key.toUpperCase()
}
