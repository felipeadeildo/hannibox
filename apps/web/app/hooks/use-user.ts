import { useRouteLoaderData } from "react-router"

import type { clientLoader } from "~/routes/authed"

export function useUser() {
  const data = useRouteLoaderData<typeof clientLoader>("routes/authed")
  if (!data) throw new Error("useUser only works under the authed layout")
  return data.user
}
