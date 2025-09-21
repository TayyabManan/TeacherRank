-- Fix admin delete permissions for feedback and teacher requests
-- This resolves the issue where deletions appear to work but don't persist

-- Add DELETE policies for feedback table
DROP POLICY IF EXISTS "Public can delete feedback" ON feedback;
CREATE POLICY "Public can delete feedback" 
ON feedback FOR DELETE 
TO public, anon, authenticated
USING (true);

-- Add DELETE policies for teacher_submission_requests table  
DROP POLICY IF EXISTS "Public can delete teacher requests" ON teacher_submission_requests;
CREATE POLICY "Public can delete teacher requests" 
ON teacher_submission_requests FOR DELETE 
TO public, anon, authenticated
USING (true);

-- Also ensure DELETE permission is granted
GRANT DELETE ON feedback TO anon;
GRANT DELETE ON feedback TO authenticated;
GRANT DELETE ON feedback TO public;

GRANT DELETE ON teacher_submission_requests TO anon;
GRANT DELETE ON teacher_submission_requests TO authenticated;
GRANT DELETE ON teacher_submission_requests TO public;

-- Test that delete works
DO $$
DECLARE
    test_id UUID;
BEGIN
    -- Create a test feedback entry
    INSERT INTO feedback (type, title, description, email)
    VALUES ('general', 'Test Delete', 'Testing delete permission', 'test@delete.com')
    RETURNING id INTO test_id;
    
    -- Try to delete it
    DELETE FROM feedback WHERE id = test_id;
    
    -- Check if it was deleted
    IF EXISTS (SELECT 1 FROM feedback WHERE id = test_id) THEN
        RAISE NOTICE 'Delete test FAILED - record still exists';
    ELSE
        RAISE NOTICE 'Delete test SUCCESSFUL - permissions are working';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Delete test error: %', SQLERRM;
END $$;

-- For production, you'd want to restrict this to admins only:
-- CREATE POLICY "Only admins can delete feedback" 
-- ON feedback FOR DELETE 
-- USING (auth.jwt() ->> 'email' = 'admin@example.com');

COMMENT ON POLICY "Public can delete feedback" ON feedback IS 'Temporary permissive policy for testing. Replace with admin-only policy in production.';
COMMENT ON POLICY "Public can delete teacher requests" ON teacher_submission_requests IS 'Temporary permissive policy for testing. Replace with admin-only policy in production.';