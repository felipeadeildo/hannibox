import type { ApiError } from "@hannibox/shared"
import { createAuth } from "@hannibox/auth"
import { schema } from "@hannibox/db"
import { drizzle } from "drizzle-orm/d1"
import { createMiddleware } from "hono/factory"

import type { Env, UserEnv } from "./env"

export const withAuth = createMiddleware<Env>(async (c, next) => {
  const auth = createAuth({
    db: drizzle(c.env.DB, { schema }),
    secret: c.env.BETTER_AUTH_SECRET,
    baseURL: new URL(c.req.url).origin,
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
