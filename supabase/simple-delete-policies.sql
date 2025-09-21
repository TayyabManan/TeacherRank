-- Simple DELETE policies for Admin Panel
-- This is a simpler approach that should work immediately

-- ============================================
-- Option 1: Allow authenticated users to delete (temporary for testing)
-- ============================================

-- For feedback table
DROP POLICY IF EXISTS "Authenticated users can delete own feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can delete feedback" ON feedback;

CREATE POLICY "Authenticated users can delete feedback"
ON feedback
FOR DELETE
TO authenticated
USING (true);  -- Allow any authenticated user to delete

-- For teacher_submission_requests table
DROP POLICY IF EXISTS "Authenticated users can delete teacher requests" ON teacher_submission_requests;

CREATE POLICY "Authenticated users can delete teacher requests"
ON teacher_submission_requests
FOR DELETE
TO authenticated
USING (true);  -- Allow any authenticated user to delete

-- Grant permissions
GRANT DELETE ON feedback TO authenticated;
GRANT DELETE ON teacher_submission_requests TO authenticated;

-- ============================================
-- Option 2: More secure - check against your specific email
-- ============================================
-- Uncomment and modify this section with your admin email

/*
-- For feedback table
DROP POLICY IF EXISTS "Authenticated users can delete feedback" ON feedback;

CREATE POLICY "Only admin can delete feedback"
ON feedback
FOR DELETE
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'YOUR_ADMIN_EMAIL@example.com'
);

-- For teacher_submission_requests
DROP POLICY IF EXISTS "Authenticated users can delete teacher requests" ON teacher_submission_requests;

CREATE POLICY "Only admin can delete teacher requests"
ON teacher_submission_requests
FOR DELETE
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'YOUR_ADMIN_EMAIL@example.com'
);
*/

-- ============================================
-- Verify policies are created
-- ============================================
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('feedback', 'teacher_submission_requests')
AND cmd = 'DELETE'
ORDER BY tablename;