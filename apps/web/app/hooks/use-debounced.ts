import { useEffect, useState } from "react"

/** `value`, a moment after it stops changing. */
export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
