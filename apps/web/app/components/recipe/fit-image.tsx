import { cn } from "cn"
import type { ImgHTMLAttributes } from "react"

/**
 * A photo shown whole. What it leaves empty at the sides is the same photo, blurred, so a tall
 * photo and a wide one both fill their box without cutting anything off.
 */
export function FitImage({
  src,
  alt,
  className,
  imgClassName,
  blur = "blur-xl",
  ...props
}: {
  src: string
  alt: string
  className?: string
  imgClassName?: string
  blur?: string
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "className">) {
  return (
    <span className={cn("relative block overflow-hidden bg-muted", className)}>
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn(
          "absolute inset-0 size-full scale-125 object-cover opacity-60 dark:opacity-40",
          blur,
        )}
      />
      <img
        src={src}
        alt={alt}
        className={cn("relative size-full object-contain", imgClassName)}
        {...props}
      />
    </span>
  )
}
