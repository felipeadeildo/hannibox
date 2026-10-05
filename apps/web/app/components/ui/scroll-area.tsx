import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { cn } from "cn"

type Orientation = "vertical" | "horizontal" | "both"

function ScrollArea({
  className,
  children,
  orientation = "vertical",
  fade,
  viewportRef,
  viewportClassName,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  orientation?: Orientation
  /** Softens the edge that has more content past it, and only that edge. */
  fade?: "x" | "y"
  /** The element that scrolls, for code that has to watch it or move it. */
  viewportRef?: React.Ref<HTMLDivElement>
  viewportClassName?: string
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          // `max-h-[inherit]` is what makes a max-height on the root cap the viewport instead of
          // being outgrown by it.
          "size-full max-h-[inherit] rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          fade === "y" && "scroll-fade-y",
          fade === "x" && "scroll-fade-x",
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {orientation !== "horizontal" && <ScrollBar />}
      {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
      {orientation === "both" && <ScrollAreaPrimitive.Corner />}
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        // Out of the way until the pointer is over the area or it is scrolling.
        "flex touch-none p-px opacity-0 transition-opacity select-none data-hovering:opacity-100 data-scrolling:opacity-100 data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
