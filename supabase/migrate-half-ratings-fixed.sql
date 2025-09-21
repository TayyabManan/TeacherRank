-- Migration script to enable half ratings (0.5 increments)
-- This version handles dependent views and materialized views
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. First, drop all dependent views and materialized views
-- ============================================

-- Drop materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS teacher_rankings CASCADE;

-- Drop regular view if it exists
DROP VIEW IF EXISTS teacher_aggregates CASCADE;

-- ============================================
-- 2. Now alter the ratings table to use DECIMAL for scores
-- ============================================

-- Alter the score column to DECIMAL(2,1) to support half ratings
ALTER TABLE ratings 
ALTER COLUMN score TYPE DECIMAL(2,1) USING score::DECIMAL(2,1);

-- Add a CHECK constraint to ensure only valid half ratings
ALTER TABLE ratings
DROP CONSTRAINT IF EXISTS valid_half_ratings;

ALTER TABLE ratings
ADD CONSTRAINT valid_half_ratings 
CHECK (score IN (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0));

-- ============================================
-- 3. Recreate the teacher_aggregates view with proper decimal handling
-- ============================================

CREATE VIEW teacher_aggregates AS
SELECT 
    t.id AS teacher_id,
    COALESCE(COUNT(r.id), 0) AS ratings_count,
    COALESCE(ROUND(AVG(r.score), 2), 0) AS avg_rating,
    COALESCE(MIN(r.score), 0) AS min_rating,
    COALESCE(MAX(r.score), 0) AS max_rating
FROM 
    teachers t
LEFT JOIN 
    ratings r ON t.id = r.teacher_id
GROUP BY 
    t.id;

-- Grant appropriate permissions
GRANT SELECT ON teacher_aggregates TO authenticated;
GRANT SELECT ON teacher_aggregates TO anon;

-- ============================================
-- 4. Recreate the teacher_rankings materialized view if it existed
-- ============================================

-- Check if we need to recreate teacher_rankings
-- This creates a materialized view for performance if needed
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
    COALESCE(COUNT(r.id), 0) AS ratings_count,
    COALESCE(ROUND(AVG(r.score)::DECIMAL, 2), 0) AS avg_rating,
    RANK() OVER (ORDER BY COALESCE(AVG(r.score), 0) DESC, COUNT(r.id) DESC) AS rank
FROM 
    teachers t
LEFT JOIN 
    ratings r ON t.id = r.teacher_id
GROUP BY 
    t.id, t.name, t.institute, t.designation, t.city, t.bio, t.avatar_url, t.linkedin_url, t.created_at;

-- Create index for better query performance
CREATE INDEX idx_teacher_rankings_avg_rating ON teacher_rankings(avg_rating DESC);
CREATE INDEX idx_teacher_rankings_institute ON teacher_rankings(institute);

-- Grant permissions
GRANT SELECT ON teacher_rankings TO authenticated;
GRANT SELECT ON teacher_rankings TO anon;

-- ============================================
-- 5. Create a function to round ratings to nearest half
-- ============================================

CREATE OR REPLACE FUNCTION round_to_half(value DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(value * 2) / 2;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Create an index for better query performance
-- ============================================

DROP INDEX IF EXISTS idx_ratings_score_decimal;
CREATE INDEX idx_ratings_score_decimal ON ratings(score);

-- ============================================
-- 7. Create a function to refresh the materialized view
-- ============================================

CREATE OR REPLACE FUNCTION refresh_teacher_rankings()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW teacher_rankings;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_teacher_rankings() TO authenticated;

-- ============================================
-- 8. Verify the migration
-- ============================================

-- Check the new column type
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'ratings' 
AND column_name = 'score';

-- Check some sample ratings
SELECT 
    id,
    teacher_id,
    score,
    pg_typeof(score) as score_type
FROM ratings
LIMIT 10;

-- Check the aggregates view
SELECT * FROM teacher_aggregates LIMIT 5;

-- Check the rankings materialized view
SELECT 
    name,
    institute,
    avg_rating,
    ratings_count,
    rank
FROM teacher_rankings 
ORDER BY rank
LIMIT 10;

-- ============================================
-- 9. Optional: Set up automatic refresh for materialized view
-- ============================================

-- You can set up a cron job in Supabase to refresh the materialized view periodically
-- For example, to refresh every hour:
-- SELECT cron.schedule('refresh-teacher-rankings', '0 * * * *', 'REFRESH MATERIALIZED VIEW teacher_rankings;');

-- ============================================
-- Success message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Half ratings migration completed successfully!';
    RAISE NOTICE 'Existing integer ratings have been converted to decimals (1 -> 1.0, etc.)';
    RAISE NOTICE 'You can now use ratings like 3.5, 4.5, etc.';
END $$;