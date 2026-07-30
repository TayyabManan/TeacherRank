-- Migration 018: let admins delete teachers that came from an approved request
--
-- BUG: Admin → delete teacher fails with
--   "Cannot delete teacher due to existing related data." (Postgres 23503)
-- for any teacher created by approving a teacher_submission_request. Teachers
-- added by hand through AddTeacherForm delete fine, which is why this looks
-- intermittent.
--
-- CAUSE: teacher_submission_requests.teacher_id references teachers(id) with NO
-- ACTION (the Postgres default), so the request row that points at the teacher
-- blocks the DELETE. TeacherRequestManager sets that link on approval:
--   src/components/TeacherRequestManager.tsx  — .update({ teacher_id: newTeacher.id })
--
-- HISTORY (from the prod SQL archive): the column was added 2025-09-03 by
-- fix-feedback-status-constraint.sql with
--     ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id)
-- i.e. no ON DELETE clause. fix-teacher-submission-complete.sql (2025-09-05) did
-- spell it `ON DELETE SET NULL`, but inside a CREATE TABLE IF NOT EXISTS — the
-- table already existed, so that whole statement was a no-op and the intended
-- rule never landed. This migration applies what that script meant to.
--
-- SET NULL, not CASCADE: the request is the audit trail of who asked for the
-- teacher and which admin approved it. Deleting the teacher should unlink the
-- request, not shred the record. (ratings.teacher_id is already ON DELETE
-- CASCADE and is not involved here.)

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class src ON src.oid = con.conrelid
  JOIN pg_class tgt ON tgt.oid = con.confrelid
  JOIN pg_namespace n ON n.oid = src.relnamespace
  WHERE con.contype = 'f'
    AND n.nspname = 'public'
    AND src.relname = 'teacher_submission_requests'
    AND tgt.relname = 'teachers';

  IF fk_name IS NULL THEN
    RAISE NOTICE 'No FK from teacher_submission_requests to teachers — nothing to do.';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE public.teacher_submission_requests DROP CONSTRAINT %I',
    fk_name
  );
END $$;

ALTER TABLE public.teacher_submission_requests
  ADD CONSTRAINT teacher_submission_requests_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Verification (run after):
--   1. The rule is now SET NULL (expect delete_rule = 'SET NULL'):
--        SELECT tc.table_name, kcu.column_name, rc.delete_rule
--        FROM information_schema.table_constraints tc
--        JOIN information_schema.key_column_usage kcu
--          ON kcu.constraint_name = tc.constraint_name
--        JOIN information_schema.referential_constraints rc
--          ON rc.constraint_name = tc.constraint_name
--        WHERE tc.constraint_name = 'teacher_submission_requests_teacher_id_fkey';
--
--   2. Nothing else still blocks a teacher DELETE — every FK pointing at
--      teachers should read CASCADE or SET NULL, never NO ACTION/RESTRICT:
--        SELECT src.relname AS referencing_table,
--               con.conname,
--               CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
--                                    WHEN 'c' THEN 'CASCADE'   WHEN 'n' THEN 'SET NULL'
--                                    WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
--        FROM pg_constraint con
--        JOIN pg_class src ON src.oid = con.conrelid
--        JOIN pg_class tgt ON tgt.oid = con.confrelid
--        WHERE con.contype = 'f' AND tgt.relname = 'teachers';
--
--   3. Functional check — deleting a previously-blocked teacher now succeeds and
--      leaves the request row intact with teacher_id NULL.
