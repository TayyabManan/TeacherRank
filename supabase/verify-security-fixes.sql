-- Verification Script for Security Fixes
-- Run this after applying fix-security-issues.sql to verify all issues are resolved

-- ============================================
-- 1. Check for SECURITY DEFINER views
-- ============================================
SELECT 
  n.nspname as schema_name,
  c.relname as view_name,
  CASE 
    WHEN c.relkind = 'v' AND NOT c.relrowsecurity THEN 'VIEW'
    WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
  END as view_type,
  pg_get_viewdef(c.oid) LIKE '%SECURITY DEFINER%' as has_security_definer
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind IN ('v', 'm')
ORDER BY c.relname;

-- ============================================
-- 2. Check RLS status on all tables
-- ============================================
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN c.relrowsecurity THEN '✓ ENABLED'
    ELSE '✗ DISABLED'
  END as rls_status,
  CASE 
    WHEN c.relrowsecurity THEN 'PASS'
    ELSE 'FAIL - RLS should be enabled'
  END as security_check
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE schemaname = 'public'
AND tablename NOT IN ('schema_migrations', 'supabase_functions_migrations')
ORDER BY 
  CASE WHEN c.relrowsecurity THEN 1 ELSE 0 END,
  tablename;

-- ============================================
-- 3. Check RLS policies on critical tables
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL as has_using_clause,
  with_check IS NOT NULL as has_with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('teacher_request_audit', 'email_queue')
ORDER BY tablename, policyname;

-- ============================================
-- 4. Summary Report
-- ============================================
WITH security_summary AS (
  -- Count tables without RLS
  SELECT 
    'Tables without RLS' as issue_type,
    COUNT(*) as count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  WHERE schemaname = 'public'
  AND NOT c.relrowsecurity
  AND tablename NOT IN ('schema_migrations', 'supabase_functions_migrations')
  
  UNION ALL
  
  -- Count views with SECURITY DEFINER
  SELECT 
    'Views with SECURITY DEFINER' as issue_type,
    COUNT(*) as count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  AND c.relkind IN ('v', 'm')
  AND pg_get_viewdef(c.oid) LIKE '%SECURITY DEFINER%'
)
SELECT 
  issue_type,
  count,
  CASE 
    WHEN count = 0 THEN '✓ RESOLVED'
    ELSE '✗ NEEDS ATTENTION'
  END as status
FROM security_summary
ORDER BY count DESC;

-- ============================================
-- 5. List all views and their security context
-- ============================================
SELECT 
  c.relname as view_name,
  CASE 
    WHEN pg_get_viewdef(c.oid) LIKE '%SECURITY DEFINER%' THEN 'DEFINER'
    ELSE 'INVOKER (Default)'
  END as security_context,
  CASE 
    WHEN pg_get_viewdef(c.oid) LIKE '%SECURITY DEFINER%' THEN '✗ SECURITY RISK'
    ELSE '✓ SECURE'
  END as security_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'v'
ORDER BY c.relname;

-- ============================================
-- 6. Check if specific tables have appropriate policies
-- ============================================
WITH required_tables AS (
  SELECT unnest(ARRAY[
    'profiles',
    'teachers', 
    'ratings',
    'teacher_requests',
    'teacher_request_audit',
    'email_queue',
    'feedback',
    'feedback_responses'
  ]) as tablename
),
table_policies AS (
  SELECT 
    tablename,
    COUNT(DISTINCT policyname) as policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT 
  rt.tablename,
  COALESCE(tp.policy_count, 0) as policy_count,
  CASE 
    WHEN c.relrowsecurity IS NULL THEN 'TABLE NOT FOUND'
    WHEN NOT c.relrowsecurity THEN '✗ RLS DISABLED'
    WHEN COALESCE(tp.policy_count, 0) = 0 THEN '⚠ RLS ENABLED BUT NO POLICIES'
    ELSE '✓ RLS ENABLED WITH ' || tp.policy_count || ' POLICIES'
  END as status
FROM required_tables rt
LEFT JOIN table_policies tp ON rt.tablename = tp.tablename
LEFT JOIN pg_tables t ON t.tablename = rt.tablename AND t.schemaname = 'public'
LEFT JOIN pg_class c ON c.relname = rt.tablename
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
ORDER BY 
  CASE 
    WHEN c.relrowsecurity IS NULL THEN 1
    WHEN NOT c.relrowsecurity THEN 2
    WHEN COALESCE(tp.policy_count, 0) = 0 THEN 3
    ELSE 4
  END,
  rt.tablename;