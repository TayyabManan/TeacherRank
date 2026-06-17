import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../utils/motion';

/**
 * Animate a number from its previous value to `end` (easeOutCubic) via a single
 * requestAnimationFrame loop — no library. On mount it counts up from 0; when
 * `end` changes (e.g. a stats refetch) it tweens from the current value.
 *
 * Reduced-motion safe: jumps straight to `end` with no animation. The rAF loop
 * is cancelled on unmount and whenever `end` changes.
 */
export function useCountUp(end: number, durationMs = 600): number {
  // Start at the final value under reduced motion (no flash); otherwise at 0 so
  // the first paint shows 0 and the rAF loop counts up to `end`.
  const [value, setValue] = useState(() => (prefersReducedMotion() ? end : 0));
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || durationMs <= 0) {
      fromRef.current = end;
      setValue(end);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(from + (end - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = end;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [end, durationMs]);

  return value;
}
