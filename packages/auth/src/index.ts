import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { schema } from "@hannibox/db"
import { AccountName, PASSWORD, firstProblem } from "@hannibox/shared"
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal"
import { APIError, createAuthMiddleware } from "better-auth/api"

type AuthConfig = {
  db: Parameters<typeof drizzleAdapter>[0]
  secret: string
  // A string pins one origin; `allowedHosts` resolves the host per request and
  // feeds `trustedOrigins`, so dev, previews and custom domains all agree.
  baseURL: BetterAuthOptions["baseURL"]
}

/** Better Auth takes any string as a name, a blank one too: this one has to say something. */
const checkName = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-up/email") return
  const name = AccountName.safeParse(ctx.body?.name)
  if (!name.success) {
    throw APIError.from("BAD_REQUEST", { code: "INVALID_NAME", message: firstProblem(name.error) })
  }
  return { context: { body: { ...ctx.body, name: name.data } } }
})

/** Workers hand each request its own bindings, so this runs once per request. */
export function createAuth({ db, secret, baseURL }: AuthConfig) {
  return betterAuth({
    appName: "hannibox",
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD.min,
      maxPasswordLength: PASSWORD.max,
    },
    hooks: { before: checkName },
    // A signed cookie answers most session checks without a D1 read.
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    advanced: { cookiePrefix: "hannibox" },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type User = Auth["$Infer"]["Session"]["user"]
