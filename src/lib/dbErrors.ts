// Maps raw Supabase/Postgres write errors to user-facing messages.
//
// The DB rate-limit triggers (migration 015) raise P0001 whose message is
// "MACHINE_TAG: friendly sentence" — we surface the sentence. A 23505 on
// uniq_ratings_anon_fingerprint means this device already has an anonymous
// review for the teacher (the client normally updates in place; this is the
// race-condition backstop).

const TRIGGER_TAGS = ['RATE_LIMITED', 'ANON_IP_LIMIT', 'ANON_TEACHER_LIMIT'];

interface DbErrorLike {
  code?: string;
  message?: string;
}

export function friendlyWriteError(error: unknown): string | null {
  const err = (error ?? {}) as DbErrorLike;
  const message = err.message ?? '';

  for (const tag of TRIGGER_TAGS) {
    const prefix = `${tag}: `;
    const idx = message.indexOf(prefix);
    if (idx !== -1) return message.slice(idx + prefix.length);
  }

  if (err.code === '23505' && message.includes('uniq_ratings_anon_fingerprint')) {
    return 'You have already reviewed this teacher from this device. You can submit a new review after 24 hours.';
  }

  return null;
}

/** Rethrow helper: friendly message when we have one, original otherwise. */
export function toFriendlyError(error: unknown): Error {
  const friendly = friendlyWriteError(error);
  if (friendly) return new Error(friendly);
  return error instanceof Error
    ? error
    : new Error((error as DbErrorLike)?.message || 'Something went wrong. Please try again.');
}
