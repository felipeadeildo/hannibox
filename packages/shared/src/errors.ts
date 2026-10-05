import { z } from "zod"

/**
 * The body of every error the API answers with. `error` is written for a person and can go on
 * screen as it is; `issues`, on a validation failure, says which field each problem is about.
 */
export type ApiError = { error: string; issues?: { path: string; message: string }[] }

/** The first thing wrong with a refused value, in the words its schema gives it. */
export function firstProblem(error: z.core.$ZodError): string {
  return error.issues[0]?.message ?? "That is not valid"
}

/** A refused value as an `ApiError`: its first problem up front, and every problem by field. */
export function invalid(error: z.core.$ZodError): ApiError {
  const issues = error.issues.map((issue) => ({
    path: z.core.toDotPath(issue.path),
    message: issue.message,
  }))
  return { error: firstProblem(error), issues }
}
