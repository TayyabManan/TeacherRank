// Local, deterministic avatar fallback — no network, consistent per name, theme-aware.
// Used by AvatarImage (no-photo / load-error fallback) and the sidebar account chip.

/** 1–2 uppercase letters from a name (or email-ish string). Never empty. */
export function getInitials(name: string): string {
  // Bilingual teachers are stored as "ליאל דדון (Liel Dadon)" (see CLAUDE.md).
  // Initials come from the primary (leading) name only — including the
  // parenthetical produced mixed-script pairs like "לD".
  const primary = name.replace(/\([^)]*\)/g, ' ')
  const parts = primary.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// A small, restrained set drawn from existing DaisyUI semantic tokens so the
// fallback stays on-brand in both themes. The same name always lands here.
const TINTS = [
  'bg-primary/10 text-primary',
  'bg-accent/10 text-accent',
  'bg-info/10 text-info',
  'bg-success/10 text-success',
  'bg-warning/15 text-warning',
  'bg-secondary text-base-content',
] as const

/** Deterministic tint classes for a given name. */
export function avatarTint(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return TINTS[Math.abs(hash) % TINTS.length]
}
