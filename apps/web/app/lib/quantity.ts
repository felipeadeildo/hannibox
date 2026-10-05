import { Quantity, UNITS, type Unit, firstProblem } from "@hannibox/shared"

const GLYPHS: Record<string, number> = {
  "⅛": 1 / 8,
  "¼": 1 / 4,
  "⅓": 1 / 3,
  "⅜": 3 / 8,
  "½": 1 / 2,
  "⅝": 5 / 8,
  "⅔": 2 / 3,
  "¾": 3 / 4,
  "⅞": 7 / 8,
}

/** 1.5 is "1½", 0.25 is "¼", 2 is "2", and what no glyph fits is rounded: 0.3. */
export function formatQuantity(value: number) {
  const whole = Math.floor(value + 1e-9)
  const rest = value - whole
  if (rest < 0.01) return String(whole)
  const glyph = Object.entries(GLYPHS).find(([, fraction]) => Math.abs(rest - fraction) < 0.01)
  if (glyph) return `${whole || ""}${glyph[0]}`
  return String(Math.round(value * 100) / 100)
}

const GLYPH = `[${Object.keys(GLYPHS).join("")}]`
// What a quantity can look like at the start of a line, tried in this order.
const FORMS: [RegExp, (m: RegExpExecArray) => number][] = [
  [/^(\d+)\s+(\d+)\/(\d+)/, (m) => Number(m[1]) + Number(m[2]) / Number(m[3])],
  [/^(\d+)\/(\d+)/, (m) => Number(m[1]) / Number(m[2])],
  [new RegExp(`^(\\d+)?\\s*(${GLYPH})`), (m) => Number(m[1] ?? 0) + (GLYPHS[m[2] ?? ""] ?? 0)],
  [/^\d+(?:[.,]\d+)?/, (m) => Number(m[0].replace(",", "."))],
]

/**
 * Reads a quantity off the start of `text` and gives back what comes after it. What it reads is
 * what was typed, `0` and `1/0` too: whether that is an amount is for `checkAmount` to say.
 */
export function readQuantity(text: string) {
  for (const [pattern, toNumber] of FORMS) {
    const match = pattern.exec(text)
    if (match) return { value: toNumber(match), rest: text.slice(match[0].length).trim() }
  }
  return null
}

/** "1/2", "1 1/2", "1,5" and "½" all work. Null when it is not a number at all. */
export function parseQuantity(text: string) {
  const read = readQuantity(text.trim())
  return read && read.rest === "" ? read.value : null
}

export type Checked = { value: number; error?: undefined } | { value?: undefined; error: string }

/** A number as an amount the API takes, or what is wrong with it, in words to show. */
export function checkAmount(value: number | null): Checked {
  const checked = Quantity.safeParse(value)
  return checked.success ? { value: checked.data } : { error: firstProblem(checked.error) }
}

/**
 * An amount seen at `scale`, back at the recipe's own size. It can be a third of a cup times
 * three, so it is rounded to a sane precision.
 */
export const unscale = (value: number, scale: number) =>
  Math.round((value / scale) * 10_000) / 10_000

/** The amount typed in `text` at `scale`, back at the recipe's size and checked as the API will. */
export function checkQuantity(text: string, scale = 1) {
  const typed = parseQuantity(text)
  return checkAmount(typed === null ? null : unscale(typed, scale))
}

const ALIASES = {
  g: ["g", "gr", "gram", "grams", "grama", "gramas"],
  kg: ["kg", "kilo", "kilos", "quilo", "quilos"],
  ml: ["ml", "mililitro", "mililitros"],
  L: ["l", "liter", "liters", "litro", "litros"],
  cup: ["cup", "cups", "xicara", "xicaras", "xícara", "xícaras", "xic", "xíc"],
  glass: ["glass", "glasses", "copo", "copos"],
  tbsp: ["tbsp", "tbs", "tablespoon", "tablespoons", "colher de sopa", "colheres de sopa", "cs"],
  tsp: ["tsp", "teaspoon", "teaspoons", "colher de cha", "colher de chá", "colheres de chá", "cc"],
  pinch: ["pinch", "pinches", "pitada", "pitadas"],
} satisfies Record<Unit, string[]>

const BY_ALIAS = Object.entries(ALIASES)
  .flatMap(([unit, names]) => names.map((name) => [name, unit as Unit] as const))
  // The longest first, so "colher de sopa" wins over a shorter name that starts it.
  .sort((a, b) => b[0].length - a[0].length)

function readUnit(text: string) {
  const lower = text.toLowerCase()
  for (const [alias, unit] of BY_ALIAS) {
    if (
      lower.startsWith(alias) &&
      (lower.length === alias.length || /[\s.]/.test(lower[alias.length] ?? ""))
    ) {
      return { unit, rest: text.slice(alias.length).replace(/^\./, "").trim() }
    }
  }
  return null
}

const LABELS = {
  g: ["g", "g"],
  kg: ["kg", "kg"],
  ml: ["ml", "ml"],
  L: ["L", "L"],
  cup: ["cup", "cups"],
  glass: ["glass", "glasses"],
  tbsp: ["tbsp", "tbsp"],
  tsp: ["tsp", "tsp"],
  pinch: ["pinch", "pinches"],
} satisfies Record<Unit, [one: string, many: string]>

export const unitLabel = (unit: Unit, quantity = 1) => LABELS[unit][quantity > 1 ? 1 : 0]

/** "60 g", "2 cups", or just "3" for things that are counted. */
export function formatAmount(quantity: number, unit: Unit | null): string {
  return unit
    ? `${formatQuantity(quantity)} ${unitLabel(unit, quantity)}`
    : formatQuantity(quantity)
}

/** Amounts added up by unit: "595 g", or "60 g + ½ cup" across two units. */
export function formatTotal(amounts: { quantity: number; unit: Unit | null }[], scale = 1): string {
  const byUnit = new Map<Unit | null, number>()
  for (const { quantity, unit } of amounts) byUnit.set(unit, (byUnit.get(unit) ?? 0) + quantity)
  return [...byUnit].map(([unit, quantity]) => formatAmount(quantity * scale, unit)).join(" + ")
}

export type ParsedLine = { quantity: number; unit: Unit | null; name: string }

/**
 * "2 cups flour" is two cups of flour; "1/2 tsp ovo" and "2 xícaras de farinha" work too.
 * Without a quantity it is one, and without a unit it counts things.
 */
export function parseLine(text: string): ParsedLine | null {
  let rest = text.trim()
  if (!rest) return null
  const quantity = readQuantity(rest)
  if (quantity) rest = quantity.rest
  const unit = readUnit(rest)
  if (unit) rest = unit.rest
  const name = rest.replace(/^(de|of)\s+/i, "").trim()
  return name ? { quantity: quantity?.value ?? 1, unit: unit?.unit ?? null, name } : null
}

/** The unit a picker's value stands for. */
export const asUnit = (value: string | null): Unit | null =>
  UNITS.find((unit) => unit === value) ?? null
