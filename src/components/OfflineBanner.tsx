import React, { useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOffIcon, CheckIcon } from './icons';

/**
 * Global connectivity strip. Sits at the bottom on the toast layer so it never
 * collides with the top-anchored toasts, and clears the mobile home indicator
 * via env(safe-area-inset-bottom). Offline → persistent error bar; on reconnect
 * → a brief success confirmation that auto-hides.
 *
 * Reassurance only — it does NOT block the app or gate fetching. React Query
 * owns retry/error UI, and navigator.onLine can lie (captive portals).
 *
 * The whole strip stays pointer-events-none (it has nothing to click): on the
 * rare first visit where the cookie-consent bar is still up AND the connection
 * drops, this pill overlaps that bar but taps pass straight through to its
 * buttons instead of being intercepted.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [visible, setVisible] = useState(!isOnline);
  const [mode, setMode] = useState<'offline' | 'reconnected'>(
    isOnline ? 'reconnected' : 'offline',
  );
  const wasOffline = useRef(!isOnline);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (!isOnline) {
      wasOffline.current = true;
      setMode('offline');
      setVisible(true);
    } else if (wasOffline.current) {
      // Only celebrate a reconnect if we were actually offline.
      setMode('reconnected');
      setVisible(true);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        wasOffline.current = false;
      }, 3000);
    }
    return () => clearTimeout(hideTimer.current);
  }, [isOnline]);

  const offline = mode === 'offline';

  return (
    <div
      role="status"
      aria-live={offline ? 'assertive' : 'polite'}
      className="fixed inset-x-0 bottom-0 z-toast flex justify-center px-4 pointer-events-none"
      style={{
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        transform: visible ? 'translateY(0)' : 'translateY(150%)',
        transition: 'transform var(--duration-moderate) var(--ease-out)',
      }}
    >
      <div
        className={`flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg border ${
          offline
            ? 'bg-error text-error-content border-error'
            : 'bg-success text-success-content border-success'
        }`}
      >
        <span className="flex-shrink-0" aria-hidden="true">
          {offline ? <WifiOffIcon className="w-5 h-5" /> : <CheckIcon className="w-5 h-5" />}
        </span>
        <p className="text-sm font-medium">
          {offline ? (
            <>
              <span className="font-semibold">You're offline.</span>{' '}
              Changes won't save until the connection is back.
            </>
          ) : (
            "Back online."
          )}
        </p>
      </div>
    </div>
  );
}
