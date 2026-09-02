import { supabase } from './supabaseClient'
import { downscaleAvatar } from './imageResize'

/** Public Supabase Storage bucket that holds teacher profile photos. */
export const AVATAR_BUCKET = 'teacher-avatars'

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB (pre-resize; what we store is far smaller)

/**
 * Objects are addressed by a fresh UUID and never rewritten, so browsers and
 * the CDN may keep them for a year. (Was 7 days, which made every returning
 * visitor and every CDN edge re-download the whole grid weekly.)
 */
export const AVATAR_CACHE_CONTROL = '31536000'

/**
 * Uploads a teacher's photo to Supabase Storage and returns its public CDN URL.
 *
 * The file is downscaled to a small WebP first (see imageResize.ts): Storage
 * egress is billed per byte served, and avatars are drawn at ≤112 px.
 *
 * We host the file ourselves rather than hot-linking an institute URL: some
 * institute servers (e.g. comsats.edu.pk) block datacenter IPs, so their images
 * can't be fetched from production at all — only a stored copy is reliable.
 *
 * Throws an Error with a user-facing message on invalid input or upload failure.
 */
export async function uploadTeacherAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error("That file isn't an image. Choose a JPG, PNG, or WebP.")
  }
  if (file.size > MAX_BYTES) {
    throw new Error('That image is over 4 MB. Pick a smaller file.')
  }

  const { blob, contentType, ext } = await downscaleAvatar(file)
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType,
    cacheControl: AVATAR_CACHE_CONTROL,
    upsert: true,
  })

  if (error) {
    throw new Error("Couldn't upload that photo. Try again.")
  }

  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}
