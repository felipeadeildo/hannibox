import { ForgotPassword, ResetPassword } from "@hannibox/shared"
import { useEffect, useRef } from "react"
import { Form, Link, useNavigation, useSearchParams } from "react-router"

import { AuthInput, fieldErrors, focusFirstError } from "~/components/app/auth-field"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { type AuthErrors, authClient, authErrors } from "~/lib/auth-client"
import { OFFLINE } from "~/lib/query"
import { pageMeta } from "~/lib/site"

import type { Route } from "./+types/reset-password"

export function meta() {
  return pageMeta({
    title: "Reset your hannibox password",
    description: "Get a link by email to choose a new password for your hannibox account.",
    path: "/reset-password",
    canonical: false,
  })
}

type Result =
  | { step: "sent"; email: string }
  | { step: "done" }
  | { step: "failed"; errors: AuthErrors }

/**
 * Without a token, asks for the email to send the link to. The link goes through Better Auth,
 * which brings the person back here with `?token=`, or with `?error=INVALID_TOKEN` when it has
 * expired or was used.
 */
export async function clientAction({ request }: Route.ClientActionArgs): Promise<Result> {
  const fields = Object.fromEntries(await request.formData())
  try {
    if (fields.intent === "reset") {
      const checked = ResetPassword.safeParse(fields)
      if (!checked.success) return { step: "failed", errors: fieldErrors(checked.error) }
      // The form posts to the page it is on, so the token comes along in the address.
      const token = new URL(request.url).searchParams.get("token") ?? ""
      const { error } = await authClient.resetPassword({
        newPassword: checked.data.password,
        token,
      })
      return error ? { step: "failed", errors: authErrors(error) } : { step: "done" }
    }

    const checked = ForgotPassword.safeParse(fields)
    if (!checked.success) return { step: "failed", errors: fieldErrors(checked.error) }
    const { error } = await authClient.requestPasswordReset({
      email: checked.data.email,
      redirectTo: new URL("/reset-password", window.location.origin).href,
    })
    // The answer is the same whether an account uses the email or not, so it says nothing more.
    return error ? { step: "failed", errors: authErrors(error) } : { step: "sent", ...checked.data }
  } catch {
    return { step: "failed", errors: { form: OFFLINE } }
  }
}

export default function ResetPasswordPage({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams()
  const token = params.get("token")

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        {actionData?.step === "sent" ? (
          <Sent email={actionData.email} />
        ) : actionData?.step === "done" ? (
          <Done />
        ) : token ? (
          <ChooseNew errors={actionData?.errors ?? {}} />
        ) : (
          <AskForLink
            errors={
              actionData?.errors ??
              (params.get("error")
                ? { form: "This link has expired or was already used. Ask for a new one." }
                : {})
            }
          />
        )}
        {actionData?.step !== "done" && (
          <CardFooter>
            <Button
              variant="link"
              className="px-0"
              nativeButton={false}
              render={<Link to="/auth" />}
            >
              Back to sign in
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  )
}

function AskForLink({ errors }: { errors: AuthErrors }) {
  const submitting = useNavigation().state === "submitting"
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => focusFirstError(form.current, errors), [errors])

  return (
    <>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>We'll email you a link to choose a new one.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form ref={form} method="post" noValidate className="flex flex-col gap-4">
          <AuthInput
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            error={errors.email}
          />
          <p className="text-sm text-destructive empty:hidden" role="alert">
            {errors.form}
          </p>
          <Button type="submit" name="intent" value="request" disabled={submitting}>
            Send the link
          </Button>
        </Form>
      </CardContent>
    </>
  )
}

function ChooseNew({ errors }: { errors: AuthErrors }) {
  const submitting = useNavigation().state === "submitting"
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => focusFirstError(form.current, errors), [errors])

  return (
    <>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Every device signed in to your account will be signed out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form ref={form} method="post" noValidate className="flex flex-col gap-4">
          <AuthInput
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            autoFocus
            error={errors.password}
          />
          <p className="text-sm text-destructive empty:hidden" role="alert">
            {errors.form}
          </p>
          <Button type="submit" name="intent" value="reset" disabled={submitting}>
            Save the new password
          </Button>
        </Form>
      </CardContent>
    </>
  )
}

function Sent({ email }: { email: string }) {
  return (
    <CardHeader>
      <CardTitle>Check your email</CardTitle>
      <CardDescription>
        If an account uses <span className="font-medium text-foreground">{email}</span>, a link to
        choose a new password is on its way. It works once, within the next hour.
      </CardDescription>
    </CardHeader>
  )
}

function Done() {
  return (
    <>
      <CardHeader>
        <CardTitle>Your password is changed</CardTitle>
        <CardDescription>Sign in with the new one.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" nativeButton={false} render={<Link to="/auth" />}>
          Sign in
        </Button>
      </CardContent>
    </>
  )
}
