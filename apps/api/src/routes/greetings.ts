import { GreetingRequest, greet } from "@hannibox/shared"
import { Hono } from "hono"

import { requireUser } from "../auth"
import type { UserEnv } from "../env"
import { validate } from "../validate"

export default new Hono<UserEnv>()
  .use(requireUser)
  .post("/", validate("json", GreetingRequest), (c) => {
    const { name } = c.req.valid("json")
    return c.json({ message: `${greet(name)} Signed in as ${c.get("user").email}.` }, 201)
  })
