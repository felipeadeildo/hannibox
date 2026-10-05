import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"

/**
 * A reply the API refused, or one that never came. `message` is the `error` it sent, written to be
 * shown as it is; `status` is 0 when the request did not reach the API at all.
 */
export class ApiFailure extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const OFFLINE = "Can't reach hannibox. Check your connection and try again."

/** What to tell a person about a failure, whatever threw it. */
export const messageOf = (error: unknown, fallback = "Something went wrong. Try again.") =>
  error instanceof Error && error.message ? error.message : fallback

// A session that ended while the tab stayed open sends the user back to sign in.
function onError(error: Error) {
  if (error instanceof ApiFailure && error.status === 401) window.location.assign("/auth")
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx will answer the same again. Only a flaky network or a 5xx is worth retrying.
      retry: (count, error) =>
        !(error instanceof ApiFailure && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
})

type Reply = { ok: boolean; status: number; json(): Promise<unknown> }

async function failure(res: Reply) {
  const body = await res.json().catch(() => null)
  const message =
    typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "Something went wrong. Try again."
  return new ApiFailure(res.status, message)
}

/** The body of a successful reply. Anything else throws an `ApiFailure`. */
export async function unwrap<R extends Reply>(
  res: R,
): Promise<Awaited<ReturnType<Extract<R, { ok: true }>["json"]>>> {
  if (!res.ok) throw await failure(res)
  return (await res.json()) as never
}

/** For replies with no body, like a 204. */
export async function expectOk(res: Reply) {
  if (!res.ok) throw await failure(res)
}
