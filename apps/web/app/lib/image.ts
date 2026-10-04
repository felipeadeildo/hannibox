import { MAX_IMAGE_BYTES, isImageType } from "@hannibox/shared"

const MAX_SIDE = 1600

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality))
}

/**
 * Makes a photo fit what the API takes. The database keeps images in a row that stops at 2 MB,
 * so a phone photo is scaled down here and saved as WebP. A small one goes as it is.
 */
export async function shrinkImage(file: File) {
  if (isImageType(file.type) && file.size <= MAX_IMAGE_BYTES / 2) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error("That file is not an image this browser can read")

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  for (const quality of [0.86, 0.72, 0.58, 0.45]) {
    const blob = await toBlob(canvas, quality)
    if (blob && blob.size <= MAX_IMAGE_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, "") || "photo"
      return new File([blob], `${name}.webp`, { type: "image/webp" })
    }
  }
  throw new Error("That image is too large, even after shrinking it")
}
