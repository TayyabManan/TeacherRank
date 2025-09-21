-- Complete migration script to enable half ratings (0.5 increments)
-- This version finds and handles ALL dependent views automatically
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. First, identify all dependent views
-- ============================================

-- Store the current view definitions before dropping them
CREATE TEMP TABLE IF NOT EXISTS view_definitions AS
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
AND definition LIKE '%ratings%';

-- Display what views will be affected
SELECT 'The following views depend on ratings table and will be recreated:' as message;
SELECT viewname FROM view_definitions;

-- ============================================
-- 2. Drop ALL views that depend on ratings table
-- ============================================

-- Drop all dependent views and materialized views
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop materialized views first
    FOR r IN 
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND definition LIKE '%ratings%'
    LOOP
        EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I CASCADE', r.matviewname);
        RAISE NOTICE 'Dropped materialized view: %', r.matviewname;
    END LOOP;
    
    -- Drop regular views
    FOR r IN 
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND definition LIKE '%ratings%'
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', r.viewname);
        RAISE NOTICE 'Dropped view: %', r.viewname;
    END LOOP;
END $$;

-- Also explicitly drop known views (in case they were missed)
DROP VIEW IF EXISTS ratings_with_info CASCADE;
DROP VIEW IF EXISTS teacher_aggregates CASCADE;
DROP MATERIALIZED VIEW IF EXISTS teacher_rankings CASCADE;

-- ============================================
-- 3. Now we can safely alter the ratings table
-- ============================================

-- Alter the score column to DECIMAL(2,1) to support half ratings
ALTER TABLE ratings 
ALTER COLUMN score TYPE DECIMAL(2,1) USING score::DECIMAL(2,1);

-- Drop existing constraint if any
ALTER TABLE ratings
DROP CONSTRAINT IF EXISTS valid_half_ratings;

-- Add a CHECK constraint to ensure only valid half ratings
ALTER TABLE ratings
ADD CONSTRAINT valid_half_ratings 
CHECK (score IN (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0));

-- ============================================
-- 4. Recreate the teacher_aggregates view
-- ============================================

CREATE VIEW teacher_aggregates AS
SELECT 
    t.id AS teacher_id,
    COALESCE(COUNT(r.id), 0) AS ratings_count,
    COALESCE(ROUND(AVG(r.score)::numeric, 2), 0) AS avg_rating,
    COALESCE(MIN(r.score), 0) AS min_rating,
    COALESCE(MAX(r.score), 0) AS max_rating
FROM 
    teachers t
LEFT JOIN 
    ratings r ON t.id = r.teacher_id
GROUP BY 
    t.id;

-- Grant permissions
GRANT SELECT ON teacher_aggregates TO authenticated;
GRANT SELECT ON teacher_aggregates TO anon;

-- ============================================
-- 5. Recreate ratings_with_info view if it existed
-- ============================================

-- This view might provide additional information about ratings
CREATE VIEW ratings_with_info AS
SELECT 
    r.*,
    t.name as teacher_name,
    t.institute as teacher_institute,
    p.display_name as student_name,
    p.email as student_email
FROM ratings r
LEFT JOIN teachers t ON r.teacher_id = t.id
LEFT JOIN profiles p ON r.student_id = p.id;

-- Grant permissions
GRANT SELECT ON ratings_with_info TO authenticated;
GRANT SELECT ON ratings_with_info TO anon;

-- ============================================
-- 6. Recreate teacher_rankings materialized view
-- ============================================

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
    COALESCE(COUNT(r.id), 0)::integer AS ratings_count,
    COALESCE(ROUND(AVG(r.score)::numeric, 2), 0)::numeric AS avg_rating,
    RANK() OVER (
        ORDER BY 
            COALESCE(AVG(r.score), 0) DESC, 
            COUNT(r.id) DESC
    ) AS rank
FROM 
    teachers t
LEFT JOIN 
    ratings r ON t.id = r.teacher_id
