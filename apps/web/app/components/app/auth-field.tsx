import { type ComponentProps, type ReactNode, useId } from "react"
import type { z } from "zod"

import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import type { AuthErrors, AuthField } from "~/lib/auth-client"

const FIELDS: AuthField[] = ["name", "email", "currentPassword", "password"]

/** What a refused value is wrong with, under the field it came from. */
export function fieldErrors(error: z.core.$ZodError): AuthErrors {
  const errors: AuthErrors = {}
  for (const issue of error.issues) {
    const field = FIELDS.find((name) => name === issue.path[0])
    if (field) errors[field] ??= issue.message
  }
  return errors
}

/** After a refusal, puts the cursor in the first field that has something to fix. */
export function focusFirstError(form: HTMLFormElement | null, errors: AuthErrors) {
  const first = FIELDS.find((field) => errors[field])
  if (first) form?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus()
}

export function AuthInput({
  name,
  label,
  error,
  aside,
  ...props
}: ComponentProps<"input"> & {
  name: AuthField
  label: string
  error?: string
  /** Sits at the end of the label's row, like a link to reset a forgotten password. */
  aside?: ReactNode
}) {
  const errorId = useId()
  const inputId = useId()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        {aside}
      </div>
      <Input
        id={inputId}
        name={name}
        required
        aria-invalid={error !== undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      <p id={errorId} className="text-sm text-destructive empty:hidden" aria-live="polite">
        {error}
      </p>
    </div>
  )
}
