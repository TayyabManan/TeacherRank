import { useCountUp } from '../hooks/useCountUp';

interface CountUpProps {
  /** Target value to count up to. */
  end: number;
  /** Decimal places to render (default 0). */
  decimals?: number;
  /** Text appended after the number, e.g. "★" or "%". */
  suffix?: string;
  /** Tween duration in ms (default 600). */
  durationMs?: number;
}

/**
 * Renders a number that animates from its previous value to `end`. Pure display
 * wrapper around useCountUp — reduced-motion safe (shows the final value at once).
 */
export function CountUp({ end, decimals = 0, suffix = '', durationMs = 600 }: CountUpProps) {
  const value = useCountUp(end, durationMs);
  return (
    <>
      {value.toFixed(decimals)}
      {suffix}
    </>
  );
}
