import { HugeiconsIcon as Base } from "@hugeicons/react"
import type { ComponentProps } from "react"

/**
 * An icon is decoration unless it is given a label, so it is hidden from assistive technology by
 * default. The control around it is what carries the name.
 */
export function HugeiconsIcon(props: ComponentProps<typeof Base>) {
  const named = props["aria-label"] !== undefined || props.role !== undefined
  return <Base aria-hidden={named ? undefined : true} {...props} />
}
