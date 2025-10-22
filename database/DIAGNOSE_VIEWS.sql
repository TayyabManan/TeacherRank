-- Diagnostic Script: Find WHERE views with SECURITY DEFINER are defined
-- Run this to identify the source of the problem

-- =============================================================================
-- 1. Show current view definitions (full text)
-- =============================================================================

SELECT
  '=== VIEW: ' || viewname || ' ===' as separator,
  definition
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
-- 2. Check if views have SECURITY DEFINER in their options
-- =============================================================================

SELECT
  c.relname as view_name,
  c.reloptions as options,
  CASE
    WHEN 'security_definer=true' = ANY(c.reloptions) THEN '❌ HAS SECURITY DEFINER'
    ELSE '✅ Clean'
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'v'
AND c.relname IN (
  'teacher_aggregates',
  'ratings_with_info',
  'teacher_requests_view',
  'admin_reviews_dashboard',
  'user_profiles_with_roles'
);

-- =============================================================================
-- 3. Check for functions that might be creating these views
-- =============================================================================

SELECT
  proname as function_name,
  prosrc as source_code
FROM pg_proc
WHERE prosrc ILIKE '%CREATE%VIEW%'
AND (
  prosrc ILIKE '%teacher_aggregates%'
  OR prosrc ILIKE '%ratings_with_info%'
  OR prosrc ILIKE '%teacher_requests_view%'
  OR prosrc ILIKE '%admin_reviews_dashboard%'
  OR prosrc ILIKE '%user_profiles_with_roles%'
);

-- =============================================================================
-- 4. Check for any triggers that might recreate views
-- =============================================================================

SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE pg_get_triggerdef(oid) ILIKE '%CREATE%VIEW%';

-- =============================================================================
-- 5. Search all function bodies for SECURITY DEFINER views
-- =============================================================================

SELECT
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND pg_get_functiondef(p.oid) ILIKE '%SECURITY%DEFINER%';

-- =============================================================================
-- INSTRUCTIONS
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DIAGNOSTIC COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the output above to find:';
  RAISE NOTICE '1. View definitions (check for SECURITY DEFINER in CREATE statement)';
  RAISE NOTICE '2. Functions that create views';
  RAISE NOTICE '3. Triggers that recreate views';
  RAISE NOTICE '';
  RAISE NOTICE 'Once you find the source:';
  RAISE NOTICE '- Update the CREATE VIEW statement to remove SECURITY DEFINER';
  RAISE NOTICE '- Or delete the function/trigger if not needed';
  RAISE NOTICE '- Then re-run migration 007_nuclear_fix_views.sql';
END $$;
