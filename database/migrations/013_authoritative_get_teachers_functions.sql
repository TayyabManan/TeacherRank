-- Migration 013: one authoritative overload each of get_teachers_with_stats /
-- get_teachers_count, matching the client's exact call shape.
--
-- The deployed client calls both RPCs with a city_filter argument, but no live
-- overload accepts one — so every listing view got PGRST202 (404) and fell
-- back to downloading the ENTIRE teachers table plus a giant teacher_aggregates
-- in() query. This migration makes the deployed app's RPC calls start
-- succeeding with no client deploy.
--
-- Must apply AFTER 012 (reads teachers.avg_rating/ratings_count).
--
-- Sort literals the client sends: rating_desc | rating_asc | name_az |
-- institute_az (the old function silently mis-sorted name_az).

-- Drop every existing overload of both functions, whatever their signatures.
DO $do$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_teachers_with_stats', 'get_teachers_count')
  LOOP
    EXECUTE 'DROP FUNCTION ' || fn.sig;
  END LOOP;
END;
$do$;

CREATE FUNCTION public.get_teachers_with_stats(
  search_query text DEFAULT NULL,
  institute_filter text DEFAULT NULL,
  department_filter text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  sort_by text DEFAULT 'rating_desc',
  page_num integer DEFAULT 1,
  page_size integer DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  name text,
  institute text,
  department text,
  designation text,
  city text,
  linkedin_url text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  average_rating numeric,
  ratings_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.id, t.name, t.institute, t.department, t.designation, t.city,
    t.linkedin_url, t.avatar_url, t.bio, t.created_at,
    COALESCE(t.avg_rating, 0)::numeric AS average_rating,
    t.ratings_count::bigint AS ratings_count
  FROM public.teachers t
  WHERE
    (search_query IS NULL OR search_query = '' OR
     t.name ILIKE '%' || search_query || '%' OR
     t.institute ILIKE '%' || search_query || '%' OR
     t.department ILIKE '%' || search_query || '%' OR
     t.designation ILIKE '%' || search_query || '%' OR
     t.city ILIKE '%' || search_query || '%')
    AND (institute_filter IS NULL OR institute_filter = 'all' OR t.institute = institute_filter)
    AND (department_filter IS NULL OR department_filter = 'all' OR t.department = department_filter)
    AND (city_filter IS NULL OR city_filter = 'all' OR t.city = city_filter)
  ORDER BY
    CASE WHEN sort_by = 'rating_desc' THEN COALESCE(t.avg_rating, 0) END DESC,
    CASE WHEN sort_by = 'rating_desc' THEN t.ratings_count END DESC,
    CASE WHEN sort_by = 'rating_asc' THEN COALESCE(t.avg_rating, 0) END ASC,
    CASE WHEN sort_by = 'rating_asc' THEN t.ratings_count END ASC,
    CASE WHEN sort_by = 'institute_az' THEN t.institute END ASC,
    t.name ASC
  LIMIT page_size
  OFFSET (page_num - 1) * page_size
$$;

CREATE FUNCTION public.get_teachers_count(
  search_query text DEFAULT NULL,
  institute_filter text DEFAULT NULL,
  department_filter text DEFAULT NULL,
  city_filter text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)
  FROM public.teachers t
  WHERE
    (search_query IS NULL OR search_query = '' OR
     t.name ILIKE '%' || search_query || '%' OR
     t.institute ILIKE '%' || search_query || '%' OR
     t.department ILIKE '%' || search_query || '%' OR
     t.designation ILIKE '%' || search_query || '%' OR
     t.city ILIKE '%' || search_query || '%')
    AND (institute_filter IS NULL OR institute_filter = 'all' OR t.institute = institute_filter)
    AND (department_filter IS NULL OR department_filter = 'all' OR t.department = department_filter)
    AND (city_filter IS NULL OR city_filter = 'all' OR t.city = city_filter)
$$;

-- Pin search_path (advisor: function_search_path_mutable)
ALTER FUNCTION public.get_teachers_with_stats(text, text, text, text, text, integer, integer)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_teachers_count(text, text, text, text)
  SET search_path = public, pg_catalog;

-- Tell PostgREST to pick up the new signatures immediately.
NOTIFY pgrst, 'reload schema';

-- Verification (run after):
--   1. SELECT proname, pg_get_function_identity_arguments(oid)
--      FROM pg_proc WHERE proname LIKE 'get_teachers_%'  → exactly one row each
--      (plus get_teachers_with_stats_and_count until 016 drops it).
--   2. POST /rest/v1/rpc/get_teachers_with_stats with the client's exact JSON
--      body (includes city_filter) using the anon key → 200 with rows.
