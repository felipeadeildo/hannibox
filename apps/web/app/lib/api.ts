import type { AppType } from "@hannibox/api"
import { hc } from "hono/client"

import { ApiFailure, OFFLINE } from "./query"

export const api = hc<AppType>("/api", {
  // A request that gets no answer fails like one the API refused, with something to show for it.
  // One that was called off, like a query nobody waits for anymore, stays an abort.
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, init).catch((error: unknown) => {
      if (init?.signal?.aborted) throw error
      throw new ApiFailure(0, OFFLINE)
    }),
})
