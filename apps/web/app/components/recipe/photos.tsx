import { HugeiconsIcon } from "@hugeicons/react"
import {
  Bread01Icon,
  CakeIcon,
  Camera01Icon,
  Cancel01Icon,
  ImageAdd01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { useRef } from "react"

import { EmptyArt } from "~/components/app/empty-art"
import { FitImage } from "~/components/recipe/fit-image"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"

/** A photo of the version being edited: one the recipe has, or one added here and not saved yet. */
export type Photo = { id: string; src: string; pending: boolean }

const tile = "relative aspect-square overflow-hidden rounded-2xl"

/**
 * The photos of a version. Nothing here reaches the server on its own: adding one keeps it with
 * the draft, and taking one out only leaves it out of the draft. Saving is what decides which
 * recipe each of them belongs to.
 */
export function Photos({
  photos,
  adding,
  onAdd,
  onView,
  onRemove,
}: {
  photos: Photo[]
  /** How many are still being prepared. */
  adding: number
  onAdd: (files: File[]) => void
  onView: (index: number) => void
  onRemove: (photo: Photo) => void
}) {
  const picker = useRef<HTMLInputElement>(null)
  const empty = photos.length === 0 && adding === 0

  return (
    <>
      {empty ? (
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-2xl border border-dashed px-4 pt-5 pb-6 text-center transition-colors outline-none hover:border-solid hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <EmptyArt icons={[Bread01Icon, Camera01Icon, CakeIcon]} />
          <span className="font-medium">Show how it turned out</span>
          <span className="max-w-xs text-sm text-pretty text-muted-foreground">
            Add a photo of the dish. The first one becomes the cover of the recipe.
          </span>
          <span className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground pointer-coarse:h-10">
            <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-4" />
            Add a photo
          </span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className={cn(tile, "group/photo ring-1 ring-foreground/10")}>
              <button
                type="button"
                onClick={() => onView(index)}
                aria-label={index === 0 ? "View the cover photo" : "View the photo"}
                className="block size-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <FitImage src={photo.src} alt="" className="size-full" />
              </button>
              {index === 0 && (
                <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
                  Cover
                </span>
              )}
              {photo.pending && (
                <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-draft-soft px-2 py-0.5 text-xs font-medium text-draft-foreground">
                  New
                </span>
              )}
              {/* On a touch screen it is always there; with a mouse, it shows when you point at the photo. */}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Take this photo out of this version"
                onClick={() => onRemove(photo)}
                className="absolute top-2 right-2 rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75 hover:text-white pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:group-hover/photo:opacity-100 pointer-fine:focus-visible:opacity-100"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2.25} />
              </Button>
            </li>
          ))}
          {Array.from({ length: adding }, (_, i) => (
            <li key={`adding-${i}`} className={tile}>
              <Skeleton className="size-full" />
              <Spinner className="absolute inset-0 m-auto" />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => picker.current?.click()}
              className={cn(
                tile,
                "flex w-full flex-col items-center justify-center gap-2 border border-dashed text-sm text-muted-foreground transition-colors outline-none hover:border-solid hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              <HugeiconsIcon icon={ImageAdd01Icon} strokeWidth={1.75} className="size-7" />
              Add photo
            </button>
          </li>
        </ul>
      )}
      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ""
          if (files.length > 0) onAdd(files)
        }}
      />
    </>
  )
}
