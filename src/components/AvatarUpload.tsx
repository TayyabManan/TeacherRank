import React, { useRef, useState } from 'react'
import { AvatarImage } from './AvatarImage'
import { Button } from './Button'
import { uploadTeacherAvatar } from '../lib/avatarUpload'
import { normalizeUrlInput } from '../lib/validation'

interface AvatarUploadProps {
  /** Current photo URL ('' when none). */
  value: string
  onChange: (url: string) => void
  /** Name used for the initials placeholder before a photo is set. */
  previewName?: string
  label?: string
  /** Validation error from the surrounding form (the field has no focusable
      ref, so a form-level error would otherwise be invisible). */
  formError?: string
}

/**
 * Controlled photo field: uploads an image file to Supabase Storage and reports
 * back the public URL, or accepts a pasted image link. Uploading is the primary
 * path — it works for every institute, including ones whose servers block
 * hotlinked/datacenter requests — but a direct link is offered as a lighter
 * alternative; the initials fallback in AvatarImage covers links that break.
 */
export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  value,
  onChange,
  previewName = 'Teacher',
  label = 'Photo',
  formError,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')

  const applyLink = () => {
    const trimmed = linkDraft.trim()
    if (!trimmed) return
    // An explicit non-web scheme (ftp:, data:, …) is a mistake — prefixing it
    // with https:// would silently store garbage like https://ftp://x.
    const hasNonWebScheme =
      /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)
    const normalized = hasNonWebScheme ? '' : normalizeUrlInput(trimmed)
    try {
      new URL(normalized)
    } catch {
      setError('Enter a full image link, like https://example.com/photo.jpg')
      return
    }
    setError(null)
    onChange(normalized)
    setShowLinkInput(false)
    setLinkDraft('')
  }

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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {value ? 'Change photo' : 'Upload photo'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowLinkInput(v => !v)
                setLinkDraft('')
              }}
            >
              Use image link
            </Button>
            {value && !uploading && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                Remove
              </Button>
            )}
          </div>
          {showLinkInput ? (
            <>
              <div className="flex flex-wrap gap-2">
                <input
                  type="url"
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // Apply the link instead of submitting the surrounding form.
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyLink()
                    }
                  }}
                  placeholder="https://example.com/photo.jpg"
                  className="input input-bordered input-sm flex-1 min-w-0 max-w-xs"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={applyLink}
                  disabled={!linkDraft.trim()}
                >
                  Use link
                </Button>
              </div>
              <p className="text-xs text-base-content/60">
                Uploading is more reliable — some institute sites block linked images.
              </p>
            </>
          ) : (
            <p className="text-xs text-base-content/60">JPG, PNG, or WebP, up to 4 MB.</p>
          )}
        </div>
      </div>
      {(error || formError) && (
        <p className="text-sm text-error mt-1">{error || formError}</p>
      )}
    </div>
  )
}
