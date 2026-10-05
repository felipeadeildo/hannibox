import { PencilEdit02Icon } from "@hugeicons/core-free-icons"
import { cn } from "cn"
import {
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

import { HugeiconsIcon } from "~/components/app/icon"
import { ContentEditor } from "~/components/recipe/content-editor"
import { RecipeText } from "~/components/recipe/recipe-text"
import { Button } from "~/components/ui/button"

const asked = new EventTarget()

export function writeSteps(): void {
  asked.dispatchEvent(new Event("write"))
}

export function Steps({
  value,
  onChange,
  title,
}: {
  value: string
  onChange: (text: string) => void
  title: (action: ReactNode) => ReactNode
}) {
  const [writing, setWriting] = useState(false)
  const caret = useRef<number | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const backToEdit = useRef(false)
  const reading = !writing && value.trim() !== ""

  function write(at: number | null) {
    caret.current = at
    setWriting(true)
  }

  useEffect(() => {
    function onAsk() {
      if (field.current) field.current.focus()
      else write(null)
    }
    asked.addEventListener("write", onAsk)
    return () => asked.removeEventListener("write", onAsk)
  }, [])

  useEffect(() => {
    if (!writing) {
      // Done and Esc leave the focus on Edit, not on the page body.
      if (backToEdit.current) editButton.current?.focus()
      backToEdit.current = false
      return
    }
    if (!field.current) return
    const at = caret.current ?? field.current.value.length
    field.current.focus({ preventScroll: caret.current !== null })
    field.current.setSelectionRange(at, at)
    caret.current = null
  }, [writing])

  function onRead(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element) || event.target.closest("a")) return
    if (window.getSelection()?.toString()) return
    write(sourceOffset(event.currentTarget, value, event.clientX, event.clientY))
  }

  function onLeave(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    // Switching to another app is not leaving the steps.
    if (document.hasFocus()) setWriting(false)
  }

  function done() {
    backToEdit.current = true
    field.current?.blur()
    setWriting(false)
  }

  // Faded out while writing, so the title row keeps its height. Not `invisible`: the button's
  // `transition-all` would still read hidden when the effect above tries to focus it.
  const edit = (
    <Button
      ref={editButton}
      variant="ghost"
      size="sm"
      inert={!reading}
      className={cn("text-muted-foreground", !reading && "opacity-0")}
      onClick={() => write(null)}
    >
      <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} data-icon="inline-start" />
      Edit
    </Button>
  )

  return (
    <>
      {title(edit)}
      {reading ? (
        <div onClick={onRead} className="cursor-text">
          <RecipeText source={value} />
        </div>
      ) : (
        <div onFocus={() => setWriting(true)} onBlur={onLeave}>
          <ContentEditor field={field} value={value} onChange={onChange} onDone={done} />
        </div>
      )}
    </>
  )
}

// The text nodes on screen are pieces of the source in the same order, so each one is found in
// the source after the one before it.
function sourceOffset(root: Element, source: string, x: number, y: number): number | null {
  const hit = caretAt(x, y)
  if (!hit || !root.contains(hit.node)) return null

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let from = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ""
    const found = source.indexOf(text, from)
    if (found === -1) continue
    if (node === hit.node) return found + Math.min(hit.offset, text.length)
    from = found + text.length
  }
  return null
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y)
    return position && { node: position.offsetNode, offset: position.offset }
  }
  const range = document.caretRangeFromPoint?.(x, y)
  return range ? { node: range.startContainer, offset: range.startOffset } : null
}
