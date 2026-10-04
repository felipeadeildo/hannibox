// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../worker-configuration.d.ts" />
import type { Auth, User } from "@hannibox/auth"

export type Env = {
  Bindings: CloudflareBindings
  Variables: { auth: Auth }
}

export type UserEnv = Env & { Variables: { user: User } }
