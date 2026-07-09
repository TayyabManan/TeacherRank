-- ============================================================================
-- 010: Fix the audit trigger that breaks every status change on
--      teacher_submission_requests
-- ============================================================================
-- Symptom (admin panel, any approve/reject/ignore/needs-info action):
--   column "details" of relation "teacher_request_audit" does not exist
--
-- Cause: the live table keeps its original shape —
--   teacher_request_audit(id, request_id, action, previous_status,
--                         new_status, notes, performed_by, performed_at)
-- but a later function-hardening script rewrote
-- log_teacher_request_status_change() to INSERT (request_id, action,
-- performed_by, details); `details` was never added to the table, so the
-- AFTER UPDATE trigger aborts every status-changing UPDATE.
--
-- Fix: recreate the function to write the columns the table actually has.
-- This matches the send-email edge function, which also writes `notes`
-- (supabase/functions/send-email/index.ts).
--
-- Apply via Supabase dashboard SQL editor. Safe to re-run (idempotent).
-- ============================================================================

BEGIN;

-- CREATE OR REPLACE (not DROP ... CASCADE) so the existing trigger binding on
-- teacher_submission_requests is preserved.
CREATE OR REPLACE FUNCTION public.log_teacher_request_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.teacher_request_audit (
      request_id,
      action,
      previous_status,
      new_status,
      notes,
      performed_by
    ) VALUES (
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status,
      NEW.admin_notes,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger if it is somehow missing (no-op when present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'log_teacher_request_changes'
  ) THEN
    CREATE TRIGGER log_teacher_request_changes
    AFTER UPDATE ON public.teacher_submission_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.log_teacher_request_status_change();
  END IF;
END $$;

-- teacher_request_audit has had RLS enabled with ZERO policies since Sept 2025
-- (default-deny). The trigger above is unaffected (SECURITY DEFINER, owned by
-- the table owner, bypasses RLS), but the send-email edge function's audit
-- insert (runs with the admin's JWT) is silently blocked, and admins cannot
-- read the log at all. Give admins full access. is_admin(uuid) exists live
-- (ultimate-rbac-fix.sql, Sept 2025), so this works whether or not 008 has
-- been applied yet.
ALTER TABLE public.teacher_request_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin_all" ON public.teacher_request_audit;
CREATE POLICY "audit_admin_all" ON public.teacher_request_audit
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
GRANT SELECT, INSERT ON public.teacher_request_audit TO authenticated;

COMMIT;

-- ============================================================================
-- Verification — the function source must reference previous_status/new_status/
-- notes and must NOT reference "details":
SELECT proname,
       prosrc LIKE '%previous_status%' AS writes_previous_status,
       prosrc NOT LIKE '%details%'     AS details_reference_removed
FROM pg_proc
WHERE proname = 'log_teacher_request_status_change';
-- Expect one row: writes_previous_status = true, details_reference_removed = true
-- ============================================================================
