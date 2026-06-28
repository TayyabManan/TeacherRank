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
  <div
    aria-hidden="true"
    className={`flex items-center justify-center rounded-full font-semibold leading-none select-none ${avatarTint(name)} ${className}`}
    style={{ width: size, height: size, fontSize: fontSize ?? Math.round(size * 0.4) }}
  >
    {getInitials(name)}
  </div>
))

InitialsAvatar.displayName = 'InitialsAvatar'
