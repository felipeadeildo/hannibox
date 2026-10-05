import { HugeiconsIcon } from "~/components/app/icon"
import { SigmaIcon } from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { useState } from "react"

import { AdaptivePanel } from "~/components/app/adaptive-panel"
import { Tile } from "~/components/app/tile"
import type { Saved } from "~/components/recipe/ingredient-line"
import { buttonVariants } from "~/components/ui/button"
import { ingredientArt } from "~/lib/art"
import { formatTotal } from "~/lib/quantity"
import { type Part, partsText } from "~/lib/sections"

// Four shades, so three or four sections side by side never repeat one.
const SHADES = ["bg-primary", "bg-primary/60", "bg-primary/35", "bg-primary/15"]

/**
 * Every ingredient once, added up across the sections, like the "net contents" box of a recipe
 * book. It says how much flour to have out when it goes in the poolish and in the dough.
 */
export function Totals({
  totals,
  saved,
  scale,
}: {
  totals: { name: string; parts: Part[] }[]
  saved: Map<string, Saved>
  scale: number
}) {
  const [open, setOpen] = useState(false)
  const shown = scale === 1 ? "" : `, ×${scale}`

  return (
    <AdaptivePanel
      open={open}
      onOpenChange={setOpen}
      triggerClassName={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "-mr-2 text-muted-foreground data-popup-open:bg-muted",
      )}
      triggerLabel="In total"
      trigger={
        <>
          <HugeiconsIcon icon={SigmaIcon} strokeWidth={2} data-icon="inline-start" />
          In total
        </>
      }
      title="In total"
      description={`Each ingredient once, added up across the sections${shown}.`}
    >
      <ul className="flex flex-col md:-my-1 md:max-h-96 md:overflow-y-auto">
        {totals.map(({ name, parts }) => (
          <Total
            key={name}
            name={name}
            imageId={saved.get(name)?.imageId}
            parts={parts}
            scale={scale}
          />
        ))}
      </ul>
    </AdaptivePanel>
  )
}

function Total({
  name,
  imageId,
  parts,
  scale,
}: {
  name: string
  imageId?: string | null
  parts: Part[]
  scale: number
}) {
  const art = ingredientArt(name)
  const split = parts.length > 1
  const oneUnit = parts.every((part) => part.unit === parts[0]?.unit)

  return (
    <li className="flex gap-3 border-b border-border/60 py-2.5 last:border-b-0">
      <Tile
        src={imageId ? `/api/images/${imageId}` : undefined}
        icon={art.known ? art.icon : undefined}
        hue={art.hue}
        label={name}
        className="size-9"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <p className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate first-letter:uppercase">{name}</span>
          <span className="shrink-0 font-heading text-sm tabular-nums">
            {formatTotal(parts, scale)}
          </span>
        </p>
        {split && (
          <>
            {oneUnit && (
              <span aria-hidden className="flex h-1 gap-0.5">
                {parts.map((part, index) => (
                  <span
                    key={part.key}
                    style={{ flexGrow: part.quantity }}
                    className={cn("min-w-1 basis-0 rounded-full", SHADES[index % SHADES.length])}
                  />
                ))}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{partsText(parts, scale)}</span>
          </>
        )}
      </div>
    </li>
  )
}
