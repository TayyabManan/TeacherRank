-- Fix Remaining Security Issues - Final Version
-- This script forcefully removes and recreates the problematic views

-- ============================================
-- PART 1: Aggressively Fix SECURITY DEFINER Views
-- ============================================

-- First, check what's currently defined
SELECT 'Current view definitions:' as info;
SELECT c.relname, pg_get_viewdef(c.oid, true) as definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'v'
AND c.relname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles');

-- Drop all three views with CASCADE to remove any dependencies
DROP VIEW IF EXISTS public.teacher_aggregates CASCADE;
DROP VIEW IF EXISTS public.ratings_with_info CASCADE;
DROP VIEW IF EXISTS public.user_profiles_with_roles CASCADE;

-- Verify they're dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles')
  ) THEN
    RAISE EXCEPTION 'Views still exist after DROP. Manual intervention required.';
  ELSE
    RAISE NOTICE 'Views successfully dropped.';
  END IF;
END $$;

-- Recreate views explicitly with SECURITY INVOKER (not DEFINER)
-- Note: Views are SECURITY INVOKER by default, but we'll be explicit

-- 1. Teacher aggregates view - EXPLICITLY WITHOUT SECURITY DEFINER
CREATE VIEW public.teacher_aggregates 
WITH (security_invoker = true) AS
SELECT
  teacher_id,
  avg(score)::numeric(3,2) as avg_rating,
  count(*)::bigint as ratings_count
FROM public.ratings
GROUP BY teacher_id;

-- Set ownership and permissions
ALTER VIEW public.teacher_aggregates OWNER TO postgres;
GRANT SELECT ON public.teacher_aggregates TO anon;
GRANT SELECT ON public.teacher_aggregates TO authenticated;
GRANT ALL ON public.teacher_aggregates TO postgres;
GRANT ALL ON public.teacher_aggregates TO service_role;

-- 2. Ratings with info view - EXPLICITLY WITHOUT SECURITY DEFINER
CREATE VIEW public.ratings_with_info 
WITH (security_invoker = true) AS
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
  p.display_name as student_name
FROM public.ratings r
LEFT JOIN public.teachers t ON r.teacher_id = t.id
LEFT JOIN public.profiles p ON r.student_id = p.id;

-- Set ownership and permissions
ALTER VIEW public.ratings_with_info OWNER TO postgres;
GRANT SELECT ON public.ratings_with_info TO anon;
GRANT SELECT ON public.ratings_with_info TO authenticated;
GRANT ALL ON public.ratings_with_info TO postgres;
GRANT ALL ON public.ratings_with_info TO service_role;

-- 3. User profiles with roles view - EXPLICITLY WITHOUT SECURITY DEFINER
CREATE VIEW public.user_profiles_with_roles 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.role,
  p.created_at,
  CASE 
    WHEN p.role = 'admin' THEN true
    ELSE false
  END as is_admin
FROM public.profiles p;

-- Set ownership and permissions
ALTER VIEW public.user_profiles_with_roles OWNER TO postgres;
GRANT SELECT ON public.user_profiles_with_roles TO authenticated;
GRANT ALL ON public.user_profiles_with_roles TO postgres;
GRANT ALL ON public.user_profiles_with_roles TO service_role;

-- Add comments
COMMENT ON VIEW public.teacher_aggregates IS 'Teacher rating aggregates - SECURITY INVOKER view';
COMMENT ON VIEW public.ratings_with_info IS 'Ratings with related information - SECURITY INVOKER view';
COMMENT ON VIEW public.user_profiles_with_roles IS 'User profiles with role information - SECURITY INVOKER view';

-- ============================================
-- PART 2: Fix the remaining function (get_user_review_info)
-- ============================================

-- Drop and recreate with search_path
DROP FUNCTION IF EXISTS public.get_user_review_info(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_review_info(p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_existing_review record;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'can_review', true,
      'has_reviewed', false,
      'existing_review', null
    );
  END IF;
  
  SELECT id, score, comment, created_at
  INTO v_existing_review
  FROM public.ratings
  WHERE teacher_id = p_teacher_id
  AND student_id = v_user_id
  LIMIT 1;
  
  IF v_existing_review.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_review', false,
      'has_reviewed', true,
      'existing_review', jsonb_build_object(
        'id', v_existing_review.id,
        'score', v_existing_review.score,
        'comment', v_existing_review.comment,
        'created_at', v_existing_review.created_at
      )
    );
  ELSE
    RETURN jsonb_build_object(
      'can_review', true,
      'has_reviewed', false,
      'existing_review', null
    );
  END IF;
END;
$$;

-- ============================================
-- PART 3: Alternative approach if views still show SECURITY DEFINER
-- ============================================
-- If the above doesn't work, try this more aggressive approach

DO $$
DECLARE
  view_rec RECORD;
BEGIN
  -- Get the actual view definitions
  FOR view_rec IN 
    SELECT c.relname, n.nspname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND c.relname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles')
  LOOP
    -- Check if view has SECURITY DEFINER
    IF EXISTS (
      SELECT 1 
      FROM pg_views 
      WHERE schemaname = view_rec.nspname 
      AND viewname = view_rec.relname
      AND definition LIKE '%SECURITY DEFINER%'
    ) THEN
      RAISE WARNING 'View %.% may still have SECURITY DEFINER in its definition', view_rec.nspname, view_rec.relname;
      
      -- Try to alter the view's security setting directly
      EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', view_rec.nspname, view_rec.relname);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- PART 4: Verification
-- ============================================

-- Check views for SECURITY DEFINER
SELECT 
  'Checking views for SECURITY DEFINER:' as check_type,
  c.relname as view_name,
  CASE 
    WHEN pg_get_viewdef(c.oid, true) LIKE '%SECURITY DEFINER%' THEN '❌ STILL HAS SECURITY DEFINER'
    ELSE '✅ SECURITY INVOKER (Safe)'
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'v'
AND c.relname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles');

-- Check function search paths
SELECT 
  'Checking function search paths:' as check_type,
  p.proname as function_name,
  CASE 
    WHEN p.proconfig @> ARRAY['search_path=public, pg_catalog'] THEN '✅ Search path configured'
    ELSE '❌ Search path not configured'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_user_review_info';

-- Final message
SELECT '===========================================' as line
UNION ALL
SELECT 'Script complete. Check the results above.'
UNION ALL
SELECT 'If views still show SECURITY DEFINER, they may'
UNION ALL
SELECT 'have been created with it in another schema or'
UNION ALL  
SELECT 'require manual DROP and CREATE in Supabase UI.'
UNION ALL
SELECT '===========================================';