-- Optimized function to get teachers with stats and count in a single query
-- This reduces API calls by 50% and improves performance significantly

CREATE OR REPLACE FUNCTION get_teachers_with_stats_and_count(
  search_query TEXT DEFAULT NULL,
  institute_filter TEXT DEFAULT NULL,
  sort_by TEXT DEFAULT 'rating_desc',
  page_num INT DEFAULT 1,
  page_size INT DEFAULT 12
)
RETURNS JSON AS $$
DECLARE
  total_count INT;
  result JSON;
BEGIN
  -- Get total count using CTE for efficiency
  WITH filtered_teachers AS (
    SELECT t.id
    FROM teachers t
    WHERE 
      (search_query IS NULL OR 
       t.name ILIKE '%' || search_query || '%' OR
       t.institute ILIKE '%' || search_query || '%' OR
       t.bio ILIKE '%' || search_query || '%')
      AND (institute_filter IS NULL OR t.institute = institute_filter)
      AND t.status = 'approved'
  )
  SELECT COUNT(*) INTO total_count FROM filtered_teachers;

  -- Get paginated results with stats in a single query
  WITH ranked_data AS (
    SELECT 
      t.id,
      t.name,
      t.institute,
      t.bio,
      t.avatar_url,
      t.status,
      t.created_at,
      t.updated_at,
      COALESCE(ta.avg_rating::NUMERIC, 0) as average_rating,
      COALESCE(ta.ratings_count::INT, 0) as ratings_count,
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE 
            WHEN sort_by = 'rating_desc' THEN COALESCE(ta.avg_rating, 0)
            WHEN sort_by = 'rating_asc' THEN -COALESCE(ta.avg_rating, 0)
            ELSE 0
          END DESC,
          CASE
            WHEN sort_by = 'name_az' THEN t.name
            WHEN sort_by = 'institute_az' THEN t.institute
            ELSE NULL
          END ASC,
          t.created_at DESC -- Secondary sort for consistency
      ) as row_num
    FROM teachers t
    LEFT JOIN teacher_aggregates ta ON t.id = ta.teacher_id
    WHERE 
      (search_query IS NULL OR 
       t.name ILIKE '%' || search_query || '%' OR
       t.institute ILIKE '%' || search_query || '%' OR
       t.bio ILIKE '%' || search_query || '%')
      AND (institute_filter IS NULL OR t.institute = institute_filter)
      AND t.status = 'approved'
  )
  SELECT json_build_object(
    'data', COALESCE(
      json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'institute', institute,
          'bio', bio,
          'avatar_url', avatar_url,
          'status', status,
          'created_at', created_at,
          'updated_at', updated_at,
          'average_rating', average_rating,
          'ratings_count', ratings_count
        ) ORDER BY row_num
      ) FILTER (WHERE id IS NOT NULL),
      '[]'::json
    ),
    'total', total_count,
    'page', page_num,
    'pageSize', page_size,
    'totalPages', CEIL(total_count::FLOAT / page_size)
  ) INTO result
  FROM ranked_data
  WHERE row_num > (page_num - 1) * page_size 
    AND row_num <= page_num * page_size;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_teachers_with_stats_and_count TO anon, authenticated;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teachers_status 
  ON teachers(status) 
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_teachers_institute 
  ON teachers(institute) 
  WHERE status = 'approved';

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_teachers_status_institute_name 
  ON teachers(status, institute, name) 
  WHERE status = 'approved';

-- Full text search index for better search performance
CREATE INDEX IF NOT EXISTS idx_teachers_search_text 
  ON teachers 
  USING gin(to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(institute, '') || ' ' || 
    COALESCE(bio, '')
  ));

-- Index for teacher aggregates
CREATE INDEX IF NOT EXISTS idx_teacher_aggregates_rating 
  ON teacher_aggregates(avg_rating DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_teacher_aggregates_count 
  ON teacher_aggregates(ratings_count DESC NULLS LAST);

-- Composite index for sorting
CREATE INDEX IF NOT EXISTS idx_teacher_aggregates_composite 
  ON teacher_aggregates(avg_rating DESC NULLS LAST, ratings_count DESC NULLS LAST);

-- Create a materialized view for frequently accessed data (optional)
-- This can be refreshed periodically for even better performance
CREATE MATERIALIZED VIEW IF NOT EXISTS teacher_rankings AS
SELECT 
  t.id,
  t.name,
  t.institute,
  t.bio,
  t.avatar_url,
  t.status,
  COALESCE(ta.avg_rating::NUMERIC, 0) as average_rating,
  COALESCE(ta.ratings_count::INT, 0) as ratings_count,
  RANK() OVER (ORDER BY COALESCE(ta.avg_rating, 0) DESC, COALESCE(ta.ratings_count, 0) DESC) as rank
FROM teachers t
LEFT JOIN teacher_aggregates ta ON t.id = ta.teacher_id
WHERE t.status = 'approved';

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_teacher_rankings_rank 
  ON teacher_rankings(rank);

CREATE INDEX IF NOT EXISTS idx_teacher_rankings_institute 
  ON teacher_rankings(institute);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_teacher_rankings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY teacher_rankings;
END;
$$ LANGUAGE plpgsql;

-- Schedule periodic refresh (requires pg_cron extension)
-- Run this if you have pg_cron enabled:
-- SELECT cron.schedule('refresh-rankings', '*/15 * * * *', 'SELECT refresh_teacher_rankings();');

-- Analytics function for performance monitoring
CREATE OR REPLACE FUNCTION log_query_performance(
  query_type TEXT,
  execution_time FLOAT,
  result_count INT
)
RETURNS void AS $$
BEGIN
  -- Log to a performance table (create if needed)
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

-- Create performance logging table
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