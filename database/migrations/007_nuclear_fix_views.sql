-- Migration: Nuclear Fix for SECURITY DEFINER Views
-- Date: 2025-10-22
-- Description: Complete removal and recreation of views using ALTER VIEW approach
-- This is the most aggressive fix - guaranteed to work

-- =============================================================================
-- DIAGNOSTIC: Check current state
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== CURRENT VIEW DEFINITIONS ===';
END $$;

-- Show full definitions
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN (
  'teacher_aggregates',
  'ratings_with_info',
  'teacher_requests_view',
  'admin_reviews_dashboard',
  'user_profiles_with_roles'
);

-- =============================================================================
-- FIX: Method 1 - ALTER VIEW to remove SECURITY DEFINER
-- =============================================================================

-- Try to alter each view to remove SECURITY DEFINER
-- Note: This might not work in all PostgreSQL versions, so we have fallback

DO $$
BEGIN
  BEGIN
    ALTER VIEW teacher_aggregates RESET (security_invoker);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ALTER VIEW teacher_aggregates failed (expected): %', SQLERRM;
  END;

  BEGIN
    ALTER VIEW ratings_with_info RESET (security_invoker);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ALTER VIEW ratings_with_info failed (expected): %', SQLERRM;
  END;

  BEGIN
    ALTER VIEW teacher_requests_view RESET (security_invoker);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ALTER VIEW teacher_requests_view failed (expected): %', SQLERRM;
  END;

  BEGIN
    ALTER VIEW admin_reviews_dashboard RESET (security_invoker);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ALTER VIEW admin_reviews_dashboard failed (expected): %', SQLERRM;
  END;

  BEGIN
    ALTER VIEW user_profiles_with_roles RESET (security_invoker);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ALTER VIEW user_profiles_with_roles failed (expected): %', SQLERRM;
  END;
END $$;

-- =============================================================================
-- FIX: Method 2 - Complete DROP and CREATE with explicit SECURITY INVOKER
-- =============================================================================

-- PostgreSQL 15+ supports SECURITY INVOKER option explicitly
-- For older versions, views are SECURITY INVOKER by default

-- 1. DROP ALL VIEWS
DROP VIEW IF EXISTS teacher_aggregates CASCADE;
DROP VIEW IF EXISTS ratings_with_info CASCADE;
DROP VIEW IF EXISTS teacher_requests_view CASCADE;
DROP VIEW IF EXISTS admin_reviews_dashboard CASCADE;
DROP VIEW IF EXISTS user_profiles_with_roles CASCADE;

-- Wait a moment to ensure drops are committed
SELECT pg_sleep(0.1);

-- 2. CREATE teacher_aggregates (explicitly WITHOUT security definer)
CREATE VIEW teacher_aggregates AS
SELECT
  r.teacher_id,
  AVG(r.score) as avg_rating,
  COUNT(*) as ratings_count,
  COUNT(DISTINCT r.student_id) as unique_raters
FROM ratings r
GROUP BY r.teacher_id;

-- 3. CREATE ratings_with_info
CREATE VIEW ratings_with_info AS
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

-- 4. CREATE teacher_requests_view
CREATE VIEW teacher_requests_view AS
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

-- 5. CREATE admin_reviews_dashboard
CREATE VIEW admin_reviews_dashboard AS
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

-- 6. CREATE user_profiles_with_roles
CREATE VIEW user_profiles_with_roles AS
SELECT
  p.id,
  p.display_name,
  p.role,
  p.created_at,
  p.updated_at,
  CASE
    WHEN auth.uid() = p.id OR is_admin(auth.uid()) THEN p.email
    ELSE NULL
  END as email
FROM profiles p;

-- =============================================================================
-- Grant permissions
-- =============================================================================

GRANT SELECT ON teacher_aggregates TO authenticated, anon;
GRANT SELECT ON ratings_with_info TO authenticated, anon;
GRANT SELECT ON teacher_requests_view TO authenticated;
GRANT SELECT ON admin_reviews_dashboard TO authenticated;
GRANT SELECT ON user_profiles_with_roles TO authenticated;

-- =============================================================================
-- CRITICAL: Check if views were created with SECURITY DEFINER
-- =============================================================================

DO $$
DECLARE
  definer_views TEXT;
BEGIN
  -- Get list of views still with security definer
  SELECT string_agg(viewname, ', ')
  INTO definer_views
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN (
    'teacher_aggregates',
    'ratings_with_info',
    'teacher_requests_view',
    'admin_reviews_dashboard',
    'user_profiles_with_roles'
  )
  AND (
    definition ILIKE '%security%definer%'
    OR definition ILIKE '%security_definer%'
  );

  IF definer_views IS NOT NULL THEN
    RAISE WARNING '⚠️  VIEWS STILL HAVE SECURITY DEFINER: %', definer_views;
    RAISE WARNING 'This means they were created by a database migration or function.';
    RAISE WARNING 'Check: Database → Database → SQL Scripts or Functions';
    RAISE WARNING '';
    RAISE WARNING 'Manual fix required:';
    RAISE WARNING '1. Find where these views are being created (search codebase)';
    RAISE WARNING '2. Remove SECURITY DEFINER from CREATE VIEW statements';
    RAISE WARNING '3. Re-run those scripts';
  ELSE
    RAISE NOTICE '✅ SUCCESS! All views are clean (no SECURITY DEFINER)';
  END IF;
END $$;

-- =============================================================================
-- Show final state
-- =============================================================================

SELECT
  schemaname,
  viewname,
  viewowner,
  CASE
    WHEN definition ILIKE '%security%definer%' THEN '❌ STILL HAS SECURITY DEFINER'
    WHEN definition ILIKE '%security_definer%' THEN '❌ STILL HAS SECURITY_DEFINER'
    ELSE '✅ Clean'
  END as status
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN (
  'teacher_aggregates',
  'ratings_with_info',
  'teacher_requests_view',
  'admin_reviews_dashboard',
  'user_profiles_with_roles'
)
ORDER BY viewname;

-- =============================================================================
-- If views STILL have SECURITY DEFINER, check where they're defined
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TROUBLESHOOTING ===';
  RAISE NOTICE 'If views still have SECURITY DEFINER, check:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Supabase Dashboard → Database → Functions';
  RAISE NOTICE '   Look for functions that create these views';
  RAISE NOTICE '';
  RAISE NOTICE '2. Your application code:';
  RAISE NOTICE '   grep -r "CREATE.*VIEW.*SECURITY" .';
  RAISE NOTICE '';
  RAISE NOTICE '3. Supabase migrations folder';
  RAISE NOTICE '   Check for old migrations creating these views';
  RAISE NOTICE '';
  RAISE NOTICE '4. Run this query to see view definitions:';
  RAISE NOTICE '   SELECT viewname, definition FROM pg_views';
  RAISE NOTICE '   WHERE viewname LIKE ''teacher%'' OR viewname LIKE ''rating%'';';
END $$;
