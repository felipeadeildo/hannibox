import { drizzle } from "drizzle-orm/sqlite-proxy"

import { createAuth } from "./src"

// ! `auth generate` reads the options and never queries, so the client answers nothing.
export const auth = createAuth({
  db: drizzle(async () => ({ rows: [] })),
  secret: "cli-only-secret-that-is-long-enough-to-pass",
  baseURL: "http://localhost:8787",
})
