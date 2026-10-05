import { SectionTitle, type Unit, firstProblem, sameTitle } from "@hannibox/shared"

import type { DraftLine, DraftSection } from "./drafts"
import { listOf } from "./format"
import { formatAmount } from "./quantity"

// What the ingredient list can do to its sections, without React. Each function takes the sections
// as they are and gives back new ones.

export function newSectionKey(): string {
  return crypto.randomUUID().slice(0, 8)
}

export function insertAt<T>(items: T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)]
}

function between(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

/** Flour in two sections is one ingredient. */
export function namesOf(sections: { lines: { name: string }[] }[]): string[] {
  return [...new Set(sections.flatMap(({ lines }) => lines.map(({ name }) => name)))]
}

/** Where to say something is, for a section that may have no name. */
export function placeName(title: string, many: boolean): string {
  if (title) return title
  return many ? "the first section" : "this recipe"
}

export function lineCount(sections: DraftSection[]): number {
  return sections.reduce((sum, { lines }) => sum + lines.length, 0)
}

/** A section a line can go to, with the names it has, so a line never lands next to itself. */
export type Place = { key: string; title: string; names: Set<string> }

export function placesOf(sections: DraftSection[]): Place[] {
  return sections.map(({ key, title, lines }) => ({
    key,
    title,
    names: new Set(lines.map((line) => line.name)),
  }))
}

/** How much of an ingredient one section takes. */
export type Part = { key: string; title: string; quantity: number; unit: Unit | null }

/** "60 g in Poolish and 535 g in Dough". */
export function partsText(parts: Part[], scale = 1): string {
  return listOf(
    parts.map(
      (part) =>
        `${formatAmount(part.quantity * scale, part.unit)} in ${placeName(part.title, true)}`,
    ),
  )
}

export function totalsOf(sections: DraftSection[]): { name: string; parts: Part[] }[] {
  const totals = new Map<string, Part[]>()
  for (const { key, title, lines } of sections) {
    for (const { name, quantity, unit } of lines) {
      totals.set(name, [...(totals.get(name) ?? []), { key, title, quantity, unit }])
    }
  }
  return [...totals].map(([name, parts]) => ({ name, parts }))
}

/** A section with no name and no lines has nothing to show, so it goes. */
function tidy(sections: DraftSection[]): DraftSection[] {
  return sections.filter(({ title, lines }) => title !== "" || lines.length > 0)
}

/** The first place a section can move to, which is below a first section without a name. */
function floorOf(sections: DraftSection[]): number {
  return sections[0]?.title === "" ? 1 : 0
}

/** The name a new section has until it is given one: "Section 2", or the next number that is free. */
export function placeholderTitle(sections: DraftSection[]): string {
  for (let number = sections.length + 1; ; number++) {
    const title = `Section ${number}`
    if (!sections.some((section) => sameTitle(section.title, title))) return title
  }
}

/**
 * Why the section at `index` cannot be called `title`, or undefined when it can. Only the first one
 * can go without a name, because further down its lines would read as part of the section above.
 */
export function titleProblem(
  title: string,
  index: number,
  sections: DraftSection[],
): string | undefined {
  if (title.trim() === "" && index === 0) return undefined
  const checked = SectionTitle.safeParse(title)
  if (!checked.success) return firstProblem(checked.error)
  const other = sections.find(
    (section, at) => at !== index && sameTitle(section.title, checked.data),
  )
  if (other) return `There is already a section called ${other.title}.`
  return undefined
}

/**
 * Whether the section at `index` can move one place up (-1) or down (1). Nothing goes above a
 * first section without a name.
 */
export function canMove(sections: DraftSection[], index: number, by: -1 | 1): boolean {
  const to = index + by
  const floor = floorOf(sections)
  return index >= floor && to >= floor && to < sections.length
}

/** Moves a section to `index`, or as close to it as it can go. */
export function moveSection(sections: DraftSection[], key: string, index: number): DraftSection[] {
  const from = sections.findIndex((section) => section.key === key)
  const section = sections[from]
  if (!section || from < floorOf(sections)) return sections
  const rest = sections.filter((other) => other !== section)
  return insertAt(rest, between(index, floorOf(rest), rest.length), section)
}

/**
 * Puts a removed section back at `index`. One without a name can only go first. When there is one
 * by the same name again, its lines go into that one instead.
 */
export function restoreSection(
  sections: DraftSection[],
  section: DraftSection,
  index: number,
): DraftSection[] {
  if (sections.some((other) => other.key === section.key)) return sections
  const twin = sections.find((other) => sameTitle(other.title, section.title))
  if (twin) {
    const names = new Set(twin.lines.map((line) => line.name))
    const lines = [...twin.lines, ...section.lines.filter((line) => !names.has(line.name))]
    return sections.map((other) => (other === twin ? { ...twin, lines } : other))
  }
  const at = section.title === "" ? 0 : between(index, floorOf(sections), sections.length)
  return insertAt(sections, at, section)
}

export function removeSection(sections: DraftSection[], key: string): DraftSection[] {
  return sections.filter((section) => section.key !== key)
}

export function renameSection(
  sections: DraftSection[],
  key: string,
  title: string,
): DraftSection[] {
  return tidy(
    sections.map((section) =>
      section.key === key ? { ...section, title: title.trim() } : section,
    ),
  )
}

function changeLines(
  sections: DraftSection[],
  key: string,
  change: (lines: DraftLine[]) => DraftLine[],
): DraftSection[] {
  return tidy(
    sections.map((section) =>
      section.key === key ? { ...section, lines: change(section.lines) } : section,
    ),
  )
}

/** Adds a line at the end of a section: the one at `key`, else the last one, else a new one. */
export function addLine(
  sections: DraftSection[],
  key: string | undefined,
  line: DraftLine,
): DraftSection[] {
  const target = sections.find((section) => section.key === key) ?? sections.at(-1)
  if (!target) return [{ key: newSectionKey(), title: "", lines: [line] }]
  if (target.lines.some((other) => other.name === line.name)) return sections
  return changeLines(sections, target.key, (lines) => [...lines, line])
}

export function changeLine(
  sections: DraftSection[],
  key: string,
  name: string,
  next: DraftLine,
): DraftSection[] {
  return changeLines(sections, key, (lines) =>
    lines.map((line) => (line.name === name ? next : line)),
  )
}

export function removeLine(sections: DraftSection[], key: string, name: string): DraftSection[] {
  return changeLines(sections, key, (lines) => lines.filter((line) => line.name !== name))
}

/** Puts a line back where it was taken from, unless that place is gone or has it again. */
export function restoreLine(
  sections: DraftSection[],
  key: string,
  index: number,
  line: DraftLine,
): DraftSection[] {
  const target = sections.find((section) => section.key === key)
  if (!target || target.lines.some((other) => other.name === line.name)) return sections
  return changeLines(sections, key, (lines) => insertAt(lines, index, line))
}

/**
 * Takes a line out of its section and puts it at `index` of section `to`, which can be the same one,
 * or at its end. A section that already has an ingredient by that name keeps things as they are.
 */
export function placeLine(
  sections: DraftSection[],
  from: string,
  name: string,
  to: string,
  index = Number.POSITIVE_INFINITY,
): DraftSection[] {
  const line = sections.find((section) => section.key === from)?.lines.find((l) => l.name === name)
  const target = sections.find((section) => section.key === to)
  if (!line || !target) return sections
  if (from !== to && target.lines.some((other) => other.name === name)) return sections
  const without = sections.map((section) =>
    section.key === from ? { ...section, lines: section.lines.filter((l) => l !== line) } : section,
  )
  // Tidy only at the end, or a line moved within a section it alone is in would go with it.
  return tidy(
    without.map((section) =>
      section.key === to ? { ...section, lines: insertAt(section.lines, index, line) } : section,
    ),
  )
}

/** Starts a new section right after `key` with the lines from `index` down. */
export function splitSection(
  sections: DraftSection[],
  key: string,
  index: number,
  section: Omit<DraftSection, "lines">,
): DraftSection[] {
  const at = sections.findIndex((other) => other.key === key)
  const source = sections[at]
  if (!source) return sections
  return tidy([
    ...sections.slice(0, at),
    { ...source, lines: source.lines.slice(0, index) },
    { ...section, lines: source.lines.slice(index) },
    ...sections.slice(at + 1),
  ])
}