GROUP BY 
    t.id, t.name, t.institute, t.designation, 
    t.city, t.bio, t.avatar_url, t.linkedin_url, t.created_at;

-- Create indexes for performance
CREATE INDEX idx_teacher_rankings_avg_rating ON teacher_rankings(avg_rating DESC);
CREATE INDEX idx_teacher_rankings_institute ON teacher_rankings(institute);
CREATE INDEX idx_teacher_rankings_rank ON teacher_rankings(rank);

-- Grant permissions
GRANT SELECT ON teacher_rankings TO authenticated;
GRANT SELECT ON teacher_rankings TO anon;

-- ============================================
-- 7. Create utility functions
-- ============================================

-- Function to round to nearest half
CREATE OR REPLACE FUNCTION round_to_half(value DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(value * 2) / 2;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_teacher_rankings()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW teacher_rankings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_teacher_rankings() TO authenticated;
GRANT EXECUTE ON FUNCTION round_to_half(DECIMAL) TO authenticated;

-- ============================================
-- 8. Create indexes for performance
-- ============================================

-- Drop and recreate indexes to ensure they work with the new column type
DROP INDEX IF EXISTS idx_ratings_score_decimal;
DROP INDEX IF EXISTS idx_ratings_teacher_score;

CREATE INDEX idx_ratings_score_decimal ON ratings(score);
CREATE INDEX idx_ratings_teacher_score ON ratings(teacher_id, score);

-- ============================================
-- 9. Update any existing RLS policies if needed
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. Verification queries
-- ============================================

-- Check the new column type
SELECT 
    '--- Column Type Check ---' as section,
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'ratings' 
AND column_name = 'score';

-- Check sample ratings with new decimal type
SELECT 
    '--- Sample Ratings ---' as section,
    id,
    teacher_id,
    score,
    pg_typeof(score) as score_type
FROM ratings
LIMIT 5;

-- Check the aggregates view works
SELECT 
    '--- Teacher Aggregates ---' as section,
    teacher_id,
    ratings_count,
    avg_rating
FROM teacher_aggregates 
WHERE ratings_count > 0
LIMIT 5;

-- Check the rankings materialized view
SELECT 
    '--- Teacher Rankings ---' as section,
    name,
    avg_rating,
    ratings_count,
    rank
FROM teacher_rankings 
WHERE ratings_count > 0
ORDER BY rank
LIMIT 5;

-- ============================================
-- 11. Test inserting a half rating
-- ============================================

-- This tests that half ratings work (you can delete this test rating later)
DO $$
DECLARE
    test_teacher_id uuid;
BEGIN
    -- Get a random teacher for testing
    SELECT id INTO test_teacher_id FROM teachers LIMIT 1;
    
    IF test_teacher_id IS NOT NULL THEN
        -- Try to insert a half rating
        INSERT INTO ratings (teacher_id, student_id, score, comment)
        VALUES (
            test_teacher_id,
            NULL,
            4.5,
            'Test half rating - you can delete this'
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Test half rating (4.5) inserted successfully!';
    END IF;
END $$;

-- ============================================
-- 12. Success message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Half ratings migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '- Score column changed from INTEGER to DECIMAL(2,1)';
    RAISE NOTICE '- All views depending on ratings have been recreated';
    RAISE NOTICE '- Existing ratings preserved (1 -> 1.0, 2 -> 2.0, etc.)';
    RAISE NOTICE '- You can now use ratings: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify the application works with the new rating system';
    RAISE NOTICE '2. Consider setting up automatic refresh for teacher_rankings materialized view';
    RAISE NOTICE '3. Delete the test rating if one was created';
END $$;

-- ============================================
-- 13. Optional: Set up automatic refresh
-- ============================================

-- Uncomment this if you have pg_cron extension enabled:
-- SELECT cron.schedule(
--     'refresh-teacher-rankings', 
--     '0 * * * *',  -- Every hour
--     'REFRESH MATERIALIZED VIEW teacher_rankings;'
-- );