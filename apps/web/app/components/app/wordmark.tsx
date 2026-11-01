import { ChefHatIcon } from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { Link } from "react-router"

import { HugeiconsIcon } from "~/components/app/icon"

/** The chef's hat and the name, back to the recipe list. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <HugeiconsIcon icon={ChefHatIcon} strokeWidth={2} className="size-4" />
      </span>
      <span className="font-heading text-sm font-medium tracking-tight" translate="no">
        hannibox
      </span>
    </Link>
  )
}
