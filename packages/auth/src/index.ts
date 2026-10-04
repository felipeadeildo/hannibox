import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { schema } from "@hannibox/db"
import { betterAuth } from "better-auth/minimal"

type AuthConfig = {
  db: Parameters<typeof drizzleAdapter>[0]
  secret: string
  baseURL: string
}

/** Workers hand each request its own bindings, so this runs once per request. */
export function createAuth({ db, secret, baseURL }: AuthConfig) {
  return betterAuth({
    appName: "hannibox",
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true },
    // A signed cookie answers most session checks without a D1 read.
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    advanced: { cookiePrefix: "hannibox" },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type User = Auth["$Infer"]["Session"]["user"]
