import { GreetingRequest } from "@hannibox/shared"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import { api } from "~/lib/api"

export default function Home() {
  const [message, setMessage] = useState<string>()

  async function submit(form: FormData) {
    const parsed = GreetingRequest.safeParse({ name: form.get("name") })
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message)
      return
    }
    const res = await api.greetings.$post({ json: parsed.data })
    setMessage(res.ok ? (await res.json()).message : "Something went wrong")
  }

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl">Coming Soon</h1>
      <form action={submit} className="flex gap-2">
        <input
          name="name"
          placeholder="Your name"
          className="rounded-lg border border-input px-3 text-sm"
        />
        <Button type="submit">Greet</Button>
      </form>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </main>
  )
}
