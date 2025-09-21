-- Comprehensive fix for teachers table

-- 1. First check what columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'teachers';

-- 2. Make sure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Add any missing columns (without email since it's not in the interface)
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL,
ADD COLUMN IF NOT EXISTS institute VARCHAR(255) NOT NULL,
ADD COLUMN IF NOT EXISTS designation VARCHAR(255),
ADD COLUMN IF NOT EXISTS city VARCHAR(100) NOT NULL,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. Make optional fields nullable
ALTER TABLE teachers 
ALTER COLUMN designation DROP NOT NULL,
ALTER COLUMN linkedin_url DROP NOT NULL,
ALTER COLUMN bio DROP NOT NULL,
ALTER COLUMN avatar_url DROP NOT NULL,
ALTER COLUMN created_by DROP NOT NULL;

-- 5. If email column exists but causes issues, drop it
ALTER TABLE teachers DROP COLUMN IF EXISTS email;

-- 6. Ensure ID has proper default if it's UUID
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teachers' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE teachers ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- 7. Grant all necessary permissions
GRANT ALL ON teachers TO authenticated;
GRANT ALL ON teachers TO anon; -- For public read access
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 8. Create or replace the insert policy to allow authenticated users
DROP POLICY IF EXISTS "Authenticated users can insert teachers" ON teachers;
CREATE POLICY "Authenticated users can insert teachers" ON teachers
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view teachers" ON teachers;
CREATE POLICY "Anyone can view teachers" ON teachers
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can update teachers" ON teachers;
CREATE POLICY "Authenticated users can update teachers" ON teachers
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- 9. Enable RLS if not already enabled
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- 10. Verify the structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'teachers'
ORDER BY ordinal_position;