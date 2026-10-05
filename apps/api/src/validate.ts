import { invalid } from "@hannibox/shared"
import { zValidator } from "@hono/zod-validator"
import type { ValidationTargets } from "hono"
import type { z } from "zod"

/** `zValidator` that answers a bad request with the same `ApiError` body as every other failure. */
export const validate = <Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) return c.json(invalid(result.error), 400)
  })
