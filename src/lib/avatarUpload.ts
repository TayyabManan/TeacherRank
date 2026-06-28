import { supabase } from './supabaseClient'

/** Public Supabase Storage bucket that holds teacher profile photos. */
export const AVATAR_BUCKET = 'teacher-avatars'

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

/**
 * Uploads a teacher's photo to Supabase Storage and returns its public CDN URL.
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

  const ext = EXT_BY_TYPE[file.type] ?? (file.name.split('.').pop()?.toLowerCase() || 'jpg')
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '604800',
    upsert: true,
  })

  if (error) {
    throw new Error("Couldn't upload that photo. Try again.")
  }

  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}
