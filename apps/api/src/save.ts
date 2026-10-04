import { IMAGE_TYPES, MAX_IMAGE_BYTES, isImageType } from "@hannibox/shared"
import { z } from "zod"

/** The most photos one save can bring along. */
const MAX_PHOTOS = 10

const Photos = z.union([z.instanceof(File), z.array(z.instanceof(File))]).optional()

/**
 * A save is a form: the recipe's fields as JSON in `data`, and any new photos beside them as
 * files. They travel together so that the recipe and its photos are written, or refused, as one.
 */
export const SaveForm = z.object({ data: z.string(), photos: Photos })

export type Save<T> =
  | { ok: true; data: T; photos: File[] }
  | { ok: false; status: 400 | 413 | 415; error: string }

/** Reads the fields out of `data` and checks the photos, or says what is wrong with the request. */
export function readSave<S extends z.ZodType>(
  schema: S,
  form: z.output<typeof SaveForm>,
): Save<z.output<S>> {
  let json: unknown
  try {
    json = JSON.parse(form.data)
  } catch {
    return { ok: false, status: 400, error: "`data` is not valid JSON" }
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) return { ok: false, status: 400, error: z.prettifyError(parsed.error) }

  const photos =
    form.photos === undefined ? [] : Array.isArray(form.photos) ? form.photos : [form.photos]
  if (photos.length > MAX_PHOTOS) {
    return { ok: false, status: 413, error: `A save takes at most ${MAX_PHOTOS} new photos` }
  }
  for (const photo of photos) {
    if (!isImageType(photo.type)) {
      return { ok: false, status: 415, error: `Send photos as one of ${IMAGE_TYPES.join(", ")}` }
    }
    if (photo.size > MAX_IMAGE_BYTES) {
      return { ok: false, status: 413, error: `A photo is over ${MAX_IMAGE_BYTES / 1_000_000} MB` }
    }
  }
  return { ok: true, data: parsed.data, photos }
}
