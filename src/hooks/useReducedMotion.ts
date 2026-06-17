import { useSyncExternalStore } from 'react'
import { REDUCED_MOTION_QUERY } from '../utils/motion'

/**
 * Reactive reduced-motion preference. Re-renders the consumer if the user flips
 * the OS setting mid-session. Uses useSyncExternalStore so the matchMedia
 * subscription is StrictMode-safe (no double-subscribe / leak in dev).
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia(REDUCED_MOTION_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
