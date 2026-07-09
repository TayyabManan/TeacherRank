-- Migration 008: Restore Row Level Security policies
-- Date: 2026-07-09
--
-- Context: a verified production audit (2026-07-09) found the live policy set
-- no longer matches SECURITY.md or any SQL in the repo:
--   * unauthenticated INSERT into teachers succeeded,
--   * unauthenticated UPDATE on teacher_submission_requests succeeded,
--   * requester PII in teacher_submission_requests and feedback was anon-readable,
--   * anon DELETE on teachers was still filtered (a remnant of the original
--     policies), proving the live set is a partial/patched mix.
-- The original policy migration (002_implement_rls_policies.sql) was added in
-- commit b686423 and deleted from the repo in commit 218eb35 the same day
-- (2025-10-22); its write restrictions are evidently no longer in effect.
--
-- This migration restores the posture documented in SECURITY.md:
--   teachers                      SELECT public; INSERT/UPDATE/DELETE admin-only
--   teacher_submission_requests   INSERT public; SELECT/UPDATE/DELETE admin-only
--   feedback                      INSERT public; SELECT/UPDATE/DELETE admin-only
--   email_queue                   admin-only (service_role bypasses RLS)
-- "Admin" mirrors the app's own check (src/lib/auth.ts → getCurrentUserRoles):
-- a row in profiles with role = 'admin'.
--
-- ⚠ REQUIRES the companion app change (same commit as this file): the public
-- teacher-request flow in src/pages/Feedback.tsx now generates the feedback id
-- client-side instead of using insert-returning (.select()), because anon can
-- no longer SELECT feedback rows back. Deploy that app change together with
-- (or before) applying this migration, or the public "Request a teacher" form
-- will fail.
--
-- Ratings and profiles policies are intentionally NOT touched: the audit found
-- them behaving as designed (public rating reads/submissions work, email_queue
-- was the only properly restricted table).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Admin helper — mirrors the app's check (profiles.role = 'admin').
--    The live DB has TWO overloads (reconstructed from the dashboard-script
--    archive that was actually run in Sept 2025):
--      * is_admin()      — zero-arg, hardcoded-email check
--                          (fix-admin-permissions-complete.sql)
--      * is_admin(uuid)  — profiles.role check, NO default
--                          (ultimate-rbac-fix.sql)
--    A previous run of this migration failed with 42725 because the COMMENT
--    below referenced `public.is_admin` without an argument list against that
--    pair (everything rolled back — safe to re-run).
--    ORDER MATTERS: the zero-arg overload must be dropped BEFORE giving the
--    uuid overload a DEFAULT, or every textual `is_admin()` call in the DB
--    becomes ambiguous (42725) at runtime.
-- ---------------------------------------------------------------------------

-- Retire the legacy hardcoded-email overload. The empty parens are a full
-- signature, so this targets ONLY the zero-arg function. No policy or view
-- references it; its sole caller (admin_delete_review) is recreated below.
DROP FUNCTION IF EXISTS public.is_admin();

-- Upgrade the uuid overload IN PLACE. CREATE OR REPLACE preserves its OID,
-- which live objects reference (ratings policies, is_current_user_admin()).
-- Never DROP+CREATE this one — the drop would either fail on dependencies or
-- silently break is_current_user_admin() and the teachers policies that use it.
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin(UUID) IS
  'True when the given user (default: current user) has profiles.role = ''admin''. Used by RLS policies.';

-- anon needs EXECUTE too: policies referencing is_admin() are evaluated for
-- anonymous requests as well (and return false there, since auth.uid() is NULL).
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon, authenticated;

