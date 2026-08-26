-- Migration 021: restore the anonymous re-review path, and put the ratings
-- WRITE policies under source control.
--
-- ---------------------------------------------------------------------------
-- PRIMARY DRIVER: anonymous re-review is BROKEN IN PRODUCTION right now.
-- ---------------------------------------------------------------------------
-- Verified against prod with the public anon key on 2026-08-26:
--     GET   /rest/v1/ratings?select=metadata            -> 401  (019 applied)
--     POST  /rest/v1/rpc/get_anon_rating_id             -> 200  (019 applied)
--     PATCH /rest/v1/ratings?id=eq.<real anon row>      -> 42501 permission denied
--     DELETE /rest/v1/ratings?id=eq.<real anon row>     -> 42501 permission denied
--
-- The client's anonymous re-review path (useRatings.ts) is a two-step: look
-- the row up with get_anon_rating_id, then UPDATE it by id. Since 019 went in,
-- step 1 succeeds and step 2 is refused — `anon` holds no UPDATE on ratings.
-- So a device that already reviewed a teacher now gets an error instead of
-- editing its review. (Before 019 the lookup 404'd, the client fell through to
-- INSERT, and the unique fingerprint index caught the duplicate — different
-- symptom, also wrong.)
--
-- update_anon_rating() below fixes this properly: it verifies the fingerprint
-- SERVER-side and performs the update itself, as SECURITY DEFINER, so anon
-- needs no UPDATE grant at all.
--
-- ---------------------------------------------------------------------------
-- SECONDARY: the ratings policy set exists nowhere in this repo.
-- ---------------------------------------------------------------------------
-- The original 001–007 scripts were deleted 2025-10-22 and 008 deliberately
-- left ratings alone, so the live policies are an unreviewable Sept-2025
-- dashboard-script mix. This migration is the 008 treatment for the WRITE
-- side: drop what is live, rebuild the documented posture, keep it here.
--
-- NOTE ON A CLAIM THIS FILE ORIGINALLY MADE: the 2026-08-26 audit hypothesized
-- that anon could rewrite ANY anonymous review by id (rating ids are public),
-- reasoning backwards from the fact that the client's UPDATE-by-id path must
-- have been permitted for it to ever work. The probes above REFUTE that for
-- the current database — anon holds no UPDATE, so the hole is not open. It was
-- open at some point (the client path did work), and nothing in source control
-- would stop it being reopened by the next dashboard script. That is precisely
-- what this migration fixes: the posture becomes reviewable and re-appliable
-- instead of being whatever a console session last left behind.
--
-- What changes:
--   * anon UPDATE/DELETE stay revoked, now explicitly and in source control
--     (currently true only by accident of an unrecorded change).
--   * authenticated UPDATE/DELETE narrows to own rows, or admin.
--   * INSERT requires student_id = auth.uid() or NULL — a signed-in user can
--     no longer insert a rating attributed to someone else.
--   * flagged / flagged_reason / flagged_at / flagged_by become admin-only to
--     change (BEFORE UPDATE trigger). Defence in depth: RLS lets a user update
--     their own row, and column-level grants cannot separate admins from other
--     authenticated users, so without this a user could clear the flag on
--     their own moderated review. (Not verified as exploitable — testing it
--     needs a signed-in non-admin session.)
--
-- SELECT grants are deliberately NOT touched — migration 019 (applied) owns
-- the column-level SELECT story.
--
-- ⚠ APP PREREQUISITE (same commit as this file): useRatings.ts must be
-- deployed FIRST. The new client prefers update_anon_rating() and falls back
-- to the legacy direct UPDATE only while this migration is unapplied
-- (PGRST202). Deploying the app first is safe and is what un-breaks the flow;
-- applying this under the OLD client leaves anonymous re-review broken exactly
-- as it is today.

BEGIN;

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 1. Clean slate: drop EVERY existing policy on ratings. The live set is a
--    Sept-2025 dashboard-script mix that exists nowhere in source control, so
--    rebuilding beats patching (same rationale as 008).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ratings'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.ratings', pol.policyname);
    RAISE NOTICE 'Dropped policy % on ratings', pol.policyname;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The documented posture.
