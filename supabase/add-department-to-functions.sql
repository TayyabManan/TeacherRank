-- Add department field to database functions
-- This ensures department data is included when fetching teachers

-- Drop existing function to recreate with department field
DROP FUNCTION IF EXISTS public.get_teachers_with_stats CASCADE;

-- Recreate function with department field included
CREATE OR REPLACE FUNCTION public.get_teachers_with_stats(
  search_query text DEFAULT NULL,
  institute_filter text DEFAULT NULL,
  sort_by text DEFAULT 'rating_desc',
  page_num int DEFAULT 1,
  page_size int DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  name text,
  institute text,
  department text,  -- Added department field
  designation text,
  city text,
  linkedin_url text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  average_rating numeric,
  ratings_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.institute,
    t.department,  -- Include department in selection
    t.designation,
    t.city,
    t.linkedin_url,
    t.avatar_url,
    t.bio,
    t.created_at,
    COALESCE(AVG(r.score), 0) as average_rating,
    COUNT(r.id) as ratings_count
  FROM teachers t
  LEFT JOIN ratings r ON r.teacher_id = t.id
  WHERE
    (search_query IS NULL OR search_query = '' OR
     t.name ILIKE '%' || search_query || '%' OR
     t.institute ILIKE '%' || search_query || '%' OR
     t.department ILIKE '%' || search_query || '%' OR  -- Also search in department
     t.designation ILIKE '%' || search_query || '%' OR
     t.city ILIKE '%' || search_query || '%')
    AND (institute_filter IS NULL OR institute_filter = 'all' OR t.institute = institute_filter)
  GROUP BY t.id
  ORDER BY
    CASE
      WHEN sort_by = 'rating_desc' THEN COALESCE(AVG(r.score), 0)
      WHEN sort_by = 'rating_asc' THEN -COALESCE(AVG(r.score), 0)
      ELSE 0
    END DESC,
    CASE
      WHEN sort_by = 'name_asc' THEN t.name
      WHEN sort_by = 'institute_az' THEN t.institute
      ELSE t.name
    END ASC
  LIMIT page_size
  OFFSET (page_num - 1) * page_size;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_teachers_with_stats TO anon;
GRANT EXECUTE ON FUNCTION get_teachers_with_stats TO authenticated;

-- Also update the alternative version if it exists
DROP FUNCTION IF EXISTS public.get_teachers_with_stats(text, text, text, int, int) CASCADE;

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
  department text,  -- Added department field
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
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.institute,
    t.department,  -- Include department in selection
    t.designation,
    t.city,
    t.linkedin_url,
    t.avatar_url,
    t.bio,
    t.created_at,
    COALESCE(AVG(r.score), 0)::numeric as average_rating,
    COUNT(r.id)::bigint as ratings_count
  FROM teachers t
  LEFT JOIN ratings r ON t.id = r.teacher_id
  WHERE
    (institute_filter IS NULL OR t.institute = institute_filter)
    AND (search_query IS NULL OR search_query = '' OR
         t.name ILIKE '%' || search_query || '%' OR
         t.institute ILIKE '%' || search_query || '%' OR
         t.department ILIKE '%' || search_query || '%' OR  -- Also search in department
         t.designation ILIKE '%' || search_query || '%' OR
         t.city ILIKE '%' || search_query || '%' OR
         t.bio ILIKE '%' || search_query || '%')
  GROUP BY t.id, t.name, t.institute, t.department, t.designation, t.city, t.linkedin_url, t.avatar_url, t.bio, t.created_at
  ORDER BY
    CASE
      WHEN sort_by = 'rating_desc' THEN COALESCE(AVG(r.score), 0)
      WHEN sort_by = 'rating_asc' THEN -COALESCE(AVG(r.score), 0)
      ELSE 0
    END DESC,
    CASE
      WHEN sort_by = 'name_asc' THEN t.name
      WHEN sort_by = 'name_desc' THEN t.name
      WHEN sort_by = 'institute_asc' THEN t.institute
      WHEN sort_by = 'institute_desc' THEN t.institute
      ELSE t.name
    END,
    CASE
      WHEN sort_by = 'name_desc' THEN t.name
      WHEN sort_by = 'institute_desc' THEN t.institute
      ELSE NULL
    END DESC
  LIMIT page_size
  OFFSET page_offset;
END;
$$;

-- Grant permissions for the alternative version
GRANT EXECUTE ON FUNCTION get_teachers_with_stats(text, text, text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION get_teachers_with_stats(text, text, text, int, int) TO authenticated;

-- Verify the functions include department
SELECT
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_teachers_with_stats';

-- Test query to verify department is returned
-- SELECT * FROM get_teachers_with_stats() LIMIT 1;