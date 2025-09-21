-- Fix the final function search path warning
-- This fixes the get_user_review_info function

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_user_review_info(uuid) CASCADE;

-- Recreate with explicit search_path to prevent security issues
CREATE OR REPLACE FUNCTION public.get_user_review_info(p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog  -- This is the critical line that fixes the warning
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

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.get_user_review_info(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_review_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_review_info(uuid) TO service_role;

-- Verify the fix
SELECT 
  'Function Search Path Check:' as check_type,
  p.proname as function_name,
  CASE 
    WHEN p.proconfig IS NULL THEN '❌ NO search_path set'
    WHEN p.proconfig @> ARRAY['search_path=public, pg_catalog'] THEN '✅ Search path properly configured'
    ELSE '⚠️ Different search path: ' || array_to_string(p.proconfig, ', ')
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_user_review_info';

-- Final status
SELECT '===========================================' as line
UNION ALL
SELECT 'Function search path warning should now be fixed!'
UNION ALL
SELECT ''
UNION ALL
SELECT 'The only remaining warning should be:'
UNION ALL
SELECT '- Leaked Password Protection (Auth setting, not database)'
UNION ALL
SELECT ''
UNION ALL
SELECT 'To fix the Auth warning:'
UNION ALL
SELECT '1. Go to Supabase Dashboard → Authentication → Settings'
UNION ALL
SELECT '2. Enable "Leaked password protection"'
UNION ALL
SELECT '3. Save the settings'
UNION ALL
SELECT '===========================================';