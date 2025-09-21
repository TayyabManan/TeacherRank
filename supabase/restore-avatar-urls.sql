-- Restore original avatar URLs from backup
-- This script restores the original university avatar URLs that were set to NULL

-- First, check if backup table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teachers_avatar_backup') THEN
        -- Restore avatar URLs from backup
        UPDATE teachers t
        SET avatar_url = b.avatar_url
        FROM teachers_avatar_backup b
        WHERE t.id = b.id
        AND b.avatar_url IS NOT NULL;

        RAISE NOTICE 'Avatar URLs restored from backup table';
    ELSE
        RAISE NOTICE 'No backup table found. Manually restoring known URLs...';

        -- Manually restore some known COMSATS faculty avatars
        -- These are the original URLs that work with the proxy
        UPDATE teachers
        SET avatar_url = CASE name
            WHEN 'Dr. Aamir Ali' THEN 'http://ww2.comsats.edu.pk/faculty/FacultyPics/09_01_2023_11_21_18_9229887.jpg'
            WHEN 'Dr. Aamir Qamar' THEN 'http://ww2.comsats.edu.pk/faculty/FacultyPics/17_10_2016_16_05_47_0699557.jpg'
            WHEN 'Dr. Syed Junaid Nawaz' THEN 'https://ww2.comsats.edu.pk/faculty/FacultyPics/06_04_2025_12_34_28_1977353.jpg'
            -- Add more faculty members as needed
            ELSE avatar_url
        END
        WHERE institute = 'COMSATS'
        AND name IN ('Dr. Aamir Ali', 'Dr. Aamir Qamar', 'Dr. Syed Junaid Nawaz');
    END IF;
END $$;

-- Verify the restoration
SELECT
    name,
    institute,
    CASE
        WHEN avatar_url IS NULL THEN 'No avatar'
        WHEN avatar_url LIKE '%edu.pk%' THEN 'University URL'
        WHEN avatar_url LIKE '%ui-avatars%' THEN 'Placeholder'
        ELSE 'Other'
    END as avatar_type,
    avatar_url
FROM teachers
WHERE institute IN ('COMSATS', 'LUMS', 'FAST', 'NUST')
AND (avatar_url IS NOT NULL OR name IN ('Dr. Aamir Ali', 'Dr. Aamir Qamar', 'Dr. Syed Junaid Nawaz'))
ORDER BY institute, name
LIMIT 20;

-- Summary statistics
SELECT
    institute,
    COUNT(*) as total_teachers,
    COUNT(CASE WHEN avatar_url IS NULL THEN 1 END) as no_avatar,
    COUNT(CASE WHEN avatar_url LIKE '%edu.pk%' THEN 1 END) as university_avatars,
    COUNT(CASE WHEN avatar_url LIKE '%ui-avatars%' THEN 1 END) as placeholder_avatars
FROM teachers
GROUP BY institute
ORDER BY institute;