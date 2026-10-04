import type { ApiError } from "@hannibox/shared"
import { Hono } from "hono"
import type { ApplyGlobalResponse } from "hono/client"

import { withAuth } from "./auth"
import type { Env } from "./env"
import greetings from "./routes/greetings"

const api = new Hono<Env>()
  .get("/health", (c) => c.json({ ok: true }, 200))
  .route("/greetings", greetings)

const app = new Hono<Env>()

// Hashed files are never HTML, so getting the SPA shell back means the file is gone.
app.all("/assets/*", async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw)
  const isShell = asset.headers.get("content-type")?.includes("text/html")
  return isShell ? c.body(null, 404) : asset
})

app.use("/api/*", withAuth)
app.on(["GET", "POST"], "/api/auth/*", (c) => c.get("auth").handler(c.req.raw))
app.route("/api", api)

app.notFound((c) => c.json<ApiError>({ error: "Not found" }, 404))
app.onError((error, c) => {
  console.error(error)
  return c.json<ApiError>({ error: "Internal Server Error" }, 500)
})

export default app
export type AppType = ApplyGlobalResponse<
  typeof api,
  { 401: { json: ApiError }; 404: { json: ApiError }; 500: { json: ApiError } }
>
