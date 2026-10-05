import { SignIn, SignUp } from "@hannibox/shared"
import { type ComponentProps, useEffect, useId, useRef, useState } from "react"
import { Form, redirect, useNavigation } from "react-router"
import type { z } from "zod"

import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  type AuthErrors,
  type AuthField,
  authClient,
  authErrors,
  readSession,
} from "~/lib/auth-client"
import { OFFLINE } from "~/lib/query"
import { pageMeta } from "~/lib/site"

import type { Route } from "./+types/auth"

type Mode = "sign-in" | "sign-up"

const FIELDS: AuthField[] = ["name", "email", "password"]

const COPY = {
  "sign-in": { title: "Sign in", switchTo: "sign-up", switchLabel: "Create an account" },
  "sign-up": { title: "Create an account", switchTo: "sign-in", switchLabel: "I already have one" },
} satisfies Record<Mode, { title: string; switchTo: Mode; switchLabel: string }>

export function meta() {
  return pageMeta({
    title: "Sign in to hannibox",
    description:
      "Sign in to hannibox, or create an account, to keep your recipes and every version of them.",
    path: "/auth",
  })
}

// A session that cannot be read still leaves the form up: signing in says what is wrong.
export async function clientLoader() {
  if (await readSession().catch(() => null)) throw redirect("/")
  return null
}

/** What a refused value is wrong with, under the field it came from. */
function fieldErrors(error: z.core.$ZodError) {
  const errors: AuthErrors = {}
  for (const issue of error.issues) {
    const field = FIELDS.find((name) => name === issue.path[0])
    if (field) errors[field] ??= issue.message
  }
  return errors
}

/**
 * Checks the fields with the rules the server holds, so most mistakes are answered without a
 * request, then asks Better Auth. Null when it let the person in.
 */
async function enter(intent: Mode, fields: Record<string, unknown>): Promise<AuthErrors | null> {
  if (intent === "sign-up") {
    const checked = SignUp.safeParse(fields)
    if (!checked.success) return fieldErrors(checked.error)
    const { error } = await authClient.signUp.email(checked.data)
    return error && authErrors(error)
  }
  const checked = SignIn.safeParse(fields)
  if (!checked.success) return fieldErrors(checked.error)
  const { error } = await authClient.signIn.email(checked.data)
  return error && authErrors(error)
}

/** Sign in, sign up and sign out all post here, and `intent` says which. */
export async function clientAction({ request }: Route.ClientActionArgs) {
  const fields = Object.fromEntries(await request.formData())
  if (fields.intent === "sign-out") {
    await authClient.signOut()
    return redirect("/auth")
  }

  const intent: Mode = fields.intent === "sign-up" ? "sign-up" : "sign-in"
  try {
    const errors = await enter(intent, fields)
    return errors ? { intent, errors } : redirect("/")
  } catch {
    // Better Auth answers a refusal; a throw means no answer came at all.
    return { intent, errors: { form: OFFLINE } satisfies AuthErrors }
  }
}

export default function Auth({ actionData }: Route.ComponentProps) {
  const [mode, setMode] = useState<Mode>("sign-in")
  const submitting = useNavigation().state === "submitting"
  const copy = COPY[mode]
  const errors = actionData?.intent === mode ? actionData.errors : {}
  const form = useRef<HTMLFormElement>(null)

  // After a refusal, the cursor goes to the first field that has something to fix.
  useEffect(() => {
    if (!actionData) return
    const first = FIELDS.find((field) => actionData.errors[field])
    if (first) form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus()
  }, [actionData])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* The browser's own bubbles speak the browser's language and vanish; these stay. */}
          <Form ref={form} method="post" noValidate className="flex flex-col gap-4">
            {mode === "sign-up" && (
              <Field name="name" label="Name" autoComplete="name" error={errors.name} />
            )}
            <Field
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email}
            />
            <Field
              name="password"
              label="Password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              error={errors.password}
            />
            <p className="text-sm text-destructive empty:hidden" role="alert">
              {errors.form}
            </p>
            <Button type="submit" name="intent" value={mode} disabled={submitting}>
              {copy.title}
            </Button>
          </Form>
        </CardContent>
        <CardFooter>
          <Button variant="link" className="px-0" onClick={() => setMode(copy.switchTo)}>
            {copy.switchLabel}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}

function Field({
  name,
  label,
  error,
  ...props
}: ComponentProps<"input"> & { name: string; label: string; error?: string }) {
  const errorId = useId()
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
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
