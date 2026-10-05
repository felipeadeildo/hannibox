import { Tile } from "~/components/app/tile"
import type { Icon } from "~/lib/art"

export function EmptyArt({ icons }: { icons: [Icon, Icon, Icon] }) {
  const [left, middle, right] = icons
  return (
    <div aria-hidden className="relative mb-1 flex h-[5.5rem] w-44 items-center justify-center">
      <Tile
        icon={left}
        label=""
        hue={85}
        className="absolute left-2 size-14 -rotate-12 opacity-70"
      />
      <Tile
        icon={right}
        label=""
        hue={235}
        className="absolute right-2 size-14 rotate-12 opacity-70"
      />
      <Tile
        icon={middle}
        label=""
        hue={185}
        className="relative size-[4.75rem] rounded-2xl shadow-sm ring-4 ring-background after:rounded-2xl"
      />
    </div>
  )
}