-- The live admin_delete_review (Sept 2025) textually calls the zero-arg
-- is_admin() dropped above, and it IS used — src/pages/Admin.tsx invokes it
-- via rpc for review deletion. Recreate it against the uuid overload, keeping
-- the original contract exactly (same signature; swallows errors and returns
-- FALSE, which the app treats as failure). This also upgrades its admin check
-- from the hardcoded email to profiles.role, matching the rest of the system.
CREATE OR REPLACE FUNCTION public.admin_delete_review(review_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can delete reviews';
  END IF;

  DELETE FROM public.ratings WHERE id = review_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error deleting review: %', SQLERRM;
    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_review(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Clean slate: drop EVERY existing policy on the four audited tables.
--    The live set is an unknown mix (see header), so rebuilding beats patching.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('teachers', 'feedback', 'teacher_submission_requests', 'email_queue')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    RAISE NOTICE 'Dropped policy % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

ALTER TABLE public.teachers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_submission_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue                 ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. teachers — public read, admin-only writes.
--    Admin writes happen client-side with the admin's JWT (TeacherManagement,
--    TeacherRequestManager approve flow), so `authenticated` keeps the
--    table-level grants and RLS narrows them to admins.
-- ---------------------------------------------------------------------------
CREATE POLICY "teachers_select_public" ON public.teachers
  FOR SELECT USING (true);

CREATE POLICY "teachers_insert_admin" ON public.teachers
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "teachers_update_admin" ON public.teachers
  FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "teachers_delete_admin" ON public.teachers
  FOR DELETE USING (is_admin(auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.teachers FROM anon;
GRANT SELECT ON public.teachers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teachers TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. teacher_submission_requests — anyone can submit; only admins can read,
--    update, or delete (requester_email / requester_name are PII).
--    The public form (src/pages/Feedback.tsx) inserts WITHOUT .select(), so
--    insert-returning is not needed for anon.
-- ---------------------------------------------------------------------------
CREATE POLICY "teacher_requests_insert_public" ON public.teacher_submission_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "teacher_requests_select_admin" ON public.teacher_submission_requests
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "teacher_requests_update_admin" ON public.teacher_submission_requests
  FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "teacher_requests_delete_admin" ON public.teacher_submission_requests
  FOR DELETE USING (is_admin(auth.uid()));

REVOKE SELECT, UPDATE, DELETE ON public.teacher_submission_requests FROM anon;
GRANT INSERT ON public.teacher_submission_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.teacher_submission_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. feedback — anyone can submit; only admins can read, update, or delete
--    (email / name are PII). Requires the Feedback.tsx client-side-id change
--    noted in the header.
-- ---------------------------------------------------------------------------
CREATE POLICY "feedback_insert_public" ON public.feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "feedback_select_admin" ON public.feedback
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "feedback_update_admin" ON public.feedback
  FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "feedback_delete_admin" ON public.feedback
  FOR DELETE USING (is_admin(auth.uid()));

REVOKE SELECT, UPDATE, DELETE ON public.feedback FROM anon;
GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.feedback TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. email_queue — admin-only in every direction. Rows are written client-side
--    by the admin approve/reject flows (src/lib/emailService.ts) with the
--    admin's JWT; any queue processor using the service_role key bypasses RLS.
-- ---------------------------------------------------------------------------
CREATE POLICY "email_queue_admin_all" ON public.email_queue
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

REVOKE ALL ON public.email_queue FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_queue TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Views: run with the CALLER's permissions (security_invoker), not the view
--    owner's. Views owned by postgres otherwise bypass base-table RLS, which
--    would let any authenticated user read all request PII through
--    teacher_requests_view. Requires Postgres 15+ (any recent Supabase
--    project); failures are reported, not fatal.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'teacher_aggregates',
    'ratings_with_info',
    'teacher_requests_view',
    'admin_reviews_dashboard',
    'user_profiles_with_roles'
  ] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      BEGIN
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
        RAISE NOTICE 'security_invoker enabled on view %', v;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not set security_invoker on view %: %', v, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Ask PostgREST to pick up the grant changes immediately.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verification — the result grid should show exactly these policies:
--   teachers: select_public + insert/update/delete_admin
--   teacher_submission_requests: insert_public + select/update/delete_admin
--   feedback: insert_public + select/update/delete_admin
--   email_queue: admin_all
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('teachers', 'feedback', 'teacher_submission_requests', 'email_queue')
ORDER BY tablename, policyname;

-- Overload check — must return EXACTLY one row: is_admin(user_id uuid).
-- A second zero-arg row means the DROP at the top didn't take effect.
SELECT oid::regprocedure AS signature
FROM pg_proc
WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace;
