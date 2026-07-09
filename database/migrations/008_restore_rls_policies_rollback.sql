-- ROLLBACK for 008_restore_rls_policies.sql — EMERGENCY USE ONLY
--
-- ⚠⚠ Running this REOPENS the audited vulnerability: anon writes to teachers
-- and teacher_submission_requests, and anon reads of requester PII. Use it only
-- if 008 breaks a production flow you cannot fix forward, and re-apply 008 as
-- soon as the flow is fixed.
--
-- It restores the pre-008 OBSERVED behavior (the exact pre-008 policy set is
-- unknown — it was never in source control):
--   teachers / feedback / teacher_submission_requests: open to anon+authenticated
--   email_queue: anon denied, authenticated may insert (admin emails keep working)
--   views: back to owner (definer-like) semantics

BEGIN;

-- Drop everything 008 created (and anything else) on the four tables.
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
  END LOOP;
END $$;

-- Permissive policies matching pre-008 observed behavior.
CREATE POLICY "teachers_open_rollback" ON public.teachers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "feedback_open_rollback" ON public.feedback
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "teacher_requests_open_rollback" ON public.teacher_submission_requests
  FOR ALL USING (true) WITH CHECK (true);

-- email_queue stays anon-denied (it already was pre-008); authenticated users
-- can insert so admin approve/reject emails keep queueing.
CREATE POLICY "email_queue_insert_authenticated_rollback" ON public.email_queue
  FOR INSERT TO authenticated WITH CHECK (true);

-- Restore broad grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers                    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback                    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_submission_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_queue                 TO authenticated;
REVOKE ALL ON public.email_queue FROM anon;

-- Views back to owner semantics (pre-008 state).
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
        EXECUTE format('ALTER VIEW public.%I RESET (security_invoker)', v);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not reset security_invoker on view %: %', v, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- is_admin() is left in place: triggers and other policies may reference it.

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('teachers', 'feedback', 'teacher_submission_requests', 'email_queue')
ORDER BY tablename, policyname;
