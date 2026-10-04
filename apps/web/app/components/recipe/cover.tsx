import { HugeiconsIcon } from "~/components/app/icon"
import { Maximize01Icon } from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { useState } from "react"

import { FitImage } from "~/components/recipe/fit-image"

/**
 * A strip with the recipe's first photo: a teaser, not the photo itself. It is shown whole, with
 * the photo blurred behind it to fill what is left over, and "View" opens it full screen.
 */
export function Cover({
  src,
  alt,
  count,
  onOpen,
}: {
  src: string
  alt: string
  count: number
  onOpen: () => void
}) {
  const [ready, setReady] = useState(false)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={count > 1 ? `View the ${count} photos` : "View the photo"}
      className="group relative -mx-4 block aspect-video w-auto overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:mx-0 md:aspect-[21/9] md:rounded-2xl"
    >
      <FitImage
        src={src}
        alt={alt}
        className="size-full"
        blur="blur-2xl"
        loading="eager"
        fetchPriority="high"
        onLoad={() => setReady(true)}
        imgClassName={cn(
          "cover-drift transition-[opacity,scale] duration-700 ease-out",
          ready ? "scale-100 opacity-100" : "scale-[1.03] opacity-0",
        )}
      />
      <span className="absolute right-3 bottom-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/55 px-3 text-sm font-medium text-white backdrop-blur transition-colors group-hover:bg-black/75">
        <HugeiconsIcon icon={Maximize01Icon} strokeWidth={2} className="size-4" />
        {count > 1 ? `View ${count} photos` : "View"}
      </span>
    </button>
  )
}
