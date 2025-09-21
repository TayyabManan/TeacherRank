-- Fix teacher approval functionality in admin panel
-- This ensures teachers can be added to the database when approved

-- 1. Ensure teachers table has all required columns
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Make sure optional columns are nullable
ALTER TABLE teachers 
ALTER COLUMN linkedin_url DROP NOT NULL,
ALTER COLUMN bio DROP NOT NULL,
ALTER COLUMN avatar_url DROP NOT NULL,
ALTER COLUMN designation DROP NOT NULL,
ALTER COLUMN created_by DROP NOT NULL;

-- 3. Enable RLS if not already enabled
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies for teachers table
DROP POLICY IF EXISTS "Anyone can view teachers" ON teachers;
DROP POLICY IF EXISTS "Public can view teachers" ON teachers;
DROP POLICY IF EXISTS "Public can insert teachers" ON teachers;
DROP POLICY IF EXISTS "Public can update teachers" ON teachers;
DROP POLICY IF EXISTS "Authenticated users can insert teachers" ON teachers;
DROP POLICY IF EXISTS "Authenticated users can update teachers" ON teachers;

-- 5. Create permissive policies for teachers table (temporary for testing)
CREATE POLICY "Public can view teachers" 
ON teachers FOR SELECT 
TO public, anon, authenticated
USING (true);

CREATE POLICY "Public can insert teachers" 
ON teachers FOR INSERT 
TO public, anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can update teachers" 
ON teachers FOR UPDATE 
TO public, anon, authenticated
USING (true);

-- 6. Grant necessary permissions
GRANT ALL ON teachers TO anon;
GRANT ALL ON teachers TO authenticated;
GRANT ALL ON teachers TO public;
GRANT ALL ON teachers TO service_role;

-- 7. Ensure the ID column has a default value
DO $$
BEGIN
    -- Check if id column is UUID type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teachers' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE teachers ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- 8. Create trigger for updated_at if not exists
CREATE OR REPLACE FUNCTION update_teachers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_teachers_updated_at ON teachers;
CREATE TRIGGER update_teachers_updated_at 
BEFORE UPDATE ON teachers 
FOR EACH ROW EXECUTE FUNCTION update_teachers_updated_at();

-- 9. Test teacher insertion
DO $$
DECLARE
    test_id UUID;
BEGIN
    -- Try to insert a test teacher
    INSERT INTO teachers (
        name, 
        institute, 
        designation, 
        city,
        bio,
        created_by
    ) VALUES (
        'Test Teacher Approval',
        'Test University',
        'Professor',
        'Test City',
        'Testing teacher approval',
        NULL
    ) RETURNING id INTO test_id;
    
    -- Check if insertion was successful
    IF test_id IS NOT NULL THEN
        -- Clean up test data
        DELETE FROM teachers WHERE id = test_id;
        RAISE NOTICE 'Teacher insertion test SUCCESSFUL - approval should work';
    ELSE
        RAISE NOTICE 'Teacher insertion test FAILED - check permissions';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Teacher insertion error: %', SQLERRM;
END $$;

-- 10. Also ensure teacher_submission_requests can be updated after approval
GRANT UPDATE ON teacher_submission_requests TO anon;
GRANT UPDATE ON teacher_submission_requests TO authenticated;

DROP POLICY IF EXISTS "Public can update teacher requests" ON teacher_submission_requests;
CREATE POLICY "Public can update teacher requests" 
ON teacher_submission_requests FOR UPDATE 
TO public, anon, authenticated
USING (true);

-- 11. Ensure feedback table can be updated when teacher is approved  
GRANT UPDATE ON feedback TO anon;
GRANT UPDATE ON feedback TO authenticated;

DROP POLICY IF EXISTS "Public can update feedback" ON feedback;
CREATE POLICY "Public can update feedback" 
ON feedback FOR UPDATE 
TO public, anon, authenticated
USING (true);

COMMENT ON TABLE teachers IS 'Stores approved teachers. Temporarily has permissive policies for testing.';