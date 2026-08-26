import React from 'react'
import { getInitials, avatarTint } from '../lib/avatar'

interface InitialsAvatarProps {
  name: string
  /** Diameter in px. */
  size?: number
  className?: string
  /** Font size in px; defaults to ~40% of size. */
  fontSize?: number
}

/**
 * Initials on a deterministic, theme-token tint. Decorative by default
 * (`aria-hidden`) — the surrounding context (card name, account label) carries
 * the accessible name. Renders locally, so it never makes a network request.
 */
export const InitialsAvatar = React.memo<InitialsAvatarProps>(({
  name,
  size = 64,
  className = '',
  fontSize,
}) => (
  // Two layers: an opaque base-100 disc under the translucent tint. On normal
  // card surfaces (base-100) this composites identically to the old single
  // div — but on colored surfaces it keeps the initials visible: the profile
  // hero is solid bg-primary, and the ~1-in-6 names whose hash lands on the
  // primary tint rendered violet-on-violet, i.e. an empty circle.
  <div
    aria-hidden="true"
    className={`rounded-full bg-base-100 ${className}`}
    style={{ width: size, height: size }}
  >
    <div
      className={`flex h-full w-full items-center justify-center rounded-full font-semibold leading-none select-none ${avatarTint(name)}`}
      style={{ fontSize: fontSize ?? Math.round(size * 0.4) }}
    >
      {getInitials(name)}
    </div>
  </div>
))

InitialsAvatar.displayName = 'InitialsAvatar'
