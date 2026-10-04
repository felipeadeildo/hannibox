import { HugeiconsIcon } from "~/components/app/icon"
import { PencilEdit02Icon } from "@hugeicons/core-free-icons"
import { cn } from "cn"
import type { ReactNode } from "react"

/** Saffron marks what is only a draft, so it never reads as saved. */
export function DraftPill({
  children = "Draft",
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-draft-soft px-2 py-0.5 text-xs font-medium text-draft-foreground",
        className,
      )}
    >
      <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-3" />
      {children}
    </span>
  )
}
