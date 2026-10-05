import { useEffect, useRef } from "react"

/**
 * Put the returned ref on the last element of an infinite list: `onVisible` runs when it scrolls
 * into `root`, a little before it is reached. The observer is made again each time `enabled` turns
 * on, and a new one reports what it finds, so a page too short to push the end out of view asks for
 * the next one instead of stopping.
 */
export function useSentinel<T extends HTMLElement>(
  root: HTMLElement | null,
  enabled: boolean,
  onVisible: () => void,
) {
  const ref = useRef<T>(null)
  const latest = useRef(onVisible)
  useEffect(() => {
    latest.current = onVisible
  })

  useEffect(() => {
    const element = ref.current
    if (!enabled || !element || !root) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) latest.current()
      },
      { root, rootMargin: "0px 0px 320px 0px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [root, enabled])

  return ref
}
