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

type Refusal = { ok: false; status: 400 | 413 | 415; body: ApiError }

export type Save<T> = { ok: true; data: T; photos: File[] } | Refusal

function refuse(status: Refusal["status"], body: ApiError): Refusal {
  return { ok: false, status, body }
}

export function readSave<S extends z.ZodType>(
  schema: S,
  form: z.output<typeof SaveForm>,
): Save<z.output<S>> {
  let json: unknown
  try {
    json = JSON.parse(form.data)
  } catch {
    return refuse(400, { error: "`data` is not valid JSON" })
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) return refuse(400, invalid(parsed.error))

  const photos =
    form.photos === undefined ? [] : Array.isArray(form.photos) ? form.photos : [form.photos]
  if (photos.length > MAX_PHOTOS) {
    return refuse(413, { error: `A save takes at most ${MAX_PHOTOS} new photos` })
  }
  for (const photo of photos) {
    if (!isImageType(photo.type)) {
      return refuse(415, { error: `A photo has to be a ${IMAGE_TYPE_NAMES}` })
    }
    if (photo.size > MAX_IMAGE_BYTES) {
      return refuse(413, { error: `A photo has to be under ${MAX_IMAGE_BYTES / 1_000_000} MB` })
    }
  }
  return { ok: true, data: parsed.data, photos }
}
