import { GreetingRequest, greet } from "@hannibox/shared"
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

export default new Hono().post("/", zValidator("json", GreetingRequest), (c) => {
  const { name } = c.req.valid("json")
  return c.json({ message: greet(name) }, 201)
})
