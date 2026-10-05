import { HugeiconsIcon } from "~/components/app/icon"
import { Add01Icon, MinusSignIcon } from "@hugeicons/core-free-icons"
import { LIMITS, UNITS, type Unit } from "@hannibox/shared"
import { cn } from "cn"
import { useId } from "react"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { asUnit, checkQuantity, formatQuantity, parseQuantity, unitLabel } from "~/lib/quantity"

/** How much one tap of + or − moves an amount, in the unit it is in. */
function stepFor(unit: Unit | null) {
  if (unit === "g" || unit === "ml") return 50
  if (unit === "kg" || unit === "L") return 0.25
  if (unit === "pinch" || unit === null) return 1
  return 0.25
}

/** The amounts people reach for, so a common one is a tap and not a keyboard. */
function shortcuts(unit: Unit | null) {
  if (unit === "g" || unit === "ml") return [50, 100, 250, 500]
  if (unit === "kg" || unit === "L") return [0.5, 1, 1.5, 2]
  if (unit === null || unit === "pinch") return [1, 2, 3, 4]
  return [0.25, 0.5, 0.75, 1, 2]
}

/**
 * An amount you can type, nudge with + and −, or pick from the usual ones. What is typed is
 * checked as it is typed, and what is wrong with it shows under the field. `optional` lets it be
 * left empty.
 */
export function AmountField({
  label,
  value,
  unit,
  scale = 1,
  optional = false,
  onChange,
}: {
  label: string
  value: string
  unit: Unit | null
  /** The scale the amount is shown at: it is checked at the recipe's own size. */
  scale?: number
  optional?: boolean
  onChange: (text: string) => void
}) {
  const errorId = useId()
  const step = stepFor(unit)
  const { error } = checkQuantity(value, scale)
  const amount = error ? null : parseQuantity(value)
  const problem = optional && value.trim() === "" ? undefined : error

  function nudge(direction: 1 | -1) {
    const next = Math.round(((amount ?? 0) + direction * step) * 100) / 100
    onChange(formatQuantity(Math.min(LIMITS.quantity, Math.max(step, next))))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Less"
          onClick={() => nudge(-1)}
        >
          <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} />
        </Button>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          aria-invalid={problem !== undefined}
          aria-describedby={problem ? errorId : undefined}
          className="text-center font-heading tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="More"
          onClick={() => nudge(1)}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
        </Button>
      </div>
      {/* Always there, so a screen reader hears the problem when it shows up. */}
      <p id={errorId} className="text-sm text-destructive empty:hidden" aria-live="polite">
        {problem}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {shortcuts(unit).map((option) => (
          <Button
            key={option}
            type="button"
            variant={amount === option ? "default" : "secondary"}
            size="sm"
            onClick={() => onChange(formatQuantity(option))}
          >
            <span className="tabular-nums">{formatQuantity(option)}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

/** Every unit as a chip to tap. "None" counts things: two eggs. */
export function UnitPicker({
  value,
  onChange,
  className,
}: {
  value: Unit | null
  onChange: (unit: Unit | null) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium">Unit</span>
      <ToggleGroup
        value={[value ?? "none"]}
        onValueChange={(next) => onChange(asUnit(next[0] ?? "none"))}
        variant="outline"
        size="sm"
        spacing={1}
        className="flex-wrap"
        aria-label="Unit"
      >
        <ToggleGroupItem value="none">None</ToggleGroupItem>
        {UNITS.map((unit) => (
          <ToggleGroupItem key={unit} value={unit}>
            {unitLabel(unit)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
