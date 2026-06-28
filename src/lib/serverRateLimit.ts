import { supabase } from './supabaseClient'

// Server-side rate limiting via the Supabase edge function `rate-limit-enforcer`
// (DB-backed sliding window). This is the real enforcement — the in-memory
// client limiter in rateLimit.ts is per-tab and trivially bypassed.
//
// The enforcer authenticates the caller from their Bearer token, so it only
// gates AUTHENTICATED actions. Pre-auth abuse (sign-in/sign-up brute force)
// must be limited at the Supabase GoTrue layer (dashboard settings).

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rate-limit-enforcer`
const ENABLED = import.meta.env.VITE_USE_EDGE_RATE_LIMIT === 'true'

export type RateLimitAction =
  | 'createRating'
  | 'updateRating'
  | 'deleteRating'
  | 'createTeacher'
  | 'updateTeacher'
  | 'deleteTeacher'
  | 'search'
  | 'feedback'

/**
 * Throws if the current user is over the limit for `action`. Fail-open: when the
 * feature flag is off, the user is unauthenticated, or the function is
 * unreachable, it allows the request (we never block real users on infra issues).
 */
export async function checkServerRateLimit(action: RateLimitAction): Promise<void> {
  if (!ENABLED) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return // enforcer requires a token; nothing to check for guests

  let res: Response
  try {
    res = await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    })
  } catch {
    return // network/CORS error → fail open
  }

  if (res.status === 429) {
    const body = await res.json().catch(() => ({} as { error?: string }))
    throw new Error(body.error || 'Too many requests. Please slow down and try again.')
  }
}
