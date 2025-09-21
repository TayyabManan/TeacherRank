-- Update all teacher avatars to use placeholder images instead of external URLs
-- This solves the CORS/referrer issues with external university images

-- Backup current avatar URLs first
CREATE TABLE IF NOT EXISTS teachers_avatar_backup AS
SELECT id, name, avatar_url, institute
FROM teachers
WHERE avatar_url IS NOT NULL;

-- Update all teachers to use placeholder avatars
UPDATE teachers
SET avatar_url = NULL
WHERE avatar_url LIKE '%edu.pk%';

-- Alternatively, update to use a generated avatar service that works reliably
-- UPDATE teachers
-- SET avatar_url = 'https://ui-avatars.com/api/?name=' || 
--                  REPLACE(REPLACE(name, ' ', '+'), '.', '') || 
--                  '&background=random&size=200&bold=true'
-- WHERE avatar_url LIKE '%edu.pk%';

-- Verify the update
SELECT 
    institute,
    COUNT(*) as total,
    COUNT(CASE WHEN avatar_url IS NULL THEN 1 END) as null_avatars,
    COUNT(CASE WHEN avatar_url IS NOT NULL THEN 1 END) as has_avatars
FROM teachers
GROUP BY institute
ORDER BY institute;