--    SELECT: public (column visibility is 019's column-level grants).
--    INSERT: yourself or anonymous — never as another user. The 015/019
--            BEFORE INSERT trigger enforces the abuse caps.
--    UPDATE/DELETE: own rows, or admin. `anon` has neither; the fingerprint-
--            checked RPC below is the only anonymous edit path.
-- ---------------------------------------------------------------------------
CREATE POLICY "ratings_select_public" ON public.ratings
  FOR SELECT USING (true);

CREATE POLICY "ratings_insert_self_or_anon" ON public.ratings
  FOR INSERT WITH CHECK (student_id IS NULL OR student_id = auth.uid());

CREATE POLICY "ratings_update_own_or_admin" ON public.ratings
  FOR UPDATE
  USING (student_id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (student_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "ratings_delete_own_or_admin" ON public.ratings
  FOR DELETE USING (student_id = auth.uid() OR is_admin(auth.uid()));

-- Belt and braces at the grant level: the policies above already return no
-- rows for anon, but revoking makes the posture probe-able (a PATCH/DELETE as
-- anon now 42501s instead of silently matching zero rows).
REVOKE UPDATE, DELETE ON public.ratings FROM anon;
GRANT INSERT ON public.ratings TO anon, authenticated;
GRANT UPDATE, DELETE ON public.ratings TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. The anonymous edit path: fingerprint verified where the client can't lie.
--    Mirrors get_anon_rating_id (019) but performs the write itself, so the
--    proof-of-device and the update can no longer be separated.
--    SECURITY DEFINER: anon has no UPDATE grant; triggers (rate limit, stats,
--    moderation guard) still fire on the row change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_anon_rating(
  p_teacher_id uuid,
  p_fingerprint text,
  p_score numeric,
  p_comment text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  -- Unauthenticated, unvalidated caller — mirror the client-side zod rules.
  -- (No length-4 minimum on the fingerprint: the client hash can legitimately
  -- be short, and a miss here just falls through to the INSERT path.)
  IF p_fingerprint IS NULL OR length(p_fingerprint) < 1 OR length(p_fingerprint) > 128 THEN
    RETURN NULL;
  END IF;
  IF p_score IS NULL OR p_score < 0.5 OR p_score > 5 OR (p_score * 2) <> floor(p_score * 2) THEN
    RAISE EXCEPTION 'INVALID_RATING: Rating must be between 0.5 and 5 stars in half-star steps.';
  END IF;
  IF length(coalesce(p_comment, '')) > 2000 THEN
    RAISE EXCEPTION 'INVALID_RATING: Comment is too long.';
  END IF;

  SELECT r.id INTO v_id
  FROM public.ratings r
  WHERE r.teacher_id = p_teacher_id
    AND r.student_id IS NULL
    AND r.metadata->>'fingerprint' = p_fingerprint
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;  -- no prior review from this device — caller inserts instead
  END IF;

  -- Same shape the client wrote before: whole-object metadata refresh keeps
  -- uniq_ratings_anon_fingerprint semantics unchanged.
  UPDATE public.ratings
  SET score = p_score,
      comment = coalesce(p_comment, ''),
      updated_at = now(),
      metadata = jsonb_build_object(
        'fingerprint', p_fingerprint,
        'timestamp', (extract(epoch FROM clock_timestamp()) * 1000)::bigint
      )
  WHERE id = v_id;

  RETURN v_id;
END;
$fn$;

COMMENT ON FUNCTION public.update_anon_rating(uuid, text, numeric, text) IS
  'Updates this device''s prior anonymous rating for a teacher, verifying the fingerprint server-side. The only anonymous edit path since migration 021 revoked anon UPDATE on ratings. Returns the rating id, or NULL when no prior row matches.';

REVOKE ALL ON FUNCTION public.update_anon_rating(uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_anon_rating(uuid, text, numeric, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Moderation fields are admin-only to change. RLS lets a signed-in user
--    UPDATE their own row, and column-level UPDATE grants can't distinguish
--    admins from other authenticated users — so without this trigger a user
--    could PATCH flagged=false on their own moderated review.
--    NOT SECURITY DEFINER: it must see the caller's auth context.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_rating_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $fn$
BEGIN
  IF NEW.flagged        IS DISTINCT FROM OLD.flagged
  OR NEW.flagged_reason IS DISTINCT FROM OLD.flagged_reason
  OR NEW.flagged_at     IS DISTINCT FROM OLD.flagged_at
  OR NEW.flagged_by     IS DISTINCT FROM OLD.flagged_by THEN
    -- Direct SQL / migrations / service tooling: no request context — don't gate.
    IF current_setting('request.headers', true) IS NULL THEN
      RETURN NEW;
    END IF;
    IF coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'MODERATION_PROTECTED: Only moderators can change review flags.';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS protect_rating_moderation ON public.ratings;
CREATE TRIGGER protect_rating_moderation
BEFORE UPDATE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.protect_rating_moderation_fields();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verification (run after)
-- ---------------------------------------------------------------------------
-- 1. Exactly these four policies on ratings:
--      SELECT policyname, cmd FROM pg_policies
--      WHERE schemaname='public' AND tablename='ratings' ORDER BY policyname;
--    -> ratings_delete_own_or_admin / ratings_insert_self_or_anon /
--       ratings_select_public / ratings_update_own_or_admin
--
-- 2. anon holds no UPDATE/DELETE grant:
--      SELECT grantee, privilege_type FROM information_schema.role_table_grants
--      WHERE table_schema='public' AND table_name='ratings' AND grantee='anon';
--    -> INSERT only (SELECT appears per-column via 019, in column_privileges).
--
-- 3. From a signed-out client, both must 42501 (this is what the repo's
--    scripts/verify-rls-posture.mjs probes):
--      curl -X PATCH  "$URL/rest/v1/ratings?id=eq.00000000-0000-0000-0000-000000000000" \
--           -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"score":5}'
--      curl -X DELETE "$URL/rest/v1/ratings?id=eq.00000000-0000-0000-0000-000000000000" \
--           -H "apikey: $ANON"
--
-- 4. The RPC exists and is a no-op for an unknown device:
--      SELECT public.update_anon_rating('00000000-0000-0000-0000-000000000000', 'probe', 5, '');
--    -> NULL
--
-- 5. Anonymous re-review still works END TO END from the deployed app:
--    submit anonymously, then submit again from the same device — it must
--    update the existing review, not error and not duplicate.
--
-- 6. As a signed-in NON-admin, flag tampering is blocked:
--      PATCH /rest/v1/ratings?id=eq.<own rating id>  {"flagged": false}
--    -> 'MODERATION_PROTECTED: ...' — while the Admin flag/unflag flow still works.
