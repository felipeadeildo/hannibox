import { cn } from "cn"
import type { ReactNode } from "react"

import { splitLine } from "~/lib/markdown-edit"

const FADED = "text-muted-foreground"

const INLINE = new RegExp(
  [
    String.raw`(?<strong>\*\*|__)(?=\S)(?<strongText>.+?)(?<=\S)\k<strong>`,
    String.raw`(?<ticks>` + "`+" + String.raw`)(?<code>.+?)\k<ticks>`,
    String.raw`~~(?<struck>.+?)~~`,
    String.raw`(?<em>\*|_)(?=[^\s*_])(?<emText>.+?)(?<=[^\s*_])\k<em>`,
    String.raw`\[(?<label>[^\]\n]*)\]\((?<href>[^)\s]*)\)`,
  ].join("|"),
  "g",
)

// This lies under the textarea letter for letter, so nothing here may change a letter's width:
// no weight, size or padding.
export function Tinted({ source }: { source: string }) {
  return source.split("\n").map((line, index) => (
    <span key={index}>
      {index > 0 && "\n"}
      <Line line={line} />
    </span>
  ))
}

function Line({ line }: { line: string }) {
  const { indent, mark, text } = splitLine(line)
  if (!mark) return inline(line)

  const quote = mark === "> "
  const fadedMark = quote || mark.startsWith("#")
  const fadedText = quote || /\[[xX]\]/.test(mark)
  return (
    <>
      {indent}
      <span className={fadedMark ? "text-primary/80" : "text-primary"}>{mark}</span>
      <span className={cn(fadedText && "text-muted-foreground")}>{inline(text)}</span>
    </>
  )
}

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(<Mark key={match.index} found={match.groups ?? {}} />)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function Mark({ found }: { found: Record<string, string | undefined> }) {
  const { strong, strongText, ticks, code, struck, em, emText, label, href } = found
  if (strong) return <Wrapped mark={strong}>{strongText}</Wrapped>
  if (ticks) {
    return (
      <Wrapped mark={ticks} className="rounded-sm bg-muted">
        {code}
      </Wrapped>
    )
  }
  if (struck) {
    return (
      <Wrapped mark="~~" className="line-through">
        {struck}
      </Wrapped>
    )
  }
  if (em) return <Wrapped mark={em}>{emText}</Wrapped>
  return (
    <>
      <span className={FADED}>[</span>
      <span className="underline decoration-primary/40 underline-offset-4">{label}</span>
      <span className={FADED}>]({href})</span>
    </>
  )
}

function Wrapped({
  mark,
  className,
  children,
}: {
  mark: string
  className?: string
  children: ReactNode
}) {
  return (
    <>
      <span className={FADED}>{mark}</span>
      <span className={className}>{children}</span>
      <span className={FADED}>{mark}</span>
    </>
  )
}
