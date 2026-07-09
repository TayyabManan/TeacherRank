-- Migration 009: Delete junk rows left by the 2026-07-09 security audit.
-- Safe to re-run: both deletes are guarded by id AND content, so they are
-- no-ops once the rows are gone.
--
-- Status when this file was written (2026-07-09):
--   * The feedback row was already deleted via the REST API with the anon key
--     (feedback allowed anon deletes pre-008) — the delete below is a no-op.
--   * The teachers probe row could NOT be deleted with the anon key (a remnant
--     admin-only DELETE policy filtered it), so this script must run in the
--     Supabase dashboard SQL editor.

DELETE FROM public.teachers
WHERE id = '89fcb3c2-3cc3-47b9-b05f-2ea08fbd2e6a'
  AND name = '__probe__'
  AND institute = '__probe__';

DELETE FROM public.feedback
WHERE id = 'c892ea1d-f129-414e-bbd2-a57ae0225ac5'
  AND title = 'Test toast positioning'
  AND email = 'test@example.com';

-- Verification — must return zero rows.
SELECT 'teachers' AS tbl, id::text, name AS detail
FROM public.teachers
WHERE name = '__probe__' OR institute = '__probe__'
UNION ALL
SELECT 'feedback', id::text, title
FROM public.feedback
WHERE id = 'c892ea1d-f129-414e-bbd2-a57ae0225ac5';
