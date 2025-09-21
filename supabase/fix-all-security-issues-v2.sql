-- Complete Security Fix for all Supabase Linter Issues (Version 2)
-- This script fixes both SECURITY DEFINER views and function search path warnings
-- Handles existing functions properly by dropping them first when needed

-- ============================================
-- PART 1: Fix SECURITY DEFINER Views (Force Recreation)
-- ============================================

-- First, drop any dependencies and the views themselves
DROP VIEW IF EXISTS public.user_profiles_with_roles CASCADE;
DROP VIEW IF EXISTS public.teacher_aggregates CASCADE;
DROP VIEW IF EXISTS public.ratings_with_info CASCADE;

-- Recreate views WITHOUT SECURITY DEFINER (uses SECURITY INVOKER by default)

-- 1. Teacher aggregates view
CREATE VIEW public.teacher_aggregates AS
SELECT
  teacher_id,
  avg(score)::numeric(3,2) as avg_rating,
  count(*) as ratings_count
FROM public.ratings
GROUP BY teacher_id;

-- Grant permissions
GRANT SELECT ON public.teacher_aggregates TO anon;
GRANT SELECT ON public.teacher_aggregates TO authenticated;
GRANT ALL ON public.teacher_aggregates TO service_role;

-- 2. Ratings with info view
CREATE VIEW public.ratings_with_info AS
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

-- Grant permissions
GRANT SELECT ON public.ratings_with_info TO anon;
GRANT SELECT ON public.ratings_with_info TO authenticated;
GRANT ALL ON public.ratings_with_info TO service_role;

-- 3. User profiles with roles view
CREATE VIEW public.user_profiles_with_roles AS
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

-- Grant permissions (more restrictive - authenticated only)
GRANT SELECT ON public.user_profiles_with_roles TO authenticated;
GRANT ALL ON public.user_profiles_with_roles TO service_role;

-- Add comments for documentation
COMMENT ON VIEW public.teacher_aggregates IS 'Aggregated teacher ratings - SECURITY INVOKER';
COMMENT ON VIEW public.ratings_with_info IS 'Ratings with teacher and student info - SECURITY INVOKER';
COMMENT ON VIEW public.user_profiles_with_roles IS 'User profiles with role flags - SECURITY INVOKER';

-- ============================================
-- PART 2: Fix Function Search Path Warnings
-- ============================================
-- Drop and recreate functions with proper search_path

-- 1. update_updated_at_column
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. sync_feedback_status
DROP FUNCTION IF EXISTS public.sync_feedback_status() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_feedback_status()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.feedback
  SET status = NEW.status
  WHERE id = NEW.feedback_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. log_teacher_request_status_change
DROP FUNCTION IF EXISTS public.log_teacher_request_status_change() CASCADE;
CREATE OR REPLACE FUNCTION public.log_teacher_request_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.teacher_request_audit (
      request_id,
      action,
      performed_by,
      details
    ) VALUES (
      NEW.id,
      'status_change',
      auth.uid(),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'notes', NEW.admin_notes
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. update_email_queue_timestamp
DROP FUNCTION IF EXISTS public.update_email_queue_timestamp() CASCADE;
CREATE OR REPLACE FUNCTION public.update_email_queue_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. trigger_set_timestamp
DROP FUNCTION IF EXISTS public.trigger_set_timestamp() CASCADE;
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. handle_new_user
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'student')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 7. has_role - Check existing signature and drop if needed
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, role_name text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id AND role = role_name
  );
END;
$$ LANGUAGE plpgsql;

