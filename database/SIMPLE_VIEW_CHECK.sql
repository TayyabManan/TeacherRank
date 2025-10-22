-- Simple View Check - No aggregate functions
-- Run this to see current view definitions

-- Show each view definition
SELECT '=== teacher_aggregates ===' as info;
SELECT definition FROM pg_views WHERE viewname = 'teacher_aggregates' AND schemaname = 'public';

SELECT '=== ratings_with_info ===' as info;
SELECT definition FROM pg_views WHERE viewname = 'ratings_with_info' AND schemaname = 'public';

SELECT '=== teacher_requests_view ===' as info;
SELECT definition FROM pg_views WHERE viewname = 'teacher_requests_view' AND schemaname = 'public';

SELECT '=== admin_reviews_dashboard ===' as info;
SELECT definition FROM pg_views WHERE viewname = 'admin_reviews_dashboard' AND schemaname = 'public';

SELECT '=== user_profiles_with_roles ===' as info;
SELECT definition FROM pg_views WHERE viewname = 'user_profiles_with_roles' AND schemaname = 'public';

-- Check for SECURITY DEFINER in definitions
SELECT
  viewname,
  CASE
    WHEN definition LIKE '%SECURITY DEFINER%' THEN 'YES - HAS SECURITY DEFINER'
    WHEN definition LIKE '%security_definer%' THEN 'YES - HAS security_definer'
    ELSE 'NO - Clean'
  END as has_security_definer
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN (
  'teacher_aggregates',
  'ratings_with_info',
  'teacher_requests_view',
  'admin_reviews_dashboard',
  'user_profiles_with_roles'
);
