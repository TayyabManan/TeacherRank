import { useCallback, useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../utils/motion'

export type PresenceStatus = 'entering' | 'entered' | 'exiting'

interface UsePresenceOptions {
  /** Fallback unmount duration in ms — must be >= the CSS exit animation duration. */
  duration: number
  /** Called after the element has fully unmounted (real exit complete). */
  onExited?: () => void
}

interface UsePresenceResult {
  /** Render the element while true. */
  shouldRender: boolean
  /** Drives which enter/exit classes to apply. */
  status: PresenceStatus
  /**
   * Attach to the animated element. Unmount is driven off this node's own
   * `animationend`, with a timer fallback if the event never fires.
   */
  ref: (node: HTMLElement | null) => void
}

/**
 * Keep an element mounted long enough to play an exit animation before it
 * unmounts. CSS-driven, no animation library.
 *
 * - Opening: mounts immediately, flips entering -> entered on the next frame.
 * - Closing: keeps mounted with status 'exiting', then unmounts when the
 *   tracked node's `animationend` fires OR a `duration + 60ms` fallback elapses.
 * - Reduced motion: unmounts synchronously (no exit phase), so logic never
 *   depends on a 0.01ms animation actually firing.
 */
export function usePresence(
  isOpen: boolean,
  { duration, onExited }: UsePresenceOptions,
): UsePresenceResult {
  const reduced = prefersReducedMotion()
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [status, setStatus] = useState<PresenceStatus>(isOpen ? 'entered' : 'exiting')

  const nodeRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onExitedRef = useRef(onExited)
  onExitedRef.current = onExited

  const finishExit = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShouldRender(false)
    onExitedRef.current?.()
  }, [])

  // Callback ref keeps a handle on the latest DOM node for the animationend listener.
  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node
  }, [])

  useEffect(() => {
    if (isOpen) {
      // OPENING: ensure mounted, run the enter animation.
      if (timerRef.current) clearTimeout(timerRef.current)
      setShouldRender(true)
      setStatus('entering')
      const raf = requestAnimationFrame(() => setStatus('entered'))
      return () => cancelAnimationFrame(raf)
    }

    // CLOSING
    if (!shouldRender) return // already unmounted

    if (reduced) {
      finishExit() // skip the exit animation entirely
      return
    }

    setStatus('exiting')

    const node = nodeRef.current
    const onAnimEnd = (e: AnimationEvent) => {
      // Ignore animationend bubbling up from child elements (backdrop, content).
      if (e.target === node) finishExit()
    }
    node?.addEventListener('animationend', onAnimEnd)

    // Fallback: animationend may be missed (no animation applied, display:none,
    // reduced-motion 0.01ms races). Whichever fires first wins; finishExit is idempotent.
    timerRef.current = setTimeout(finishExit, duration + 60)

    return () => {
      node?.removeEventListener('animationend', onAnimEnd)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reduced, duration, finishExit])

  return { shouldRender, status, ref }
}