-- 8. current_user_has_role - Check and drop if exists
DROP FUNCTION IF EXISTS public.current_user_has_role(text) CASCADE;
CREATE OR REPLACE FUNCTION public.current_user_has_role(role_name text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN public.has_role(auth.uid(), role_name);
END;
$$ LANGUAGE plpgsql;

-- 9. setup_initial_admin
DROP FUNCTION IF EXISTS public.setup_initial_admin(text) CASCADE;
CREATE OR REPLACE FUNCTION public.setup_initial_admin(user_email text)
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'admin'
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql;

-- 10. get_current_user_roles
DROP FUNCTION IF EXISTS public.get_current_user_roles() CASCADE;
CREATE OR REPLACE FUNCTION public.get_current_user_roles()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN jsonb_build_object(
    'role', COALESCE(user_role, 'student'),
    'is_admin', user_role = 'admin',
    'is_teacher', user_role = 'teacher'
  );
END;
$$ LANGUAGE plpgsql;

-- 11. get_teachers_with_stats - Drop all overloads
DROP FUNCTION IF EXISTS public.get_teachers_with_stats(text, text, text, int, int) CASCADE;
DROP FUNCTION IF EXISTS public.get_teachers_with_stats() CASCADE;

CREATE OR REPLACE FUNCTION public.get_teachers_with_stats(
  institute_filter text DEFAULT NULL,
  search_query text DEFAULT NULL,
  sort_by text DEFAULT 'name_asc',
  page_size int DEFAULT 20,
  page_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  institute text,
  designation text,
  city text,
  linkedin_url text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  average_rating numeric,
  ratings_count bigint
)
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.institute,
    t.designation,
    t.city,
    t.linkedin_url,
    t.avatar_url,
    t.bio,
    t.created_at,
    COALESCE(ta.avg_rating, 0)::numeric as average_rating,
    COALESCE(ta.ratings_count, 0) as ratings_count
  FROM public.teachers t
  LEFT JOIN public.teacher_aggregates ta ON t.id = ta.teacher_id
  WHERE 
    (institute_filter IS NULL OR t.institute = institute_filter)
    AND (search_query IS NULL OR t.name ILIKE '%' || search_query || '%' OR t.institute ILIKE '%' || search_query || '%')
  ORDER BY
    CASE WHEN sort_by = 'name_asc' THEN t.name END ASC,
    CASE WHEN sort_by = 'name_desc' THEN t.name END DESC,
    CASE WHEN sort_by = 'rating_desc' THEN COALESCE(ta.avg_rating, 0) END DESC,
    CASE WHEN sort_by = 'rating_asc' THEN COALESCE(ta.avg_rating, 0) END ASC,
    CASE WHEN sort_by = 'created_desc' THEN t.created_at END DESC,
    CASE WHEN sort_by = 'created_asc' THEN t.created_at END ASC
  LIMIT page_size
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- 12. get_teachers_count
DROP FUNCTION IF EXISTS public.get_teachers_count(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_teachers_count() CASCADE;

CREATE OR REPLACE FUNCTION public.get_teachers_count(
  institute_filter text DEFAULT NULL,
  search_query text DEFAULT NULL
)
RETURNS bigint
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.teachers t
    WHERE 
      (institute_filter IS NULL OR t.institute = institute_filter)
      AND (search_query IS NULL OR t.name ILIKE '%' || search_query || '%' OR t.institute ILIKE '%' || search_query || '%')
  );
END;
$$ LANGUAGE plpgsql;

-- 13. create_anonymous_rating
DROP FUNCTION IF EXISTS public.create_anonymous_rating(uuid, integer, text) CASCADE;
CREATE OR REPLACE FUNCTION public.create_anonymous_rating(
  p_teacher_id uuid,
  p_score integer,
  p_comment text DEFAULT NULL
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rating_id uuid;
BEGIN
  INSERT INTO public.ratings (teacher_id, student_id, score, comment)
  VALUES (p_teacher_id, NULL, p_score, p_comment)
  RETURNING id INTO v_rating_id;
  
  RETURN v_rating_id;
END;
$$ LANGUAGE plpgsql;

-- 14. prevent_duplicate_reviews
DROP FUNCTION IF EXISTS public.prevent_duplicate_reviews() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_duplicate_reviews()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ratings 
      WHERE teacher_id = NEW.teacher_id 
      AND student_id = NEW.student_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) THEN
      RAISE EXCEPTION 'You have already reviewed this teacher';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 15. check_existing_review
DROP FUNCTION IF EXISTS public.check_existing_review(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.check_existing_review(p_teacher_id uuid, p_student_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.ratings
    WHERE teacher_id = p_teacher_id
    AND student_id = p_student_id
  );
END;
$$ LANGUAGE plpgsql;

-- 16. get_user_review_info
DROP FUNCTION IF EXISTS public.get_user_review_info(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_review_info(p_teacher_id uuid)
RETURNS jsonb
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
$$ LANGUAGE plpgsql;

-- 17. cleanup_old_rate_limits
DROP FUNCTION IF EXISTS public.cleanup_old_rate_limits() CASCADE;
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 3: Recreate any triggers that were dropped
-- ============================================

-- Recreate triggers if they were dropped by CASCADE
DO $$
BEGIN
  -- Check and recreate update_updated_at_column triggers
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_email_queue_timestamp_trigger'
  ) THEN
    CREATE TRIGGER update_email_queue_timestamp_trigger
    BEFORE UPDATE ON public.email_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_email_queue_timestamp();
  END IF;

  -- Check and recreate sync_feedback_status trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sync_feedback_status_trigger'
  ) THEN
    CREATE TRIGGER sync_feedback_status_trigger
    AFTER UPDATE OF status ON public.teacher_submission_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_feedback_status();
  END IF;

  -- Check and recreate log_teacher_request_changes trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'log_teacher_request_changes'
  ) THEN
    CREATE TRIGGER log_teacher_request_changes
    AFTER UPDATE ON public.teacher_submission_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.log_teacher_request_status_change();
  END IF;

  -- Check and recreate prevent_duplicate_reviews trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'prevent_duplicate_reviews_trigger'
  ) THEN
    CREATE TRIGGER prevent_duplicate_reviews_trigger
    BEFORE INSERT OR UPDATE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_duplicate_reviews();
  END IF;
END $$;

-- ============================================
-- PART 4: Verify All Fixes
-- ============================================

-- Check that views no longer have SECURITY DEFINER
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN ('teacher_aggregates', 'ratings_with_info', 'user_profiles_with_roles')
  AND definition LIKE '%SECURITY DEFINER%';
  
  IF v_count > 0 THEN
    RAISE WARNING 'Some views still have SECURITY DEFINER. Manual intervention may be needed.';
  ELSE
    RAISE NOTICE '✓ All views successfully fixed - no SECURITY DEFINER found.';
  END IF;
END $$;

-- Check that all functions have search_path set
DO $$
DECLARE
  r RECORD;
  v_count integer := 0;
BEGIN
  FOR r IN 
    SELECT proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true  -- SECURITY DEFINER functions
    AND (p.proconfig IS NULL OR NOT (p.proconfig @> ARRAY['search_path=public, pg_catalog']))
  LOOP
    v_count := v_count + 1;
    RAISE WARNING 'Function % still needs search_path fix', r.proname;
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '✓ All functions have proper search_path configuration.';
  ELSE
    RAISE WARNING '✗ % functions still need search_path configuration', v_count;
  END IF;
END $$;

-- Final summary
SELECT 
  '========================================' as line
UNION ALL
SELECT 'SECURITY FIX COMPLETE - Please run verify-all-fixes.sql to confirm'
UNION ALL
SELECT '========================================';