const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit" })
const long = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
const conjunction = new Intl.ListFormat("en-GB", { type: "conjunction" })

export const shortDate = (iso: string) => dayMonth.format(new Date(iso))

export const longDate = (iso: string) => long.format(new Date(iso))

const STEPS = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
] as const

export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return "just now"
}

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  return conjunction.format(items)
}

/** Text that starts with a name, like "water is already in Dough.", as a sentence. */
export function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
