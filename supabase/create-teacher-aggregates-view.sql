-- Create or recreate the teacher_aggregates view
-- This view is essential for displaying teacher ratings and stats
-- Run this in Supabase SQL Editor

-- ============================================
-- Drop and recreate teacher_aggregates view
-- ============================================

DROP VIEW IF EXISTS teacher_aggregates;

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
-- Verify the view works
-- ============================================

-- Check if view was created successfully
SELECT 
    'teacher_aggregates view status:' as check_type,
    COUNT(*) as teacher_count,
    SUM(ratings_count) as total_ratings
FROM teacher_aggregates;

-- Show sample data
SELECT 
    'Sample teacher stats:' as info,
    ta.teacher_id,
    t.name,
    ta.ratings_count,
    ta.avg_rating
FROM teacher_aggregates ta
LEFT JOIN teachers t ON ta.teacher_id = t.id
WHERE ta.ratings_count > 0
ORDER BY ta.avg_rating DESC
LIMIT 5;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'teacher_aggregates view created successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'This view provides:';
  RAISE NOTICE '- ratings_count: Number of ratings per teacher';
  RAISE NOTICE '- avg_rating: Average rating (rounded to 2 decimals)';
  RAISE NOTICE '- min_rating & max_rating: Rating range';
  RAISE NOTICE '';
  RAISE NOTICE 'Teacher profiles should now show ratings correctly!';
END $$;