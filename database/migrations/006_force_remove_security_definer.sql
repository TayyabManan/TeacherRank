-- Migration: Force Remove SECURITY DEFINER from Views
-- Date: 2025-10-22
-- Description: Aggressively remove SECURITY DEFINER property from all views
-- Issue: Previous migration didn't fully remove SECURITY DEFINER

-- =============================================================================
-- STEP 1: Check current view definitions
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Current views with SECURITY DEFINER:';
  RAISE NOTICE '%', (
    SELECT string_agg(viewname, ', ')
    FROM pg_views
    WHERE schemaname = 'public'
    AND definition ILIKE '%security%definer%'
  );
END $$;

-- =============================================================================
-- STEP 2: Force drop and recreate ALL views without SECURITY DEFINER
-- =============================================================================

-- 1. teacher_aggregates
DROP VIEW IF EXISTS teacher_aggregates CASCADE;

CREATE VIEW teacher_aggregates AS
SELECT
  r.teacher_id,
  AVG(r.score) as avg_rating,
  COUNT(*) as ratings_count,
  COUNT(DISTINCT r.student_id) as unique_raters
FROM ratings r
GROUP BY r.teacher_id;

ALTER VIEW teacher_aggregates OWNER TO postgres;
GRANT SELECT ON teacher_aggregates TO authenticated, anon;

-- 2. ratings_with_info
DROP VIEW IF EXISTS ratings_with_info CASCADE;

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

ALTER VIEW ratings_with_info OWNER TO postgres;
GRANT SELECT ON ratings_with_info TO authenticated, anon;

-- 3. teacher_requests_view
DROP VIEW IF EXISTS teacher_requests_view CASCADE;

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

ALTER VIEW teacher_requests_view OWNER TO postgres;
GRANT SELECT ON teacher_requests_view TO authenticated;

-- 4. admin_reviews_dashboard
DROP VIEW IF EXISTS admin_reviews_dashboard CASCADE;

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

ALTER VIEW admin_reviews_dashboard OWNER TO postgres;
GRANT SELECT ON admin_reviews_dashboard TO authenticated;

-- 5. user_profiles_with_roles
DROP VIEW IF EXISTS user_profiles_with_roles CASCADE;

CREATE VIEW user_profiles_with_roles AS
SELECT
  p.id,
  p.display_name,
  p.role,
  p.created_at,
  p.updated_at,
  -- Conditional email visibility
  CASE
    WHEN auth.uid() = p.id OR is_admin(auth.uid()) THEN p.email
    ELSE NULL
  END as email
FROM profiles p;

ALTER VIEW user_profiles_with_roles OWNER TO postgres;
GRANT SELECT ON user_profiles_with_roles TO authenticated;

-- =============================================================================
-- STEP 3: Verify views are created correctly
-- =============================================================================

DO $$
DECLARE
  view_count INTEGER;
  definer_count INTEGER;
BEGIN
  -- Count total views
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN (
    'teacher_aggregates',
    'ratings_with_info',
    'teacher_requests_view',
    'admin_reviews_dashboard',
    'user_profiles_with_roles'
  );

  -- Count views still with SECURITY DEFINER
  SELECT COUNT(*) INTO definer_count
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN (
    'teacher_aggregates',
    'ratings_with_info',
    'teacher_requests_view',
    'admin_reviews_dashboard',
    'user_profiles_with_roles'
  )
  AND definition ILIKE '%security%definer%';

  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION RESULTS ===';
  RAISE NOTICE 'Total views created: %', view_count;
  RAISE NOTICE 'Views with SECURITY DEFINER: %', definer_count;
  RAISE NOTICE '';

  IF definer_count > 0 THEN
    RAISE WARNING '⚠️  Some views still have SECURITY DEFINER!';
    RAISE WARNING 'Views affected: %', (
      SELECT string_agg(viewname, ', ')
      FROM pg_views
      WHERE schemaname = 'public'
      AND viewname IN (
        'teacher_aggregates',
        'ratings_with_info',
        'teacher_requests_view',
        'admin_reviews_dashboard',
        'user_profiles_with_roles'
      )
      AND definition ILIKE '%security%definer%'
    );
  ELSE
    RAISE NOTICE '✅ SUCCESS! All views created without SECURITY DEFINER';
  END IF;
END $$;

-- =============================================================================
-- STEP 4: List all view definitions for manual inspection
-- =============================================================================

SELECT
  schemaname,
  viewname,
  CASE
    WHEN definition ILIKE '%security%definer%' THEN '❌ HAS SECURITY DEFINER'
    ELSE '✅ Clean'
  END as status,
  LEFT(definition, 100) as definition_preview
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
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration completed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Check the output above for verification results';
  RAISE NOTICE '2. Go to Database → Linter in Supabase Dashboard';
  RAISE NOTICE '3. Click Refresh';
  RAISE NOTICE '4. SECURITY DEFINER errors should be GONE';
  RAISE NOTICE '';
  RAISE NOTICE 'If errors persist, the views may have been created';
  RAISE NOTICE 'through a different method. Check pg_views table directly.';
END $$;
