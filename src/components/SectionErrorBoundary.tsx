import React, { ReactNode, useCallback, useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorState } from './ErrorState';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Fallback heading — name the region ("We couldn't show these teachers"). */
  title?: string;
  /** Human copy: what failed + that the rest of the page is fine. No jargon, no "!". */
  message?: string;
  /**
   * External identity for this region (teacher id, active tab, filter key).
   * When it changes the boundary soft-resets, so a crash tied to the old
   * identity doesn't stick after the user navigates or re-filters.
   */
  resetKey?: string | number;
  /** Optional escape hatch rendered beside "Try again". */
  secondaryAction?: ReactNode;
}

/**
 * Isolates one independent page region: a render crash inside it shows a compact
 * retry card in place, instead of the whole route falling through to the
 * app-root boundary and blanking. Errors are still logged + sent to Sentry by
 * the underlying ErrorBoundary (componentDidCatch) — this only changes the
 * fallback UI.
 *
 * Catches unexpected render throws, NOT React Query fetch errors (each screen
 * already surfaces those in-band via <ErrorState onRetry={refetch}>).
 */
export function SectionErrorBoundary({
  children,
  title = 'This section failed to load',
  message = "Something went wrong here. The rest of the page still works. Try reloading just this part.",
  resetKey,
  secondaryAction,
}: SectionErrorBoundaryProps) {
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <ErrorBoundary
      key={nonce}
      resetKey={resetKey}
      fallback={
        <ErrorState
          title={title}
          message={message}
          onRetry={retry}
          secondaryAction={secondaryAction}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
}
