-- Migration 015: DB-enforced write rate limits + anonymous-rating abuse caps
--
-- Replaces the flag-off/fail-open edge-function rate limiter with enforcement
-- that cannot be bypassed by calling PostgREST directly: a BEFORE INSERT
-- trigger on the three public-writable tables.
--
-- Identity: auth.uid() for signed-in users, else the first x-forwarded-for
-- hop. Header visibility in the REST path was verified 2026-07-10 via a
-- PostgREST probe (current_setting('request.headers')::jsonb->>'x-forwarded-for'
-- returned the caller's real IP).
--
-- Limits (windows are rolling):
--   ratings                      10 / hour / identity
--   feedback                      5 / hour / identity
--   teacher_submission_requests   3 / hour / identity
--   anonymous ratings:  1 / 24 h / IP / teacher, plus a 20 anon ratings /
--                       teacher / hour backstop regardless of IP (campus-NAT
--                       generous), plus a device-level unique index on
--                       (teacher_id, fingerprint).
--
-- Client follow-ups (same phase): delete src/lib/serverRateLimit.ts and call
-- sites; delete supabase/functions/rate-limiter + rate-limit-enforcer; map
-- P0001 / fingerprint-23505 to friendly messages; keep src/lib/rateLimit.ts
-- as a UX pre-check only.

-- 0. Remove the temporary header probe (created during verification)
DROP FUNCTION IF EXISTS public.probe_request_headers_tmp();

-- 1. Event log the trigger counts against. RLS on, zero policies: only the
--    SECURITY DEFINER trigger function reads/writes it.
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identity text NOT NULL,
  kind text NOT NULL,
  teacher_id uuid,
  is_anon boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_identity
  ON public.rate_limit_events (kind, identity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_teacher
  ON public.rate_limit_events (teacher_id, created_at DESC)
  WHERE is_anon;

-- 2. The enforcement trigger
CREATE OR REPLACE FUNCTION public.enforce_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $fn$
DECLARE
  uid uuid;
  ip text;
  me text;
  hourly_cap integer;
  is_anon_rating boolean := false;
  rating_teacher uuid;
BEGIN
  uid := auth.uid();
  ip := nullif(trim(split_part(
          current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ',', 1)), '');
  me := COALESCE(uid::text, 'ip:' || ip);

  -- No identity at all (direct SQL / service tooling): don't gate.
  IF me IS NULL THEN
    RETURN NEW;
  END IF;

  hourly_cap := CASE TG_TABLE_NAME
    WHEN 'ratings' THEN 10
    WHEN 'feedback' THEN 5
    WHEN 'teacher_submission_requests' THEN 3
  END;

  IF (SELECT count(*) FROM public.rate_limit_events e
      WHERE e.kind = TG_TABLE_NAME AND e.identity = me
        AND e.created_at > now() - interval '1 hour') >= hourly_cap THEN
    RAISE EXCEPTION 'RATE_LIMITED: Too many submissions. Please wait a while and try again.';
  END IF;

  -- NEW.student_id / NEW.teacher_id exist only on ratings rows; referencing
  -- them in expressions reached for feedback / teacher_submission_requests
  -- raises 42703, so all row-field access stays inside this block.
  IF TG_TABLE_NAME = 'ratings' THEN
    rating_teacher := NEW.teacher_id;

    IF NEW.student_id IS NULL THEN
      is_anon_rating := true;

      -- One anonymous review per IP per teacher per 24 h
      IF ip IS NOT NULL AND (SELECT count(*) FROM public.rate_limit_events e
          WHERE e.kind = 'ratings' AND e.is_anon
            AND e.identity = 'ip:' || ip AND e.teacher_id = rating_teacher
            AND e.created_at > now() - interval '24 hours') >= 1 THEN
        RAISE EXCEPTION 'ANON_IP_LIMIT: An anonymous review for this teacher was already submitted from your network today. Sign in to add your own review.';
      END IF;

      -- Velocity backstop: 20 anonymous reviews per teacher per hour, any IP
      IF (SELECT count(*) FROM public.rate_limit_events e
          WHERE e.kind = 'ratings' AND e.is_anon AND e.teacher_id = rating_teacher
            AND e.created_at > now() - interval '1 hour') >= 20 THEN
        RAISE EXCEPTION 'ANON_TEACHER_LIMIT: This teacher is getting an unusual number of anonymous reviews right now. Please try again later, or sign in to review.';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.rate_limit_events (identity, kind, teacher_id, is_anon)
  VALUES (me, TG_TABLE_NAME, rating_teacher, is_anon_rating);

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.enforce_rate_limit() IS
  'BEFORE INSERT write limiter on ratings/feedback/teacher_submission_requests. Identity = auth.uid() else first x-forwarded-for hop. SECURITY DEFINER so it can write rate_limit_events (RLS-locked).';

DROP TRIGGER IF EXISTS rate_limit_ratings ON public.ratings;
CREATE TRIGGER rate_limit_ratings
BEFORE INSERT ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit();

DROP TRIGGER IF EXISTS rate_limit_feedback ON public.feedback;
CREATE TRIGGER rate_limit_feedback
BEFORE INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit();

DROP TRIGGER IF EXISTS rate_limit_teacher_requests ON public.teacher_submission_requests;
CREATE TRIGGER rate_limit_teacher_requests
BEFORE INSERT ON public.teacher_submission_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit();

-- 3. Device-level anon dedupe: the client already reuses this device's prior
--    anonymous row, but only best-effort — make it a real constraint.
--    (Verified 2026-07-10: no existing duplicate (teacher_id, fingerprint)
--    pairs, so the index creates cleanly.)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ratings_anon_fingerprint
  ON public.ratings (teacher_id, (metadata->>'fingerprint'))
  WHERE student_id IS NULL AND metadata->>'fingerprint' IS NOT NULL;

-- 4. Retire the old edge-function rate-limiter storage
DROP TABLE IF EXISTS public.rate_limit_logs;
DROP TABLE IF EXISTS public.rate_limits;
DROP FUNCTION IF EXISTS public.cleanup_old_rate_limits();

-- 5. Daily cleanup of expired events (longest window is 24 h; keep 2 days)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'cleanup_rate_limit_events',
  '17 3 * * *',
  $$DELETE FROM public.rate_limit_events WHERE created_at < now() - interval '2 days'$$
);

-- Verification (run after):
--   1. SELECT jobname, schedule FROM cron.job;  → cleanup_rate_limit_events
--   2. 11th rapid POST /rest/v1/ratings as one identity → 400 with
--      'RATE_LIMITED: ...' (P0001).
--   3. Second anon rating for the same teacher+fingerprint → 23505 on
--      uniq_ratings_anon_fingerprint.
