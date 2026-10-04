import { z } from "zod"

export * from "./units"

export const GreetingRequest = z.object({
  name: z.string().trim().min(1).max(64),
})

export function greet(name: string): string {
  return `Hello, ${name}! Welcome to hannibox.`
}

/** The body of every error the API answers with. */
export type ApiError = { error: string }
