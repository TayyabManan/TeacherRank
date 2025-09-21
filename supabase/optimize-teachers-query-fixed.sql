-- Performance Optimization for Teacher Queries (FIXED VERSION)
-- This script creates optimized functions and indexes for better performance
-- No dependency on 'status' column which doesn't exist

-- Create a combined function that gets teachers with stats and total count in one query
CREATE OR REPLACE FUNCTION get_teachers_with_stats_and_count(
  p_search TEXT DEFAULT NULL,
  p_institute TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'rating_desc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 12
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  total_count INT;
  page_num INT;
  page_size INT;
BEGIN
  -- Sanitize inputs
  page_num := GREATEST(1, COALESCE(p_page, 1));
  page_size := LEAST(100, GREATEST(1, COALESCE(p_page_size, 12)));
  
  -- Get total count and data in one query
  WITH filtered_teachers AS (
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
      COALESCE(ta.avg_rating::NUMERIC, 0) as average_rating,
      COALESCE(ta.ratings_count::BIGINT, 0) as ratings_count
    FROM teachers t
    LEFT JOIN teacher_aggregates ta ON t.id = ta.teacher_id
    WHERE 
      (p_search IS NULL OR p_search = '' OR (
        t.name ILIKE '%' || p_search || '%' OR
        t.institute ILIKE '%' || p_search || '%' OR
        t.bio ILIKE '%' || p_search || '%'
      ))
      AND (p_institute IS NULL OR p_institute = 'all' OR t.institute = p_institute)
  ),
  counted AS (
    SELECT COUNT(*) as total FROM filtered_teachers
  ),
  sorted_data AS (
    SELECT 
      *,
      (SELECT total FROM counted) as total_count
    FROM filtered_teachers
    ORDER BY
      CASE WHEN p_sort_by = 'rating_desc' THEN average_rating END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'rating_asc' THEN average_rating END ASC NULLS LAST,
      CASE WHEN p_sort_by = 'name_az' THEN name END ASC,
      CASE WHEN p_sort_by = 'name_za' THEN name END DESC,
      CASE WHEN p_sort_by = 'institute_az' THEN institute END ASC,
      CASE WHEN p_sort_by = 'institute_za' THEN institute END DESC,
      CASE WHEN p_sort_by = 'created_desc' THEN created_at END DESC,
      CASE WHEN p_sort_by = 'created_asc' THEN created_at END ASC,
      -- Secondary sort for stable ordering
      ratings_count DESC NULLS LAST,
      name ASC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size
  )
  SELECT jsonb_build_object(
    'data', jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'institute', institute,
        'designation', designation,
        'city', city,
        'linkedin_url', linkedin_url,
        'avatar_url', avatar_url,
        'bio', bio,
        'created_at', created_at,
        'average_rating', average_rating,
        'ratings_count', ratings_count
      ) ORDER BY 
        CASE WHEN p_sort_by = 'rating_desc' THEN average_rating END DESC NULLS LAST,
        CASE WHEN p_sort_by = 'rating_asc' THEN average_rating END ASC NULLS LAST,
        name ASC
    ),
    'total', COALESCE(MAX(total_count), 0),
    'page', page_num,
    'pageSize', page_size,
    'totalPages', CEIL(COALESCE(MAX(total_count), 0)::FLOAT / page_size)
  ) INTO result
  FROM sorted_data;
  
  RETURN COALESCE(result, jsonb_build_object(
    'data', '[]'::jsonb,
    'total', 0,
    'page', page_num,
    'pageSize', page_size,
    'totalPages', 0
  ));
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_teachers_with_stats_and_count TO anon, authenticated;

-- Add indexes for better performance (without status column)
CREATE INDEX IF NOT EXISTS idx_teachers_name 
  ON teachers(name);

CREATE INDEX IF NOT EXISTS idx_teachers_institute 
  ON teachers(institute);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_teachers_institute_name 
  ON teachers(institute, name);

-- Full text search index for better search performance
CREATE INDEX IF NOT EXISTS idx_teachers_search_text 
  ON teachers 
  USING gin(to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(institute, '') || ' ' || 
    COALESCE(bio, '')
  ));

-- Index for teacher aggregates if not exists
CREATE INDEX IF NOT EXISTS idx_teacher_aggregates_teacher_id
  ON teacher_aggregates(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_aggregates_rating 
  ON teacher_aggregates(avg_rating DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_teacher_aggregates_count 
  ON teacher_aggregates(ratings_count DESC NULLS LAST);

-- Composite index for sorting
CREATE INDEX IF NOT EXISTS idx_teacher_aggregates_composite 
  ON teacher_aggregates(avg_rating DESC NULLS LAST, ratings_count DESC NULLS LAST);

-- Index on ratings for faster aggregation
CREATE INDEX IF NOT EXISTS idx_ratings_teacher_id
  ON ratings(teacher_id);

CREATE INDEX IF NOT EXISTS idx_ratings_teacher_score
  ON ratings(teacher_id, score);

-- Create a materialized view for frequently accessed data (optional)
-- This can be refreshed periodically for even better performance
CREATE MATERIALIZED VIEW IF NOT EXISTS teacher_rankings AS
SELECT 
  t.id,
  t.name,
  t.institute,
  t.designation,
  t.city,
  t.bio,
  t.avatar_url,
  t.linkedin_url,
  t.created_at,
  COALESCE(ta.avg_rating::NUMERIC, 0) as average_rating,
  COALESCE(ta.ratings_count::BIGINT, 0) as ratings_count,
  RANK() OVER (ORDER BY COALESCE(ta.avg_rating, 0) DESC, COALESCE(ta.ratings_count, 0) DESC) as rank
FROM teachers t
LEFT JOIN teacher_aggregates ta ON t.id = ta.teacher_id;

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_teacher_rankings_rank 
  ON teacher_rankings(rank);

CREATE INDEX IF NOT EXISTS idx_teacher_rankings_institute 
  ON teacher_rankings(institute);

CREATE INDEX IF NOT EXISTS idx_teacher_rankings_rating
  ON teacher_rankings(average_rating DESC);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_teacher_rankings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY teacher_rankings;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get distinct institutes for filtering
CREATE OR REPLACE FUNCTION get_distinct_institutes()
RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(DISTINCT institute ORDER BY institute)
    FROM teachers
    WHERE institute IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_distinct_institutes TO anon, authenticated;

-- Analytics function for performance monitoring (optional)
CREATE TABLE IF NOT EXISTS query_performance_logs (
  id SERIAL PRIMARY KEY,
  query_type TEXT NOT NULL,
  execution_time_ms FLOAT NOT NULL,
  result_count INT,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_performance_logs_type_time 
  ON query_performance_logs(query_type, logged_at DESC);

-- Function to log query performance
CREATE OR REPLACE FUNCTION log_query_performance(
  query_type TEXT,
  execution_time FLOAT,
  result_count INT
)
RETURNS void AS $$
BEGIN
  INSERT INTO query_performance_logs (
    query_type,
    execution_time_ms,
    result_count,
    logged_at
  ) VALUES (
    query_type,
    execution_time,
    result_count,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Analyze tables for query planner
ANALYZE teachers;
ANALYZE ratings;
ANALYZE teacher_aggregates;

-- Verification query to check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('teachers', 'ratings', 'teacher_aggregates')
ORDER BY tablename, indexname;

-- Test the main function
-- SELECT get_teachers_with_stats_and_count(
--   p_search := 'Smith',
--   p_institute := NULL,
--   p_sort_by := 'rating_desc',
--   p_page := 1,
--   p_page_size := 12
-- );