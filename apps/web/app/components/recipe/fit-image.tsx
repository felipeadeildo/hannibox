import { cn } from "cn"
import type { ImgHTMLAttributes } from "react"

/** Shown whole. The empty sides are the same photo, blurred. */
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
