import type { AppType } from "@hannibox/api"
import { hc } from "hono/client"

export const api = hc<AppType>("/api")
