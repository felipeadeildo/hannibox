import { HugeiconsIcon } from "~/components/app/icon"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { useRef } from "react"

import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog"

export function PhotoViewer({
  images,
  index,
  title,
  onChange,
  onClose,
}: {
  images: { id: string; src: string }[]
  index: number | null
  title: string
  onChange: (index: number) => void
  onClose: () => void
}) {
  const touch = useRef<number | null>(null)
  const current = index === null ? undefined : images[index]
  const many = images.length > 1

  const go = (step: number) => {
    if (index === null) return
    onChange((index + step + images.length) % images.length)
  }

  return (
    <Dialog open={index !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="top-0 left-0 h-svh w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-black/95 p-0 text-white ring-0 sm:max-w-none [&_[data-slot=dialog-close]]:text-white"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") go(-1)
          if (event.key === "ArrowRight") go(1)
        }}
        onTouchStart={(event) => {
          touch.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          const start = touch.current
          const end = event.changedTouches[0]?.clientX
          touch.current = null
          if (start === null || end === undefined || !many) return
          if (end - start > 60) go(-1)
          if (start - end > 60) go(1)
        }}
      >
        <DialogTitle className="sr-only">Photos of {title || "the recipe"}</DialogTitle>
        <DialogDescription className="sr-only">
          Use the arrow keys or swipe to see the other photos. Escape closes this.
        </DialogDescription>
        {current && (
          <img
            key={current.id}
            src={current.src}
            alt=""
            className="size-full animate-in object-contain duration-300 zoom-in-95 fade-in"
          />
        )}
        {many && (
          <>
            <Button
              variant="ghost"
              size="icon-lg"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              aria-label="Previous photo"
              onClick={() => go(-1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              aria-label="Next photo"
              onClick={() => go(1)}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm tabular-nums backdrop-blur">
              {(index ?? 0) + 1} / {images.length}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
