import { schema } from "@hannibox/db"
import { sql, type AnyColumn } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { createMiddleware } from "hono/factory"

import type { Env } from "./env"

export const withDb = createMiddleware<Env>(async (c, next) => {
  c.set("db", drizzle(c.env.DB, { schema }))
  await next()
})

/** `column LIKE '%text%'` with the wildcards in `text` taken literally. */
export function contains(column: AnyColumn, text: string) {
  return sql`${column} like ${`%${text.replace(/[\\%_]/g, "\\$&")}%`} escape '\\'`
}
