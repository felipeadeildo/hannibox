import { type ComponentProps, useState } from "react"
import { Form, redirect, useNavigation } from "react-router"
import { z } from "zod"

import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { authClient } from "~/lib/auth-client"
import { pageMeta } from "~/lib/site"

import type { Route } from "./+types/auth"

type Mode = "sign-in" | "sign-up"

const SignIn = z.object({ email: z.string(), password: z.string() })
const SignUp = SignIn.extend({ name: z.string() })

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

export async function clientLoader() {
  const { data } = await authClient.getSession()
  if (data) throw redirect("/")
  return null
}

/** Sign in, sign up and sign out all post here, and `intent` says which. */
export async function clientAction({ request }: Route.ClientActionArgs) {
  const fields = Object.fromEntries(await request.formData())
  const intent = fields.intent
  if (intent === "sign-out") {
    await authClient.signOut()
    return redirect("/auth")
  }

  const { error } =
    intent === "sign-up"
      ? await authClient.signUp.email(SignUp.parse(fields))
      : await authClient.signIn.email(SignIn.parse(fields))
  if (!error) return redirect("/")
  return { intent, error: error.message ?? "Something went wrong" }
}

export default function Auth({ actionData }: Route.ComponentProps) {
  const [mode, setMode] = useState<Mode>("sign-in")
  const submitting = useNavigation().state === "submitting"
  const copy = COPY[mode]
  const error = actionData?.intent === mode ? actionData.error : undefined

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="flex flex-col gap-4">
            {mode === "sign-up" && <Field name="name" label="Name" autoComplete="name" />}
            <Field name="email" label="Email" type="email" autoComplete="email" />
            <Field
              name="password"
              label="Password"
              type="password"
              minLength={8}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
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
  ...props
}: ComponentProps<"input"> & { name: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required {...props} />
    </div>
  )
}
