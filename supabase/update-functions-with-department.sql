-- Update database functions to support department filtering
-- This adds department_filter parameter to the existing functions

-- Drop existing function to recreate with department parameter
DROP FUNCTION IF EXISTS public.get_teachers_with_stats CASCADE;

-- Recreate function with department filter
CREATE OR REPLACE FUNCTION public.get_teachers_with_stats(
  search_query text DEFAULT NULL,
  institute_filter text DEFAULT NULL,
  department_filter text DEFAULT NULL,  -- New parameter
  sort_by text DEFAULT 'rating_desc',
  page_num int DEFAULT 1,
  page_size int DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  name text,
  institute text,
  "department" text,  -- Note: Capital D to match column name
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
    t."department",  -- Capital D
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
     t."department" ILIKE '%' || search_query || '%' OR  -- Search in department
     t.designation ILIKE '%' || search_query || '%' OR
     t.city ILIKE '%' || search_query || '%')
    AND (institute_filter IS NULL OR institute_filter = 'all' OR t.institute = institute_filter)
    AND (department_filter IS NULL OR department_filter = 'all' OR t."department" = department_filter)  -- department filter
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_teachers_with_stats TO anon;
GRANT EXECUTE ON FUNCTION get_teachers_with_stats TO authenticated;

-- Update the count function as well
DROP FUNCTION IF EXISTS public.get_teachers_count CASCADE;

CREATE OR REPLACE FUNCTION public.get_teachers_count(
  search_query text DEFAULT NULL,
  institute_filter text DEFAULT NULL,
  department_filter text DEFAULT NULL  -- New parameter
)
RETURNS bigint AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM teachers t
    WHERE
      (search_query IS NULL OR search_query = '' OR
       t.name ILIKE '%' || search_query || '%' OR
       t.institute ILIKE '%' || search_query || '%' OR
       t."department" ILIKE '%' || search_query || '%' OR
       t.designation ILIKE '%' || search_query || '%' OR
       t.city ILIKE '%' || search_query || '%')
      AND (institute_filter IS NULL OR institute_filter = 'all' OR t.institute = institute_filter)
      AND (department_filter IS NULL OR department_filter = 'all' OR t."department" = department_filter)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions for count function
GRANT EXECUTE ON FUNCTION get_teachers_count TO anon;
GRANT EXECUTE ON FUNCTION get_teachers_count TO authenticated;

-- Test the updated functions
-- SELECT * FROM get_teachers_with_stats(
--   search_query := NULL,
--   institute_filter := NULL,
--   department_filter := 'Computer Science',
--   sort_by := 'rating_desc',
--   page_num := 1,
--   page_size := 10
-- );

-- Verify unique departments
SELECT DISTINCT "department"
FROM teachers
WHERE "department" IS NOT NULL
ORDER BY "department";