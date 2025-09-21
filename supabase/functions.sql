-- Optimized database function for fetching teachers with stats
-- This eliminates N+1 query problems and improves performance

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_teachers_institute ON teachers(institute);
CREATE INDEX IF NOT EXISTS idx_teachers_name ON teachers(name);
CREATE INDEX IF NOT EXISTS idx_teachers_created_at ON teachers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_teacher_id ON ratings(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at DESC);

-- Optimized function to get teachers with stats in a single query
CREATE OR REPLACE FUNCTION get_teachers_with_stats(
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
  WITH teacher_stats AS (
    SELECT 
      r.teacher_id,
      COALESCE(AVG(r.score)::numeric(3,2), 0) as avg_rating,
      COUNT(r.id) as rating_count
    FROM ratings r
    GROUP BY r.teacher_id
  )
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
    COALESCE(ts.avg_rating, 0) as average_rating,
    COALESCE(ts.rating_count, 0) as ratings_count
  FROM teachers t
  LEFT JOIN teacher_stats ts ON t.id = ts.teacher_id
  WHERE 
    (search_query IS NULL OR search_query = '' OR 
     t.name ILIKE '%' || search_query || '%' OR 
     t.institute ILIKE '%' || search_query || '%')
    AND (institute_filter IS NULL OR institute_filter = 'all' OR t.institute = institute_filter)
  ORDER BY 
    CASE WHEN sort_by = 'rating_desc' THEN COALESCE(ts.avg_rating, 0) END DESC NULLS LAST,
    CASE WHEN sort_by = 'rating_asc' THEN COALESCE(ts.avg_rating, 0) END ASC NULLS LAST,
    CASE WHEN sort_by = 'name_az' THEN t.name END ASC,
    CASE WHEN sort_by = 'institute_az' THEN t.institute END ASC,
    t.created_at DESC
  LIMIT page_size
  OFFSET (page_num - 1) * page_size;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_teachers_with_stats TO anon;
GRANT EXECUTE ON FUNCTION get_teachers_with_stats TO authenticated;

-- Function to get teacher count for pagination
CREATE OR REPLACE FUNCTION get_teachers_count(
  search_query text DEFAULT NULL,
  institute_filter text DEFAULT NULL
)
RETURNS bigint AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM teachers t
    WHERE 
      (search_query IS NULL OR search_query = '' OR 
       t.name ILIKE '%' || search_query || '%' OR 
       t.institute ILIKE '%' || search_query || '%')
      AND (institute_filter IS NULL OR institute_filter = 'all' OR t.institute = institute_filter)
  );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_teachers_count TO anon;
GRANT EXECUTE ON FUNCTION get_teachers_count TO authenticated;