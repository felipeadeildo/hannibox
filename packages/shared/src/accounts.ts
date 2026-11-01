import { z } from "zod"

/** Better Auth's own bounds, written down so the server config and the form agree. */
export const PASSWORD = { min: 8, max: 128 } as const

export const AccountName = z
  .string()
  .trim()
  .min(1, "Tell us your name")
  .max(100, "Your name fits in 100 characters")

const Email = z.string().min(1, "Type your email").pipe(z.email("That email doesn't look right"))

export const SignIn = z.object({
  email: Email,
  password: z.string().min(1, "Type your password"),
})

/** A password being chosen, at sign up or to replace one, as opposed to one being typed back. */
const NewPassword = z
  .string()
  .min(PASSWORD.min, `Use at least ${PASSWORD.min} characters`)
  .max(PASSWORD.max, `Use at most ${PASSWORD.max} characters`)

export const SignUp = z.object({
  name: AccountName,
  email: Email,
  password: NewPassword,
})

/** Asks for a link to choose a new password, for someone who can't sign in. */
export const ForgotPassword = z.object({ email: Email })

/** The new password, chosen from the link in that email. */
export const ResetPassword = z.object({ password: NewPassword })

/** A signed-in person replacing the password they know. */
export const ChangePassword = z.object({
  currentPassword: z.string().min(1, "Type your current password"),
  password: NewPassword,
})
