import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../utils/motion'

/**
 * Reveal-on-scroll, once. Returns a ref to attach to the target element.
 *
 * Safety by design — the element is NEVER hidden by static markup:
 *  - The `reveal-pending` (hidden) class is added by JS only, so if JS fails or
 *    is blocked, the element renders normally and stays visible.
 *  - Under reduced motion or when IntersectionObserver is unsupported, the
 *    element is shown immediately (no pending state).
 *  - It animates a single time, then disconnects the observer.
 *
 * Apply sparingly — section headings / feature blocks, not every element.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Bail to visible: motion reduced or IO unsupported.
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.classList.remove('reveal-pending')
      el.classList.add('reveal-in')
      return
    }

    // We're animating: hide now (added here, not in markup, so no-JS == visible).
    el.classList.add('reveal-pending')

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('reveal-in')
            el.classList.remove('reveal-pending')
            io.disconnect() // once only
          }
        }
      },
      { threshold: 0.15 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

  return ref
}
