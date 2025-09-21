-- Fix RLS policies for ratings table to allow authenticated users to submit ratings
-- This resolves: "new row violates row-level security policy for table 'ratings'"

-- 1. First, drop existing policies on ratings table
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'ratings'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON ratings', pol.policyname);
        RAISE NOTICE 'Dropped policy % on ratings table', pol.policyname;
    END LOOP;
END $$;

-- 2. Enable RLS on ratings table
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- 3. Create permissive policies for ratings table

-- Policy: Anyone can view all ratings (public read access)
CREATE POLICY "ratings_select_policy"
ON ratings FOR SELECT
USING (true);

-- Policy: Authenticated users can insert ratings
-- Allow both authenticated users and anonymous users to create ratings
CREATE POLICY "ratings_insert_policy"
ON ratings FOR INSERT
WITH CHECK (
    -- Allow authenticated users
    (auth.uid() IS NOT NULL) 
    OR 
    -- Allow anonymous ratings (when student_id is NULL)
    (student_id IS NULL)
);

-- Policy: Users can update their own ratings
CREATE POLICY "ratings_update_policy"
ON ratings FOR UPDATE
TO authenticated
USING (
    -- User owns the rating
    student_id = auth.uid()
    OR
    -- User is admin
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
)
WITH CHECK (
    -- User owns the rating
    student_id = auth.uid()
    OR
    -- User is admin
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Policy: Users can delete their own ratings
CREATE POLICY "ratings_delete_policy"
ON ratings FOR DELETE
TO authenticated
USING (
    -- User owns the rating
    student_id = auth.uid()
    OR
    -- User is admin
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- 4. Grant necessary permissions to authenticated and anon roles
GRANT ALL ON ratings TO authenticated;
GRANT SELECT, INSERT ON ratings TO anon;

-- 5. Ensure the ratings sequence permissions are set correctly
DO $$
BEGIN
    -- Grant usage on any sequences used by the ratings table
    IF EXISTS (
        SELECT 1 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relkind = 'S' 
        AND n.nspname = 'public' 
        AND c.relname LIKE 'ratings_%'
    ) THEN
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
    END IF;
END $$;

-- 6. Verify the policies are created correctly
SELECT 
    'Ratings Table RLS Policies' as category,
    policyname,
    permissive,
    roles,
    cmd,
    qual::text as using_expression,
    with_check::text as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'ratings'
ORDER BY policyname;

-- 7. Test message
SELECT '✅ Ratings RLS policies have been fixed!' as status;
SELECT '✅ Users can now submit ratings without RLS violations' as message;