import { SignIn, SignUp } from "@hannibox/shared"
import { useEffect, useRef, useState } from "react"
import { Form, Link, redirect, useNavigation } from "react-router"

import { AuthInput, fieldErrors, focusFirstError } from "~/components/app/auth-field"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { type AuthErrors, authClient, authErrors, readSession } from "~/lib/auth-client"
import { OFFLINE } from "~/lib/query"
import { pageMeta } from "~/lib/site"

import type { Route } from "./+types/auth"

type Mode = "sign-in" | "sign-up"

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
    if (actionData) focusFirstError(form.current, actionData.errors)
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
              <AuthInput name="name" label="Name" autoComplete="name" error={errors.name} />
            )}
            <AuthInput
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email}
            />
            <AuthInput
              name="password"
              label="Password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              error={errors.password}
              aside={
                mode === "sign-in" && (
                  <Link
                    to="/reset-password"
                    className="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Forgot it?
                  </Link>
                )
              }
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
