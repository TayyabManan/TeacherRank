import React, { useRef, useState } from 'react'
import { AvatarImage } from './AvatarImage'
import { Button } from './Button'
import { uploadTeacherAvatar } from '../lib/avatarUpload'

interface AvatarUploadProps {
  /** Current photo URL ('' when none). */
  value: string
  onChange: (url: string) => void
  /** Name used for the initials placeholder before a photo is set. */
  previewName?: string
  label?: string
}

/**
 * Controlled photo field: uploads an image file to Supabase Storage and reports
 * back the public URL. Replaces the old "paste an image URL" input — a stored
 * file is the only source that works for every institute, including ones whose
 * servers block our production/datacenter requests.
 */
export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  value,
  onChange,
  previewName = 'Teacher',
  label = 'Photo',
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the user re-pick the same file after an error
    if (!file) return

    setError(null)
    setUploading(true)
    try {
      const url = await uploadTeacherAvatar(file)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo. Try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <div className="flex items-center gap-4">
        <AvatarImage src={value || undefined} name={previewName} size={64} loading="eager" />
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {value ? 'Change photo' : 'Upload photo'}
            </Button>
            {value && !uploading && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-base-content/60">JPG, PNG, or WebP, up to 4 MB.</p>
        </div>
      </div>
      {error && <p className="text-sm text-error mt-1">{error}</p>}
    </div>
  )
}
