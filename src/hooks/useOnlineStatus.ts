import { useSyncExternalStore } from 'react';

/**
 * Live browser connectivity flag. Subscribes to window online/offline events.
 * SSR-safe: the server snapshot is `true` (assume connected) so the first client
 * paint matches.
 *
 * `navigator.onLine` only means the OS has a network interface up — it can read
 * `true` behind a captive portal or dead uplink. Treat this as a hint for a
 * reassuring banner, never as a gate on data fetching (React Query owns
 * retry/error UI). See OfflineBanner.
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

const getSnapshot = (): boolean => navigator.onLine;
const getServerSnapshot = (): boolean => true;

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
