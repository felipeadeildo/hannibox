import { ForgotPassword, ResetPassword } from "@hannibox/shared"
import { Link, useNavigation, useSearchParams } from "react-router"

import {
  AuthCard,
  AuthForm,
  AuthInput,
  FooterButton,
  FormError,
  fieldErrors,
} from "~/components/app/auth-card"
import { Button } from "~/components/ui/button"
import { type AuthErrors, EXPIRED_LINK, authClient, authErrors } from "~/lib/auth-client"
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
  | { step: "changed" }
  | { step: "refused"; errors: AuthErrors }

/** Asks for the link, or, with the token the link brought back, sets the new password. */
async function submit(fields: Record<string, unknown>, token: string | null): Promise<Result> {
  if (token) {
    const checked = ResetPassword.safeParse(fields)
    if (!checked.success) return { step: "refused", errors: fieldErrors(checked.error) }
    const { error } = await authClient.resetPassword({ newPassword: checked.data.password, token })
    return error ? { step: "refused", errors: authErrors(error) } : { step: "changed" }
  }

  const checked = ForgotPassword.safeParse(fields)
  if (!checked.success) return { step: "refused", errors: fieldErrors(checked.error) }
  const { error } = await authClient.requestPasswordReset({
    email: checked.data.email,
    redirectTo: new URL("/reset-password", window.location.origin).href,
  })
  // The answer is the same whether an account uses the email or not, so this says no more.
  return error ? { step: "refused", errors: authErrors(error) } : { step: "sent", ...checked.data }
}

/**
 * The link in the email goes through Better Auth, which sends the person back here with
 * `?token=`, or with `?error=INVALID_TOKEN` when it expired or was used. The form posts to the
 * page it is on, so the token comes along in the address.
 */
export async function clientAction({ request }: Route.ClientActionArgs): Promise<Result> {
  const fields = Object.fromEntries(await request.formData())
  try {
    return await submit(fields, new URL(request.url).searchParams.get("token"))
  } catch {
    return { step: "refused", errors: { form: OFFLINE } }
  }
}

const backToSignIn = (
  <FooterButton nativeButton={false} render={<Link to="/auth" />}>
    Back to sign in
  </FooterButton>
)

export default function ResetPasswordPage({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams()
  const submitting = useNavigation().state === "submitting"

  if (actionData?.step === "sent") {
    return (
      <AuthCard
        title="Check your email"
        description={
          <>
            If an account uses{" "}
            <span className="font-medium text-foreground">{actionData.email}</span>, a link to
            choose a new password is on its way. It works once, within the next hour.
          </>
        }
        footer={backToSignIn}
      />
    )
  }

  if (actionData?.step === "changed") {
    return (
      <AuthCard title="Password changed" description="Sign in with the new one.">
        <Button className="w-full" nativeButton={false} render={<Link to="/auth" />}>
          Sign in
        </Button>
      </AuthCard>
    )
  }

  const errors = actionData?.errors ?? (params.has("error") ? { form: EXPIRED_LINK } : {})

  if (params.has("token")) {
    return (
      <AuthCard
        title="Choose a new password"
        description="Every device signed in to your account will be signed out."
        footer={backToSignIn}
      >
        <AuthForm errors={errors}>
          <AuthInput
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            autoFocus
            error={errors.password}
          />
          <FormError>{errors.form}</FormError>
          <Button type="submit" disabled={submitting}>
            Change password
          </Button>
        </AuthForm>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a link to choose a new one."
      footer={backToSignIn}
    >
      <AuthForm errors={errors}>
        <AuthInput
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email}
        />
        <FormError>{errors.form}</FormError>
        <Button type="submit" disabled={submitting}>
          Send the link
        </Button>
      </AuthForm>
    </AuthCard>
  )
}
