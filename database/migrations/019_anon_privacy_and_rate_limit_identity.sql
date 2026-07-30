-- Migration 019: stop publishing anonymous reviewers' device fingerprints, and
-- make the rate-limit trigger's identity non-spoofable.
--
-- Two findings from the 2026-07-30 security review, both verified:
--
-- 1. PRIVACY (verified live against production with the public anon key):
--        GET /rest/v1/ratings?select=metadata
--        -> 200 [{"metadata":{"timestamp":...,"fingerprint":"7tl30k"}}, ...]
--    `ratings.metadata` holds the anonymous reviewer's device fingerprint and
--    anon holds table-wide SELECT, so anyone can group every "anonymous" review
--    by device across every teacher — a public join key on a platform whose FAQ
--    promises anonymity. It also makes uniq_ratings_anon_fingerprint decorative:
--    the index constrains a value the client supplies, so rotating it defeats
--    the dedupe entirely.
--    RLS is row-level and cannot hide a column; this needs column-level GRANTs.
--
-- 2. RATE LIMITING (verified by reading 015): enforce_rate_limit derived
--    identity as
--        ip := nullif(trim(split_part(xff, ',', 1)), '');
--        me := COALESCE(uid::text, 'ip:' || ip);
--        IF me IS NULL THEN RETURN NEW; END IF;
--    In Postgres `'ip:' || NULL` is NULL, so an anonymous caller whose FIRST
--    x-forwarded-for hop is blank got `me = NULL` and the function returned
--    before every check — hourly cap, the 1-per-IP-per-teacher-per-24h anon cap
--    and the 20-per-teacher-per-hour backstop — and before the audit INSERT, so
--    it left no trace. Taking hop 1 is also the wrong end: under append
--    semantics that is the client-supplied value, so a caller could rotate
--    identity per request with a header.
--
-- Apply order note: section 1 depends on the app change that stopped selecting
-- `metadata` (useRatings.ts) and on get_anon_rating_id below. Deploy the app
-- first, then run this — otherwise the anonymous re-review path errors between
-- the two.

-- ---------------------------------------------------------------------------
-- 1. Column-level SELECT on public.ratings
-- ---------------------------------------------------------------------------
-- `metadata` (device fingerprint) and `session_id` (an identifier column,
-- currently unwritten) are withheld from both roles. `flagged_by` is withheld
-- because it names the moderating admin.

REVOKE SELECT ON public.ratings FROM anon, authenticated;

GRANT SELECT (
  id, teacher_id, student_id, score, comment,
  created_at, updated_at, is_anonymous
) ON public.ratings TO anon;

-- Admin screens read moderation state; those users are `authenticated`. RLS is
-- row-level, so this does expose flag state to any signed-in user — acceptable
-- (it is not identifying) and it keeps the Admin reviews tab working.
GRANT SELECT (
  id, teacher_id, student_id, score, comment,
  created_at, updated_at, is_anonymous,
  flagged, flagged_reason, flagged_at
) ON public.ratings TO authenticated;

-- INSERT/UPDATE privileges are deliberately untouched: the client still WRITES
-- metadata (it is how a device reclaims its own row), it just can no longer
-- READ the column.

