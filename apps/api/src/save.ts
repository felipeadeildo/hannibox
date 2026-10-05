import { type ApiError, invalid } from "@hannibox/shared"
import { z } from "zod"

import { type Photo, readPhoto } from "./photos"

const MAX_PHOTOS = 10

// A form with one file sends a File and one with several an array; the save always gets a list.
const Photos = z
  .union([z.instanceof(File), z.array(z.instanceof(File))])
  .default([])
  .transform((files) => (Array.isArray(files) ? files : [files]))

/**
 * A save is a form: the fields as JSON in `data`, the new photos as files beside it, so they are
 * written or refused together.
 */
export const SaveForm = z.object({ data: z.string(), photos: Photos })

type Refusal = { ok: false; status: 400 | 413 | 415; body: ApiError }

export type Save<T> = { ok: true; data: T; photos: Photo[] } | Refusal

function refuse(status: Refusal["status"], body: ApiError): Refusal {
  return { ok: false, status, body }
}

export async function readSave<S extends z.ZodType>(
  schema: S,
  form: z.output<typeof SaveForm>,
): Promise<Save<z.output<S>>> {
  let json: unknown
  try {
    json = JSON.parse(form.data)
  } catch {
    return refuse(400, { error: "`data` is not valid JSON" })
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) return refuse(400, invalid(parsed.error))

  if (form.photos.length > MAX_PHOTOS) {
    return refuse(413, { error: `A save takes at most ${MAX_PHOTOS} new photos` })
  }
  const photos: Photo[] = []
  for (const file of form.photos) {
    const read = await readPhoto(file)
    if (!read.ok) return read
    photos.push(read.photo)
  }
  return { ok: true, data: parsed.data, photos }
}
