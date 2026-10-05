import { cn } from "cn"
import type { ReactNode } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { useMedia } from "~/hooks/use-media"

/**
 * A popover beside the trigger with a mouse, and a sheet from the bottom on a phone, where a
 * popover would be hard to reach.
 */
export function AdaptivePanel({
  open,
  onOpenChange,
  triggerClassName,
  triggerLabel,
  trigger,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerClassName: string
  triggerLabel: string
  trigger: ReactNode
  title: string
  description?: string
  children: ReactNode
}) {
  const wide = useMedia("(min-width: 768px)")

  if (wide) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger className={triggerClassName} aria-label={triggerLabel}>
          {trigger}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4">
          {children}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        onClick={() => onOpenChange(true)}
      >
        {trigger}
      </button>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "max-h-[88svh] gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted" />
          <SheetHeader>
            <SheetTitle className="first-letter:uppercase">{title}</SheetTitle>
            <SheetDescription className={description ? undefined : "sr-only"}>
              {description ?? title}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pt-1 pb-2">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  )
}
