import { GreetingRequest } from "@hannibox/shared"
import { Form } from "react-router"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { api } from "~/lib/api"

import type { Route } from "./+types/home"
import { useUser } from "./authed"

export async function clientAction({ request }: Route.ClientActionArgs) {
  const parsed = GreetingRequest.safeParse({ name: (await request.formData()).get("name") })
  if (!parsed.success) return { message: parsed.error.issues[0]?.message }
  const res = await api.greetings.$post({ json: parsed.data })
  return { message: res.ok ? (await res.json()).message : "Something went wrong" }
}

export default function Home({ actionData }: Route.ComponentProps) {
  const user = useUser()

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6">
      <h1 className="text-3xl">Coming Soon</h1>
      <Form method="post" className="flex gap-2">
        <Input name="name" defaultValue={user.name} className="w-48" />
        <Button type="submit">Greet</Button>
      </Form>
      {actionData?.message && <p className="text-sm text-muted-foreground">{actionData.message}</p>}
    </main>
  )
}
