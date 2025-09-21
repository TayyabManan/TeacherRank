-- Comprehensive Verification Script for All Security Fixes
-- Run this after applying fix-all-security-issues.sql

-- ============================================
-- 1. Check SECURITY DEFINER Views (Should be 0)
-- ============================================
SELECT 
  '=== SECURITY DEFINER VIEWS CHECK ===' as section;

SELECT 
  n.nspname as schema,
  c.relname as view_name,
  CASE 
    WHEN pg_get_viewdef(c.oid, true) LIKE '%SECURITY DEFINER%' THEN '❌ HAS SECURITY DEFINER'
    ELSE '✅ SECURITY INVOKER (Safe)'
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'v'
AND c.relname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles')
ORDER BY c.relname;

-- ============================================
-- 2. Check Functions for Search Path Configuration
-- ============================================
SELECT 
  '=== FUNCTION SEARCH PATH CHECK ===' as section;

SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.proconfig IS NULL THEN '❌ NO SEARCH PATH SET'
    WHEN p.proconfig @> ARRAY['search_path=public, pg_catalog'] THEN '✅ SEARCH PATH CONFIGURED'
    ELSE '⚠️ DIFFERENT SEARCH PATH: ' || array_to_string(p.proconfig, ', ')
  END as status,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'update_updated_at_column',
  'sync_feedback_status',
  'log_teacher_request_status_change',
  'update_email_queue_timestamp',
  'trigger_set_timestamp',
  'handle_new_user',
  'has_role',
  'current_user_has_role',
  'setup_initial_admin',
  'get_current_user_roles',
  'get_teachers_with_stats',
  'get_teachers_count',
  'create_anonymous_rating',
  'prevent_duplicate_reviews',
  'check_existing_review',
  'get_user_review_info',
  'cleanup_old_rate_limits'
)
ORDER BY 
  CASE 
    WHEN p.proconfig IS NULL THEN 1
    WHEN NOT (p.proconfig @> ARRAY['search_path=public, pg_catalog']) THEN 2
    ELSE 3
  END,
  p.proname;

-- ============================================
-- 3. Summary of All Security Issues
-- ============================================
SELECT 
  '=== SECURITY ISSUES SUMMARY ===' as section;

WITH security_checks AS (
  -- Count SECURITY DEFINER views
  SELECT 
    'SECURITY DEFINER Views' as issue_type,
    COUNT(*) as count,
    'ERROR' as severity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND pg_get_viewdef(c.oid, true) LIKE '%SECURITY DEFINER%'
  
  UNION ALL
  
  -- Count functions without search_path
  SELECT 
    'Functions without search_path' as issue_type,
    COUNT(*) as count,
    'WARNING' as severity
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (p.proconfig IS NULL OR NOT (p.proconfig @> ARRAY['search_path=public, pg_catalog']))
  
  UNION ALL
  
  -- Count tables without RLS
  SELECT 
    'Tables without RLS' as issue_type,
    COUNT(*) as count,
    'ERROR' as severity
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  WHERE t.schemaname = 'public'
  AND NOT c.relrowsecurity
  AND t.tablename NOT IN ('schema_migrations', 'supabase_functions_migrations')
)
SELECT 
  issue_type,
  severity,
  count as issues_found,
  CASE 
    WHEN count = 0 THEN '✅ RESOLVED'
    WHEN severity = 'ERROR' THEN '❌ NEEDS FIX'
    ELSE '⚠️ WARNING'
  END as status
FROM security_checks
ORDER BY 
  CASE severity 
    WHEN 'ERROR' THEN 1 
    WHEN 'WARNING' THEN 2 
    ELSE 3 
  END,
  count DESC;

-- ============================================
-- 4. Detailed View Definitions (for debugging)
-- ============================================
SELECT 
  '=== VIEW DEFINITIONS (First 100 chars) ===' as section;

SELECT 
  c.relname as view_name,
  LEFT(pg_get_viewdef(c.oid, true), 100) as definition_preview,
  CASE 
    WHEN pg_get_viewdef(c.oid, true) LIKE '%SECURITY%' THEN 'Contains SECURITY keyword'
    ELSE 'No SECURITY keyword found'
  END as security_check
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'v'
AND c.relname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles');

-- ============================================
-- 5. Check All Functions in Database
-- ============================================
SELECT 
  '=== ALL FUNCTIONS STATUS ===' as section;

SELECT 
  COUNT(*) as total_functions,
  COUNT(CASE WHEN p.proconfig IS NULL THEN 1 END) as without_search_path,
  COUNT(CASE WHEN p.proconfig @> ARRAY['search_path=public, pg_catalog'] THEN 1 END) as with_correct_search_path,
  COUNT(CASE WHEN p.prosecdef THEN 1 END) as security_definer_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- ============================================
-- 6. Final Status Report
-- ============================================
SELECT 
  '=== FINAL SECURITY STATUS ===' as section;

SELECT 
  CASE 
    WHEN (
      SELECT COUNT(*)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND pg_get_viewdef(c.oid, true) LIKE '%SECURITY DEFINER%'
    ) = 0 
    AND (
      SELECT COUNT(*)
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (p.proconfig IS NULL OR NOT (p.proconfig @> ARRAY['search_path=public, pg_catalog']))
    ) = 0
    THEN '🎉 ALL SECURITY ISSUES RESOLVED! Database is secure.'
    ELSE '⚠️ Some security issues remain. Please review the details above.'
  END as final_status;