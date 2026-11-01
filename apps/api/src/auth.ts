import type { ApiError } from "@hannibox/shared"
import { type Email, createAuth } from "@hannibox/auth"
import { createMiddleware } from "hono/factory"

import type { Env, UserEnv } from "./env"

// Must stay in `allowed_sender_addresses` in wrangler.jsonc, or the binding refuses it.
const FROM = { name: "hannibox", email: "no-reply@hannibox.adeildo.dev" }

export const withAuth = createMiddleware<Env>(async (c, next) => {
  const { host, protocol } = new URL(c.req.url)
  const auth = createAuth({
    db: c.get("db"),
    secret: c.env.BETTER_AUTH_SECRET,
    baseURL: {
      allowedHosts: [host, "localhost:5173"],
      protocol: protocol === "http:" ? "http" : "https",
    },
    // It runs after the answer is sent, so a failure can only be logged.
    sendEmail: async (email: Email) => {
      try {
        await c.env.EMAIL.send({ from: FROM, ...email })
      } catch (error) {
        console.error("Sending an email failed", error)
      }
    },
    waitUntil: (promise) => c.executionCtx.waitUntil(promise),
  })
  c.set("auth", auth)
  await next()
})

export const requireUser = createMiddleware<UserEnv>(async (c, next) => {
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json<ApiError>({ error: "Sign in first" }, 401)
  c.set("user", session.user)
  await next()
})
