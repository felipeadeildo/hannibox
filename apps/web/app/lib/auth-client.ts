import { createAuthClient } from "better-auth/react"

import { ApiFailure, OFFLINE } from "./query"

export const authClient = createAuthClient()

export type AuthField = "name" | "email" | "password"
/** What went wrong, by the field it is about, and `form` for what is about none of them. */
export type AuthErrors = Partial<Record<AuthField | "form", string>>

type Code = keyof typeof authClient.$ERROR_CODES

const ALREADY_TAKEN: AuthErrors = {
  email: "There is already an account with this email. Sign in instead.",
}

// Better Auth's messages are written for developers; these are the ones a person can run into
// here. Which account exists is not said on sign in, so a wrong email and a wrong password read
// the same.
const MESSAGES: Partial<Record<Code, AuthErrors>> = {
  INVALID_EMAIL_OR_PASSWORD: { form: "That email and password don't match an account." },
  USER_ALREADY_EXISTS: ALREADY_TAKEN,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ALREADY_TAKEN,
  INVALID_EMAIL: { email: "That email doesn't look right" },
  PASSWORD_TOO_SHORT: { password: "That password is too short" },
  PASSWORD_TOO_LONG: { password: "That password is too long" },
}

const isCode = (code: string | undefined): code is Code => code !== undefined && code in MESSAGES

/** A failed Better Auth call as something to show, next to the field it is about when there is one. */
export function authErrors(error: { code?: string; message?: string; status: number }): AuthErrors {
  if (error.status === 429) return { form: "Too many tries. Wait a minute and try again." }
  if (isCode(error.code)) return MESSAGES[error.code] ?? {}
  // Our own check on sign up, in `packages/auth`, which words its message for a person already.
  if (error.code === "INVALID_NAME" && error.message) return { name: error.message }
  // A body that failed Better Auth's own validation reads "[body.email] Invalid email address".
  const field = /^\[body\.(name|email|password)\]\s*(.+)$/.exec(error.message ?? "")
  if (field?.[1] && field[2]) return { [field[1]]: field[2] }
  if (error.status >= 500)
    return { form: "Something went wrong on our side. Try again in a moment." }
  return { form: error.message || "Something went wrong. Try again." }
}

/**
 * Who is signed in, or null for no one. A session that cannot be read throws an `ApiFailure` that
 * says why, rather than counting as signed out.
 */
export async function readSession() {
  const result = await authClient.getSession().catch(() => {
    throw new ApiFailure(0, OFFLINE)
  })
  if (result.error) {
    throw new ApiFailure(result.error.status, authErrors(result.error).form ?? OFFLINE)
  }
  return result.data
}
