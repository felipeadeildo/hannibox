import { Form, Outlet, redirect, useRouteLoaderData } from "react-router"

import { Button } from "~/components/ui/button"
import { authClient } from "~/lib/auth-client"

import type { Route } from "./+types/authed"

export async function clientLoader() {
  const { data } = await authClient.getSession()
  if (!data) throw redirect("/auth")
  return { user: data.user }
}

export default function Authed({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-heading">hannibox</span>
        <Form method="post" action="/auth" className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{loaderData.user.email}</span>
          <Button type="submit" name="intent" value="sign-out" variant="ghost" size="sm">
            Sign out
          </Button>
        </Form>
      </header>
      <Outlet />
    </div>
  )
}

/** The signed-in user, for any route under this layout. */
export function useUser() {
  const data = useRouteLoaderData<typeof clientLoader>("routes/authed")
  if (!data) throw new Error("useUser only works under the authed layout")
  return data.user
}
