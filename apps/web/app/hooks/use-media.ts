import { useSyncExternalStore } from "react"

/** Whether a media query matches, and it keeps up as the window changes. */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", notify)
      return () => list.removeEventListener("change", notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
