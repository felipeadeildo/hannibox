import { type ApiError, IMAGE_TYPE_NAMES, type ImageType, MAX_IMAGE_BYTES } from "@hannibox/shared"

/** An uploaded photo as it is stored: its bytes and the type they turned out to be. */
export type Photo = { content: Uint8Array<ArrayBuffer>; mimeType: ImageType }

export type PhotoRead =
  | { ok: true; photo: Photo }
  | { ok: false; status: 413 | 415; body: ApiError }

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0))
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

/**
 * What an image is, read from its first bytes. The type an upload declares is only what the client
 * says, and the image route serves the stored one with `nosniff`, so the browser believes it.
 */
export function imageTypeOf(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif"
  // A RIFF container whose form type, after the 4-byte size, is WEBP.
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp"
  return null
}

/** Reads an uploaded photo and tells what it really is, or why it is refused. */
export async function readPhoto(file: File): Promise<PhotoRead> {
  // The size is known without reading the bytes, so it goes first.
  if (file.size > MAX_IMAGE_BYTES) {
    const error = `A photo has to be under ${MAX_IMAGE_BYTES / 1_000_000} MB`
    return { ok: false, status: 413, body: { error } }
  }
  const content = new Uint8Array(await file.arrayBuffer())
  const mimeType = imageTypeOf(content)
  if (!mimeType) {
    return { ok: false, status: 415, body: { error: `A photo has to be a ${IMAGE_TYPE_NAMES}` } }
  }
  return { ok: true, photo: { content, mimeType } }
}
