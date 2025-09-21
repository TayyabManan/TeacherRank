-- Performance Optimization for Teacher Queries (FINAL VERSION)
-- This script creates optimized functions and indexes for better performance
-- Fixed: No indexes on views, no status column dependency

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
      COALESCE(AVG(r.score)::NUMERIC(3,2), 0) as average_rating,
      COALESCE(COUNT(r.id)::BIGINT, 0) as ratings_count
    FROM teachers t
    LEFT JOIN ratings r ON t.id = r.teacher_id
    WHERE 
      (p_search IS NULL OR p_search = '' OR (
        t.name ILIKE '%' || p_search || '%' OR
        t.institute ILIKE '%' || p_search || '%' OR
        COALESCE(t.bio, '') ILIKE '%' || p_search || '%'
      ))
      AND (p_institute IS NULL OR p_institute = 'all' OR t.institute = p_institute)
    GROUP BY t.id
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

-- ============================================
-- INDEXES ON ACTUAL TABLES (not views)
-- ============================================

-- Indexes on teachers table
CREATE INDEX IF NOT EXISTS idx_teachers_name 
  ON teachers(name);

CREATE INDEX IF NOT EXISTS idx_teachers_institute 
  ON teachers(institute);

CREATE INDEX IF NOT EXISTS idx_teachers_city 
  ON teachers(city);

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

-- Indexes on ratings table for faster aggregation
CREATE INDEX IF NOT EXISTS idx_ratings_teacher_id
  ON ratings(teacher_id);

CREATE INDEX IF NOT EXISTS idx_ratings_teacher_score
  ON ratings(teacher_id, score);

-- Index for faster joins and aggregations
CREATE INDEX IF NOT EXISTS idx_ratings_teacher_created
  ON ratings(teacher_id, created_at DESC);

-- ============================================
-- MATERIALIZED VIEW FOR PERFORMANCE
-- ============================================

-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS teacher_rankings CASCADE;

-- Create a materialized view for frequently accessed data
CREATE MATERIALIZED VIEW teacher_rankings AS
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
  COALESCE(AVG(r.score)::NUMERIC(3,2), 0) as average_rating,
  COALESCE(COUNT(r.id)::BIGINT, 0) as ratings_count,
  RANK() OVER (
    ORDER BY 
      COALESCE(AVG(r.score), 0) DESC, 
      COALESCE(COUNT(r.id), 0) DESC
  ) as rank
FROM teachers t
LEFT JOIN ratings r ON t.id = r.teacher_id
GROUP BY t.id;

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_teacher_rankings_rank 
  ON teacher_rankings(rank);

CREATE INDEX IF NOT EXISTS idx_teacher_rankings_institute 
  ON teacher_rankings(institute);

CREATE INDEX IF NOT EXISTS idx_teacher_rankings_rating
  ON teacher_rankings(average_rating DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_rankings_count
  ON teacher_rankings(ratings_count DESC);

-- Grant permissions on materialized view
GRANT SELECT ON teacher_rankings TO anon, authenticated;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_teacher_rankings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY teacher_rankings;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_teacher_rankings TO authenticated;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

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

-- Function to get teacher with stats by ID
CREATE OR REPLACE FUNCTION get_teacher_with_stats(teacher_id UUID)
RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'institute', t.institute,
      'designation', t.designation,
      'city', t.city,
      'linkedin_url', t.linkedin_url,
      'avatar_url', t.avatar_url,
      'bio', t.bio,
      'created_at', t.created_at,
      'average_rating', COALESCE(AVG(r.score)::NUMERIC(3,2), 0),
      'ratings_count', COALESCE(COUNT(r.id)::BIGINT, 0)
    )
    FROM teachers t
    LEFT JOIN ratings r ON t.id = r.teacher_id
    WHERE t.id = teacher_id
    GROUP BY t.id
  );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_teacher_with_stats TO anon, authenticated;

-- ============================================
-- PERFORMANCE MONITORING (Optional)
-- ============================================

-- Create performance logging table if not exists
CREATE TABLE IF NOT EXISTS query_performance_logs (
  id SERIAL PRIMARY KEY,
  query_type TEXT NOT NULL,
  execution_time_ms FLOAT NOT NULL,
  result_count INT,
  search_term TEXT,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_performance_logs_type_time 
  ON query_performance_logs(query_type, logged_at DESC);

-- Function to log query performance
CREATE OR REPLACE FUNCTION log_query_performance(
  query_type TEXT,
  execution_time FLOAT,
  result_count INT,
  search_term TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO query_performance_logs (
    query_type,
    execution_time_ms,
    result_count,
    search_term,
    logged_at
  ) VALUES (
    query_type,
    execution_time,
    result_count,
    search_term,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION log_query_performance TO authenticated;

-- ============================================
-- CLEANUP AND OPTIMIZATION
-- ============================================

-- Analyze tables for query planner
ANALYZE teachers;
ANALYZE ratings;

-- Refresh materialized view initially
REFRESH MATERIALIZED VIEW teacher_rankings;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check created indexes
SELECT 
  'Indexes created successfully' as status,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('teachers', 'ratings', 'teacher_rankings', 'query_performance_logs');

-- Test the main function
/*
SELECT get_teachers_with_stats_and_count(
  p_search := NULL,
  p_institute := NULL,
  p_sort_by := 'rating_desc',
  p_page := 1,
  p_page_size := 12
);
*/

-- Success message
SELECT 'Database optimization completed successfully!' as message;