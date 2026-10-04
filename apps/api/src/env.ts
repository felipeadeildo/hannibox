// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../worker-configuration.d.ts" />
import type { Auth, User } from "@hannibox/auth"
import type { schema } from "@hannibox/db"
import type { DrizzleD1Database } from "drizzle-orm/d1"

export type Db = DrizzleD1Database<typeof schema>

export type Env = {
  Bindings: CloudflareBindings
  Variables: { auth: Auth; db: Db }
}

export type UserEnv = Env & { Variables: { user: User } }
