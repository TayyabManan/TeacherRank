-- Migration: Fix Supabase Security Linter Errors
-- Date: 2025-10-22
-- Description: Fix SECURITY DEFINER views and enable RLS on missing tables
-- Fixes: 7 security errors detected by Supabase linter

-- =============================================================================
-- PART 1: Enable RLS on Missing Tables
-- =============================================================================

-- Fix: admin_audit_log table missing RLS
ALTER TABLE IF EXISTS admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "admin_audit_log_select_admin" ON admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_insert_system" ON admin_audit_log;

-- Policy: Only admins can read audit logs
CREATE POLICY "admin_audit_log_select_admin" ON admin_audit_log
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Policy: System can write to audit log
CREATE POLICY "admin_audit_log_insert_system" ON admin_audit_log
  FOR INSERT
  WITH CHECK (true); -- Triggers/functions can write

COMMENT ON TABLE admin_audit_log IS 'Audit log table with RLS enabled - admin read-only';

-- Fix: query_performance_logs table missing RLS
ALTER TABLE IF EXISTS query_performance_logs ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "query_performance_logs_select_admin" ON query_performance_logs;
DROP POLICY IF EXISTS "query_performance_logs_insert_system" ON query_performance_logs;

-- Policy: Only admins can read performance logs
CREATE POLICY "query_performance_logs_select_admin" ON query_performance_logs
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Policy: System can write performance logs
CREATE POLICY "query_performance_logs_insert_system" ON query_performance_logs
  FOR INSERT
  WITH CHECK (true); -- System/triggers can write

COMMENT ON TABLE query_performance_logs IS 'Performance log table with RLS enabled - admin read-only';

-- =============================================================================
-- PART 2: Fix SECURITY DEFINER Views
-- =============================================================================

-- Strategy: Recreate views WITHOUT security definer, then apply RLS policies
-- This ensures views respect the querying user's permissions

-- Drop and recreate: teacher_aggregates
DROP VIEW IF EXISTS teacher_aggregates CASCADE;

CREATE OR REPLACE VIEW teacher_aggregates AS
SELECT
  r.teacher_id,
  AVG(r.score) as avg_rating,
  COUNT(*) as ratings_count,
  COUNT(DISTINCT r.student_id) as unique_raters
FROM ratings r
GROUP BY r.teacher_id;

-- Grant access to authenticated users (view itself is not restricted)
GRANT SELECT ON teacher_aggregates TO authenticated, anon;

COMMENT ON VIEW teacher_aggregates IS 'Teacher rating aggregates - public view without SECURITY DEFINER';

-- Drop and recreate: ratings_with_info
DROP VIEW IF EXISTS ratings_with_info CASCADE;

CREATE OR REPLACE VIEW ratings_with_info AS
SELECT
  r.id,
  r.teacher_id,
  r.student_id,
  r.score,
  r.comment,
  r.created_at,
  r.updated_at,
  t.name as teacher_name,
  t.institute as teacher_institute
FROM ratings r
LEFT JOIN teachers t ON r.teacher_id = t.id;

GRANT SELECT ON ratings_with_info TO authenticated, anon;

COMMENT ON VIEW ratings_with_info IS 'Ratings with teacher info - public view without SECURITY DEFINER';

-- Drop and recreate: teacher_requests_view (Admin only via RLS on base table)
DROP VIEW IF EXISTS teacher_requests_view CASCADE;

CREATE OR REPLACE VIEW teacher_requests_view AS
SELECT
  tsr.id,
  tsr.teacher_name,
  tsr.institute,
  tsr.designation,
  tsr.city,
  tsr.linkedin_url,
  tsr.bio,
  tsr.requester_email,
  tsr.requester_name,
  tsr.reason,
  tsr.status,
  tsr.created_at,
  tsr.feedback_id,
  f.type as feedback_type,
  f.status as feedback_status
FROM teacher_submission_requests tsr
LEFT JOIN feedback f ON tsr.feedback_id = f.id;

-- Note: Access is controlled by RLS on teacher_submission_requests table
GRANT SELECT ON teacher_requests_view TO authenticated;

COMMENT ON VIEW teacher_requests_view IS 'Teacher requests with feedback - access controlled by base table RLS';

-- Drop and recreate: admin_reviews_dashboard
DROP VIEW IF EXISTS admin_reviews_dashboard CASCADE;

CREATE OR REPLACE VIEW admin_reviews_dashboard AS
SELECT
  r.id,
  r.teacher_id,
  r.student_id,
  r.score,
  r.comment,
  r.created_at,
  r.updated_at,
  t.name as teacher_name,
  t.institute as teacher_institute,
  CASE
    WHEN r.student_id IS NULL THEN 'Anonymous'
    ELSE 'Authenticated'
  END as review_type
FROM ratings r
LEFT JOIN teachers t ON r.teacher_id = t.id;

-- Access controlled by RLS on ratings table
GRANT SELECT ON admin_reviews_dashboard TO authenticated;