-- ---------------------------------------------------------------------------
-- 2. Server-side fingerprint lookup
-- ---------------------------------------------------------------------------
-- Postgres requires SELECT privilege on any column used in a WHERE clause, so
-- revoking `metadata` also breaks the client's
--     .eq('metadata->>fingerprint', fingerprint)
-- lookup that lets a device edit its own prior anonymous review instead of
-- being rejected as a duplicate. This function restores exactly that one
-- capability without exposing the column.
--
-- It returns only an id the caller could already read, and the caller must
-- already know the fingerprint (their own device's), so it does not enable the
-- bulk grouping that the column exposure did.

CREATE OR REPLACE FUNCTION public.get_anon_rating_id(
  p_teacher_id uuid,
  p_fingerprint text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $fn$
  SELECT r.id
  FROM public.ratings r
  WHERE r.teacher_id = p_teacher_id
    AND r.student_id IS NULL
    AND r.metadata->>'fingerprint' = p_fingerprint
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.get_anon_rating_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_anon_rating_id(uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_anon_rating_id(uuid, text) IS
  'Returns this device''s prior anonymous rating id for a teacher. Exists so the client can find its own row without SELECT on ratings.metadata (migration 019).';

-- ---------------------------------------------------------------------------
-- 3. Non-spoofable identity + no fail-open, and limit UPDATEs too
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $fn$
DECLARE
  headers text;
  uid uuid;
  xff text;
  hops text[];
  ip text;
  me text;
  hourly_cap integer;
  is_anon_rating boolean := false;
  rating_teacher uuid;
BEGIN
  headers := current_setting('request.headers', true);

  -- Genuinely no request context (direct SQL, service tooling, migrations):
  -- don't gate. This is the ONLY fail-open, and it cannot be reached over
  -- PostgREST — where headers are always present.
  IF headers IS NULL THEN
    RETURN NEW;
  END IF;

  uid := auth.uid();
  xff := headers::jsonb->>'x-forwarded-for';

  -- Rightmost hop: the one the edge appended. The leftmost is whatever the
  -- client sent and is therefore attacker-controlled.
  IF xff IS NOT NULL AND btrim(xff) <> '' THEN
    hops := string_to_array(xff, ',');
    ip := nullif(btrim(hops[array_length(hops, 1)]), '');
  END IF;

  -- Never NULL for a PostgREST request. An anonymous caller we cannot place
  -- shares one bucket rather than escaping the limiter entirely.
  me := COALESCE(uid::text, 'ip:' || COALESCE(ip, 'unknown'));

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

    -- The per-teacher anon caps are about creating DISTINCT reviews. Applying
    -- them to UPDATE would block a device from editing the single review it is
    -- allowed to have, so they are INSERT-only; the hourly velocity cap above
    -- still applies to both.
    IF TG_OP = 'INSERT' AND NEW.student_id IS NULL THEN
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
    ELSIF NEW.student_id IS NULL THEN
      is_anon_rating := true;
    END IF;
  END IF;

  INSERT INTO public.rate_limit_events (identity, kind, teacher_id, is_anon)
  VALUES (me, TG_TABLE_NAME, rating_teacher, is_anon_rating);

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.enforce_rate_limit() IS
  'BEFORE INSERT/UPDATE write limiter on ratings (INSERT only on feedback/teacher_submission_requests). Identity = auth.uid() else the RIGHTMOST x-forwarded-for hop, never NULL for a PostgREST request. SECURITY DEFINER so it can write rate_limit_events (RLS-locked).';

-- ratings previously had no UPDATE limiter at all, which left the anonymous
-- edit path (useRatings rewrites score/comment via UPDATE) entirely unbounded.
DROP TRIGGER IF EXISTS rate_limit_ratings ON public.ratings;
CREATE TRIGGER rate_limit_ratings
BEFORE INSERT OR UPDATE OF score, comment ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit();

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verification (run after)
-- ---------------------------------------------------------------------------
--   1. metadata is no longer readable (expect permission denied / no column):
--        curl "$URL/rest/v1/ratings?select=metadata&limit=1" -H "apikey: $ANON"
--      and the public columns still work:
--        curl "$URL/rest/v1/ratings?select=id,score,comment&limit=1" -H "apikey: $ANON"
--
--   2. Column grants are what we expect:
--        SELECT grantee, privilege_type, column_name
--        FROM information_schema.column_privileges
--        WHERE table_schema='public' AND table_name='ratings'
--          AND grantee IN ('anon','authenticated') AND privilege_type='SELECT'
--        ORDER BY grantee, column_name;
--      -> `metadata`, `session_id`, `flagged_by` must NOT appear.
--
--   3. The lookup RPC still finds a device's own row:
--        SELECT public.get_anon_rating_id('<teacher uuid>', '<fingerprint>');
--
--   4. Rate limiting no longer fails open. From a signed-out client:
--        POST /rest/v1/ratings  with  'X-Forwarded-For: '        (blank)
--      then confirm a row WAS written:
--        SELECT identity, kind, created_at FROM public.rate_limit_events
--        ORDER BY created_at DESC LIMIT 5;
--      -> expect an 'ip:...' or 'ip:unknown' identity. Before this migration
--         that insert produced no row at all.
--
--   5. Anonymous review editing still works end to end (submit anonymously,
--      then submit again from the same device — it must UPDATE, not error).
