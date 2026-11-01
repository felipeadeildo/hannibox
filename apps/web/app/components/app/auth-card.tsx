import { type ComponentProps, type ReactNode, useEffect, useId, useRef } from "react"
import { Form } from "react-router"
import type { z } from "zod"

import { Wordmark } from "~/components/app/wordmark"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
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

/** The page around every form someone fills before they are signed in: the app's name over one card. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Wordmark />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>{title}</h1>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
        {footer && <CardFooter>{footer}</CardFooter>}
      </Card>
    </main>
  )
}

/** Posts to the route's `clientAction`. The browser's own bubbles vanish, so the errors are ours. */
export function AuthForm({ errors, children }: { errors: AuthErrors; children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => focusFirstError(form.current, errors), [errors])
  return (
    <Form ref={form} method="post" noValidate className="flex flex-col gap-4">
      {children}
    </Form>
  )
}

/** What went wrong that no single field is about. */
export function FormError({ children }: { children?: string }) {
  return (
    <p className="text-sm text-destructive empty:hidden" role="alert">
      {children}
    </p>
  )
}

/** A link-styled button flush with the card's text, on a phone too, where buttons pad wider. */
export function FooterButton(props: ComponentProps<typeof Button>) {
  return <Button variant="link" className="px-0 pointer-coarse:px-0" {...props} />
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
  /** Sits at the end of the label's row, like the link for a forgotten password. */
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
