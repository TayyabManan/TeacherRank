-- Migration script to enable half ratings (0.5 increments)
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Alter the ratings table to use DECIMAL for scores
-- ============================================

-- First, alter the score column to DECIMAL(2,1) to support half ratings
ALTER TABLE ratings 
ALTER COLUMN score TYPE DECIMAL(2,1) USING score::DECIMAL(2,1);

-- Add a CHECK constraint to ensure only valid half ratings
ALTER TABLE ratings
ADD CONSTRAINT valid_half_ratings 
CHECK (score IN (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0));

-- ============================================
-- 2. Update the teacher_aggregates view to handle decimals properly
-- ============================================

-- Drop the existing view
DROP VIEW IF EXISTS teacher_aggregates;

-- Recreate the view with proper decimal handling
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
-- 3. Create a function to round ratings to nearest half
-- ============================================

CREATE OR REPLACE FUNCTION round_to_half(value DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(value * 2) / 2;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Update any existing whole number ratings to decimal format
-- ============================================

-- This is just for consistency - existing whole numbers will work as-is
UPDATE ratings 
SET score = score::DECIMAL(2,1)
WHERE score IS NOT NULL;

-- ============================================
-- 5. Create an index for better query performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ratings_score_decimal ON ratings(score);

-- ============================================
-- 6. Verify the migration
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

-- ============================================
-- 7. Test half rating insert
-- ============================================

-- This is just a test - you can delete this rating after confirming it works
-- INSERT INTO ratings (teacher_id, student_id, score, comment)
-- VALUES (
--     (SELECT id FROM teachers LIMIT 1),
--     NULL,
--     4.5,
--     'Test half rating - delete me'
-- );

-- ============================================
-- Notes:
-- - Existing integer ratings (1, 2, 3, 4, 5) will be automatically converted to (1.0, 2.0, 3.0, 4.0, 5.0)
-- - The CHECK constraint ensures only valid half ratings can be inserted
-- - The view now properly rounds average ratings to 2 decimal places
-- ============================================