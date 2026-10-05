import {
  type ApiError,
  IMAGE_TYPE_NAMES,
  MAX_IMAGE_BYTES,
  invalid,
  isImageType,
} from "@hannibox/shared"
import { z } from "zod"

const MAX_PHOTOS = 10

const Photos = z.union([z.instanceof(File), z.array(z.instanceof(File))]).optional()

/**
 * A save is a form: the fields as JSON in `data`, the new photos as files beside it, so they are
 * written or refused together.
 */
export const SaveForm = z.object({ data: z.string(), photos: Photos })

export type Save<T> =
  | { ok: true; data: T; photos: File[] }
  | { ok: false; status: 400 | 413 | 415; body: ApiError }

export function readSave<S extends z.ZodType>(
  schema: S,
  form: z.output<typeof SaveForm>,
): Save<z.output<S>> {
  let json: unknown
  try {
    json = JSON.parse(form.data)
  } catch {
    return { ok: false, status: 400, body: { error: "`data` is not valid JSON" } }
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) return { ok: false, status: 400, body: invalid(parsed.error) }

  const photos =
    form.photos === undefined ? [] : Array.isArray(form.photos) ? form.photos : [form.photos]
  if (photos.length > MAX_PHOTOS) {
    return {
      ok: false,
      status: 413,
      body: { error: `A save takes at most ${MAX_PHOTOS} new photos` },
    }
  }
  for (const photo of photos) {
    if (!isImageType(photo.type)) {
      return {
        ok: false,
        status: 415,
        body: { error: `A photo has to be a ${IMAGE_TYPE_NAMES}` },
      }
    }
    if (photo.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        status: 413,
        body: { error: `A photo has to be under ${MAX_IMAGE_BYTES / 1_000_000} MB` },
      }
    }
  }
  return { ok: true, data: parsed.data, photos }
}
