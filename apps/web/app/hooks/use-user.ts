import { useRouteLoaderData } from "react-router"

import type { clientLoader } from "~/routes/authed"

/** The signed-in user, for any route under the authed layout. */
export function useUser() {
  const data = useRouteLoaderData<typeof clientLoader>("routes/authed")
  if (!data) throw new Error("useUser only works under the authed layout")
  return data.user
}
