/**
 * Motion utilities — JS-side source of truth for the reduced-motion preference
 * and animation durations. The MOTION values MUST stay in sync with the CSS
 * duration tokens in src/styles.css and the keyframe durations in
 * src/styles/animations.css; if they drift, exit-animation fallback timers fire
 * too early (cutting the animation) or too late (laggy unmount).
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Read the OS/browser reduced-motion preference. SSR-safe (defaults to false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Durations in milliseconds, mirroring the CSS tokens. */
export const MOTION = {
  /** Modal enter/exit — matches .duration-300 / --duration-moderate */
  modal: 300,
  /** Toast enter — matches --duration-moderate */
  toastIn: 300,
  /** Toast exit — matches --duration-normal */
  toastOut: 200,
  /** Route transition — fade + rise */
  page: 240,
  /** Scroll reveal */
  reveal: 450,
} as const

export { REDUCED_MOTION_QUERY }
