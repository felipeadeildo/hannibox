// An edit says what to replace and where the selection ends up. The textarea applies it, so the
// browser keeps it in its undo history.
export type Edit = { from: number; to: number; insert: string; select: [number, number] }

export type LineKind = "heading" | "bullet" | "number" | "task" | "quote"

const KINDS: Record<LineKind, { pattern: RegExp; write: (count: number) => string }> = {
  heading: { pattern: /^#{1,6} $/, write: () => "## " },
  bullet: { pattern: /^[-*+] $/, write: () => "- " },
  number: { pattern: /^\d+[.)] $/, write: (count) => `${count}. ` },
  task: { pattern: /^[-*+] \[[ xX]\] $/, write: () => "- [ ] " },
  quote: { pattern: /^> $/, write: () => "> " },
}

const LINE_MARK = /^(\s*)(#{1,6} |> |[-*+] \[[ xX]\] |[-*+] |\d+[.)] )?/

export function splitLine(line: string): { indent: string; mark: string; text: string } {
  const [, indent = "", mark = ""] = LINE_MARK.exec(line) ?? []
  return { indent, mark, text: line.slice(indent.length + mark.length) }
}

function lineStart(value: string, index: number): number {
  return value.lastIndexOf("\n", index - 1) + 1
}

function lineEnd(value: string, index: number): number {
  const end = value.indexOf("\n", index)
  return end === -1 ? value.length : end
}

export function toggleWrap(value: string, start: number, end: number, mark: string): Edit {
  const size = mark.length
  const inner = value.slice(start, end)
  const wrapped = value.slice(start - size, start) === mark && value.slice(end, end + size) === mark
  if (wrapped) {
    return {
      from: start - size,
      to: end + size,
      insert: inner,
      select: [start - size, end - size],
    }
  }
  return { from: start, to: end, insert: mark + inner + mark, select: [start + size, end + size] }
}

export function toggleLines(value: string, start: number, end: number, kind: LineKind): Edit {
  const from = lineStart(value, start)
  // A triple click selects the line break too; that does not make the next line part of it.
  const last = end > start && value[end - 1] === "\n" ? end - 1 : end
  const to = lineEnd(value, last)
  const lines = value.slice(from, to).split("\n").map(splitLine)
  const filled = lines.filter((line) => line.mark || line.text.trim())
  const off = filled.length > 0 && filled.every((line) => KINDS[kind].pattern.test(line.mark))

  let count = 0
  const next = lines.map(({ indent, mark, text }) => {
    if (off) return indent + text
    if (!mark && !text.trim() && lines.length > 1) return indent + text
    count += 1
    return indent + KINDS[kind].write(count) + text
  })
  const insert = next.join("\n")

  if (lines.length === 1) {
    const caret = Math.max(from, end + insert.length - (to - from))
    return { from, to, insert, select: [caret, caret] }
  }
  return { from, to, insert, select: [from, from + insert.length] }
}

export function continueList(value: string, caret: number): Edit | null {
  const from = lineStart(value, caret)
  const { indent, mark, text } = splitLine(value.slice(from, caret))
  if (!mark || mark.startsWith("#")) return null

  if (!text && !value.slice(caret, lineEnd(value, caret)).trim()) {
    return { from, to: caret, insert: "", select: [from, from] }
  }

  const insert = `\n${indent}${nextMark(mark)}`
  return { from: caret, to: caret, insert, select: [caret + insert.length, caret + insert.length] }
}

function nextMark(mark: string): string {
  const number = /^(\d+)([.)]) $/.exec(mark)
  if (number) return `${Number(number[1]) + 1}${number[2]} `
  return mark.replace(/\[[xX]\]/, "[ ]")
}
