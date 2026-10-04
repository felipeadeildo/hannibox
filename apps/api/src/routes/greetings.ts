import { GreetingRequest, greet } from "@hannibox/shared"
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { requireUser } from "../auth"
import type { UserEnv } from "../env"

export default new Hono<UserEnv>()
  .use(requireUser)
  .post("/", zValidator("json", GreetingRequest), (c) => {
    const { name } = c.req.valid("json")
    return c.json({ message: `${greet(name)} Signed in as ${c.get("user").email}.` }, 201)
  })
