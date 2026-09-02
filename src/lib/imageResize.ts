/**
 * Client-side avatar downscaling.
 *
 * Avatars render at 56–112 CSS px, yet uploads used to be stored verbatim (up
 * to 4 MB, one was 1.5 MB). Every listing view fetches 12 of them, so stored
 * bytes multiply straight into Storage egress. Shrinking to a small WebP at
 * upload time is the cheapest fix: ~10–30 kB per photo instead of hundreds.
 */

/** Longest edge of a stored avatar. 112 px × 3 dpr ≈ 336, rounded down. */
export const AVATAR_MAX_EDGE = 320
const WEBP_QUALITY = 0.82

export interface ResizedImage {
  blob: Blob
  contentType: string
  ext: string
}

/**
 * Downscales an image to fit within `AVATAR_MAX_EDGE` and re-encodes it as
 * WebP (JPEG where the browser can't encode WebP). Returns the original file
 * untouched for SVG (vector, already tiny) or when decoding/encoding fails —
 * a worse upload beats a failed one.
 */
export async function downscaleAvatar(file: File): Promise<ResizedImage> {
  const original: ResizedImage = { blob: file, contentType: file.type, ext: extFor(file) }
  if (file.type === 'image/svg+xml') return original

  try {
    const bitmap = await decode(file)
    const scale = Math.min(1, AVATAR_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(bitmap, 0, 0, width, height)
    if ('close' in bitmap) bitmap.close()

    const webp = await toBlob(canvas, 'image/webp', WEBP_QUALITY)
    if (webp && webp.type === 'image/webp') {
      return { blob: webp, contentType: 'image/webp', ext: 'webp' }
    }
    const jpeg = await toBlob(canvas, 'image/jpeg', WEBP_QUALITY)
    if (jpeg && jpeg.type === 'image/jpeg') {
      return { blob: jpeg, contentType: 'image/jpeg', ext: 'jpg' }
    }
    return original
  } catch {
    return original
  }
}

type Decoded = ImageBitmap | HTMLImageElement

async function decode(file: File): Promise<Decoded> {
  // createImageBitmap honours EXIF orientation with 'from-image' (default in
  // modern browsers); the <img> fallback covers browsers without it.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('decode failed'))
      img.src = url
    })
  } finally {
    // Revoke after the load settles; drawImage has already read the pixels by then.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function extFor(file: File): string {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  }
  return byType[file.type] ?? (file.name.split('.').pop()?.toLowerCase() || 'jpg')
}
