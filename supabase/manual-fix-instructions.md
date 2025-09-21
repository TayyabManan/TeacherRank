# Manual Fix Instructions for Persistent SECURITY DEFINER Views

If the views still show SECURITY DEFINER errors after running the SQL scripts, follow these manual steps in the Supabase Dashboard:

## Step 1: Access SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor

## Step 2: Manually Drop and Recreate Each View

### Fix teacher_aggregates view:
```sql
-- 1. First drop the view completely
DROP VIEW IF EXISTS public.teacher_aggregates CASCADE;

-- 2. Recreate without SECURITY DEFINER
CREATE OR REPLACE VIEW public.teacher_aggregates AS
SELECT
  teacher_id,
  avg(score)::numeric(3,2) as avg_rating,
  count(*)::bigint as ratings_count
FROM public.ratings
GROUP BY teacher_id;

-- 3. Grant permissions
GRANT SELECT ON public.teacher_aggregates TO anon;
GRANT SELECT ON public.teacher_aggregates TO authenticated;
```

### Fix ratings_with_info view:
```sql
-- 1. First drop the view completely
DROP VIEW IF EXISTS public.ratings_with_info CASCADE;

-- 2. Recreate without SECURITY DEFINER
CREATE OR REPLACE VIEW public.ratings_with_info AS
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

-- 3. Grant permissions
GRANT SELECT ON public.ratings_with_info TO anon;
GRANT SELECT ON public.ratings_with_info TO authenticated;
```

### Fix user_profiles_with_roles view:
```sql
-- 1. First drop the view completely
DROP VIEW IF EXISTS public.user_profiles_with_roles CASCADE;

-- 2. Recreate without SECURITY DEFINER
CREATE OR REPLACE VIEW public.user_profiles_with_roles AS
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

-- 3. Grant permissions
GRANT SELECT ON public.user_profiles_with_roles TO authenticated;
```

## Step 3: Fix the Function
```sql
-- Fix get_user_review_info function
DROP FUNCTION IF EXISTS public.get_user_review_info(uuid);

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
```

## Step 4: Verify the Fixes

Run this verification query:
```sql
-- Check if views still have SECURITY DEFINER
SELECT 
  viewname,
  CASE 
    WHEN definition LIKE '%SECURITY DEFINER%' THEN '❌ Still has SECURITY DEFINER'
    ELSE '✅ Fixed - SECURITY INVOKER'
  END as status
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles');
```

## Alternative: Check for Hidden View Definitions

Sometimes views might have been created with SECURITY DEFINER at the SQL level. Check with:
```sql
-- Direct check in pg_class
SELECT 
  c.relname,
  c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'v'
AND c.relname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles');
```

## If Issues Persist

If the Supabase linter still reports these as SECURITY DEFINER after the above steps:

1. **Check for view dependencies**: Other objects might be forcing these views to retain SECURITY DEFINER
2. **Try renaming approach**: 
   - Create new views with different names (e.g., `teacher_aggregates_v2`)
   - Update your application to use the new view names
   - Drop the old views
3. **Contact Supabase Support**: There might be a platform-specific issue

## Note on the Password Protection Warning

The "Leaked Password Protection Disabled" warning is a configuration setting in Supabase Auth, not a database issue. To fix it:

1. Go to Authentication → Settings in your Supabase Dashboard
2. Enable "Leaked password protection"
3. Save the settings

This will check passwords against the HaveIBeenPwned database to prevent use of compromised passwords.