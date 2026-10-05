import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react"
import { cn } from "cn"
import type { CSSProperties } from "react"

const SAFE_HREF = /^(https?:|mailto:|tel:|[/#])/i

const components = {
  a({ href, children, ...props }) {
    if (!href || !SAFE_HREF.test(href)) return <span>{children}</span>
    const outside = /^https?:/i.test(href)
    return (
      <a
        {...props}
        href={href}
        target={outside ? "_blank" : undefined}
        rel={outside ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    )
  },
  // The CSS counter that draws the numbers does not read `start` on its own.
  ol({ start, style, ...props }) {
    const from: CSSProperties = start === undefined ? {} : { counterReset: `step ${start - 1}` }
    return <ol {...props} style={{ ...style, ...from }} />
  },
  // The photos have their own section, so an image written in the steps does not show.
  img() {
    return null
  },
} satisfies MarkdownComponents

export function RecipeText({
  source,
  compact = false,
  className,
}: {
  source: string
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn("recipe-text", compact && "recipe-text-compact", className)}>
      <Markdown components={components} frontmatter={false} headingIds={false}>
        {source}
      </Markdown>
    </div>
  )
}
