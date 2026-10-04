import { useEffect, useRef } from "react"

/** `mod` is ⌘ on a Mac and Ctrl everywhere else. */
type Combo = "mod+k" | "mod+s" | "/" | "n"

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/** Runs `handler` on a key. A bare key stays out of the way while you type in a field. */
export function useHotkey(combo: Combo, handler: (event: KeyboardEvent) => void) {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })

  useEffect(() => {
    const [mod, key] = combo.startsWith("mod+") ? [true, combo.slice(4)] : [false, combo]
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key) return
      if (mod ? !(event.metaKey || event.ctrlKey) : event.metaKey || event.ctrlKey || event.altKey)
        return
      if (!mod && isTyping(event.target)) return
      latest.current(event)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [combo])
}
