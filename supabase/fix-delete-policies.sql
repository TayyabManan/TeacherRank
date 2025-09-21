-- Fix DELETE policies for Admin Panel
-- This script adds the missing DELETE policies for feedback and teacher_submission_requests tables

-- ============================================
-- 1. Check current RLS status
-- ============================================
SELECT 
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('feedback', 'teacher_submission_requests')
ORDER BY tablename, cmd;

-- ============================================
-- 2. Create DELETE policy for feedback table
-- ============================================

-- First, ensure RLS is enabled
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing DELETE policy if it exists
DROP POLICY IF EXISTS "Admin can delete feedback" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can delete feedback" ON feedback;

-- Create DELETE policy for admin (using email check)
-- You'll need to replace the email with your actual admin email
CREATE POLICY "Admin can delete feedback"
ON feedback
FOR DELETE
TO authenticated
USING (
  auth.jwt() ->> 'email' = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND auth.jwt() ->> 'email' IN (
    -- Add your admin email(s) here
    'haris.a.mannan@gmail.com'
  )
);

-- Alternative: If you have an admin role in profiles table
CREATE POLICY "Admin role can delete feedback"
ON feedback
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- 3. Create DELETE policy for teacher_submission_requests
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE teacher_submission_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing DELETE policy if it exists
DROP POLICY IF EXISTS "Admin can delete teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Authenticated users can delete teacher requests" ON teacher_submission_requests;

-- Create DELETE policy for admin (using email check)
CREATE POLICY "Admin can delete teacher requests"
ON teacher_submission_requests
FOR DELETE
TO authenticated
USING (
  auth.jwt() ->> 'email' = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND auth.jwt() ->> 'email' IN (
    -- Add your admin email(s) here
    'haris.a.mannan@gmail.com'
  )
);

-- Alternative: If you have an admin role in profiles table
CREATE POLICY "Admin role can delete teacher requests"
ON teacher_submission_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- 4. Also ensure UPDATE policies exist for status changes
-- ============================================

-- For feedback table
DROP POLICY IF EXISTS "Admin can update feedback" ON feedback;
CREATE POLICY "Admin can update feedback"
ON feedback
FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'email' IN (
    'haris.a.mannan@gmail.com'
  )
)
WITH CHECK (
  auth.jwt() ->> 'email' IN (
    'haris.a.mannan@gmail.com'
  )
);

-- For teacher_submission_requests table
DROP POLICY IF EXISTS "Admin can update teacher requests" ON teacher_submission_requests;
CREATE POLICY "Admin can update teacher requests"
ON teacher_submission_requests
FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'email' IN (
    'haris.a.mannan@gmail.com'
  )
)
WITH CHECK (
  auth.jwt() ->> 'email' IN (
    'haris.a.mannan@gmail.com'
  )
);

-- ============================================
-- 5. Grant necessary permissions
-- ============================================

-- Grant DELETE permission to authenticated users (RLS will control actual access)
GRANT DELETE ON feedback TO authenticated;
GRANT DELETE ON teacher_submission_requests TO authenticated;

-- Also ensure other permissions are granted
GRANT SELECT, INSERT, UPDATE ON feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON teacher_submission_requests TO authenticated;

-- ============================================
-- 6. Verify the policies
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL as has_using_clause,
  with_check IS NOT NULL as has_with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('feedback', 'teacher_submission_requests')
ORDER BY tablename, cmd, policyname;

-- ============================================
-- 7. Test the delete permission
-- ============================================
-- This query shows if the current user can delete from these tables
SELECT 
  'feedback' as table_name,
  has_table_privilege('feedback', 'DELETE') as can_delete,
  current_user as current_db_user,
  auth.uid() as auth_user_id,
  auth.jwt() ->> 'email' as auth_user_email
UNION ALL
SELECT 
  'teacher_submission_requests' as table_name,
  has_table_privilege('teacher_submission_requests', 'DELETE') as can_delete,
  current_user as current_db_user,
  auth.uid() as auth_user_id,
  auth.jwt() ->> 'email' as auth_user_email;

