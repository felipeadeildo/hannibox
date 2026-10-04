import { HugeiconsIcon } from "~/components/app/icon"
import { cn } from "cn"
import type { CSSProperties } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import type { Icon } from "~/lib/art"

/** A small square for a recipe or an ingredient: its photo, else an icon or an initial on a colour. */
export function Tile({
  src,
  icon,
  label,
  hue,
  className,
}: {
  src?: string | null
  icon?: Icon
  label: string
  hue: number
  className?: string
}) {
  return (
    <Avatar
      className={cn("tile size-10 rounded-xl after:rounded-xl", className)}
      style={{ "--h": hue } as CSSProperties}
    >
      {src && <AvatarImage src={src} alt="" className="rounded-[inherit]" />}
      <AvatarFallback className="rounded-[inherit] bg-transparent text-inherit">
        {icon ? (
          <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-[55%]" />
        ) : (
          <span className="font-heading">{label.slice(0, 1).toUpperCase()}</span>
        )}
      </AvatarFallback>
    </Avatar>
  )
}