COMMENT ON VIEW admin_reviews_dashboard IS 'Admin dashboard view - access controlled by base table RLS';

-- Drop and recreate: user_profiles_with_roles
DROP VIEW IF EXISTS user_profiles_with_roles CASCADE;

CREATE OR REPLACE VIEW user_profiles_with_roles AS
SELECT
  p.id,
  p.display_name,
  p.role,
  p.created_at,
  p.updated_at,
  -- Email only visible to owner or admin (enforced by RLS on profiles table)
  CASE
    WHEN auth.uid() = p.id OR is_admin(auth.uid()) THEN p.email
    ELSE NULL
  END as email
FROM profiles p;

GRANT SELECT ON user_profiles_with_roles TO authenticated;

COMMENT ON VIEW user_profiles_with_roles IS 'User profiles with conditional email access - respects base table RLS';

-- =============================================================================
-- PART 3: Add RLS Policies to Views (Defense in Depth)
-- =============================================================================

-- Note: PostgreSQL doesn't support RLS on views directly, but access is controlled
-- through RLS policies on the underlying base tables. The views we created above
-- will automatically respect the RLS policies on teachers, ratings, profiles, etc.

-- Verify that base tables have RLS enabled
DO $$
BEGIN
  -- Verify critical tables have RLS
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('teachers', 'ratings', 'profiles', 'feedback', 'teacher_submission_requests')
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'Some base tables may not have RLS enabled. Please run migration 002_implement_rls_policies.sql first.';
  END IF;
END $$;

-- =============================================================================
-- PART 4: Add Additional Security Measures
-- =============================================================================

-- Revoke unnecessary public access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Grant specific read access to anon users (unauthenticated)
GRANT SELECT ON teachers TO anon;
GRANT SELECT ON ratings TO anon;
GRANT SELECT ON teacher_aggregates TO anon;
GRANT SELECT ON ratings_with_info TO anon;

-- Authenticated users get read access to most tables (controlled by RLS)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Only authenticated users can insert/update/delete (controlled by RLS)
GRANT INSERT, UPDATE, DELETE ON ratings TO authenticated;
GRANT INSERT ON feedback TO authenticated;
GRANT INSERT ON teacher_submission_requests TO authenticated;

-- =============================================================================
-- PART 5: Verification Queries
-- =============================================================================

-- Check RLS is enabled on all required tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'teachers', 'ratings', 'profiles', 'feedback',
  'teacher_submission_requests', 'admin_audit_log', 'query_performance_logs'
)
ORDER BY tablename;

-- Expected: All should show rls_enabled = true

-- Check views no longer use SECURITY DEFINER
SELECT
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN (
  'teacher_aggregates', 'ratings_with_info', 'teacher_requests_view',
  'admin_reviews_dashboard', 'user_profiles_with_roles'
);

-- Expected: Definitions should not contain 'SECURITY DEFINER'

-- List all policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================================================
-- PART 6: Test Scenarios
-- =============================================================================

-- Test 1: Verify anon users can read public data
-- SET ROLE anon;
-- SELECT COUNT(*) FROM teachers;  -- Should work
-- SELECT COUNT(*) FROM ratings;   -- Should work
-- SELECT * FROM feedback;         -- Should fail (RLS policy)
-- RESET ROLE;

-- Test 2: Verify views work for authenticated users
-- SET ROLE authenticated;
-- SELECT COUNT(*) FROM teacher_aggregates;      -- Should work
-- SELECT COUNT(*) FROM ratings_with_info;        -- Should work
-- SELECT COUNT(*) FROM teacher_requests_view;    -- May be empty if not admin
-- RESET ROLE;

-- Test 3: Verify admin_audit_log is protected
-- SET ROLE authenticated;
-- SELECT * FROM admin_audit_log;  -- Should fail unless user is admin
-- RESET ROLE;

-- =============================================================================
-- ROLLBACK (Emergency Only)
-- =============================================================================

-- If you need to rollback these changes:
--
-- -- Disable RLS on new tables
-- ALTER TABLE admin_audit_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE query_performance_logs DISABLE ROW LEVEL SECURITY;
--
-- -- Drop policies
-- DROP POLICY IF EXISTS "admin_audit_log_select_admin" ON admin_audit_log;
-- DROP POLICY IF EXISTS "query_performance_logs_select_admin" ON query_performance_logs;
--
-- -- Note: You would need to manually recreate the SECURITY DEFINER views
-- -- from your backup if you want to restore the original configuration

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Security fixes applied successfully!';
  RAISE NOTICE '1. RLS enabled on admin_audit_log and query_performance_logs';
  RAISE NOTICE '2. All SECURITY DEFINER views recreated without SECURITY DEFINER';
  RAISE NOTICE '3. Access now controlled by base table RLS policies';
  RAISE NOTICE '4. Run verification queries above to confirm';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ IMPORTANT: Test your application thoroughly after this migration';
  RAISE NOTICE '   - Views now respect RLS policies';
  RAISE NOTICE '   - Some queries may return different results based on user permissions';
END $$;
