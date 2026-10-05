import { useSyncExternalStore } from "react"

export type Theme = "light" | "dark" | "system"

const KEY = "hannibox:theme"
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
const dark =
  typeof window === "undefined" ? null : window.matchMedia("(prefers-color-scheme: dark)")

function read(): Theme {
  const stored = localStorage.getItem(KEY)
  return stored === "light" || stored === "dark" ? stored : "system"
}

const resolve = (theme: Theme): "light" | "dark" =>
  theme === "system" ? (dark?.matches ? "dark" : "light") : theme

function apply(theme: Theme) {
  const resolved = resolve(theme)
  document.documentElement.classList.toggle("dark", resolved === "dark")
  document.documentElement.style.colorScheme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#0a0a0a" : "#ffffff")
}

dark?.addEventListener("change", () => {
  apply(read())
  notify()
})

export function setTheme(theme: Theme) {
  if (theme === "system") localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, theme)
  apply(theme)
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme)
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolve(read()),
    () => "light" as const,
  )
  return { theme, resolved, setTheme }
}

/** Runs before the first paint, so a dark page does not flash white. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');m&&m.setAttribute("content",d?"#0a0a0a":"#ffffff")}catch(e){}`
