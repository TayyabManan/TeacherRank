-- Final fix for DELETE functionality in Admin Panel
-- Run this script in Supabase SQL Editor to enable delete operations

-- ============================================
-- 1. First, check if RLS is enabled
-- ============================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_submission_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Drop ALL existing DELETE policies to start fresh
-- ============================================
DO $$
DECLARE
    pol record;
BEGIN
    -- Drop all DELETE policies on feedback
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'feedback' 
        AND schemaname = 'public'
        AND cmd = 'DELETE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON feedback', pol.policyname);
    END LOOP;
    
    -- Drop all DELETE policies on teacher_submission_requests
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'teacher_submission_requests' 
        AND schemaname = 'public'
        AND cmd = 'DELETE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON teacher_submission_requests', pol.policyname);
    END LOOP;
END $$;

-- ============================================
-- 3. Create simple DELETE policies that work
-- ============================================

-- For feedback table - using direct email check
CREATE POLICY "Admin delete feedback"
ON feedback
FOR DELETE
TO authenticated
USING (
  auth.email() = 'haris.a.mannan@gmail.com'
);

-- For teacher_submission_requests - using direct email check
CREATE POLICY "Admin delete teacher requests"
ON teacher_submission_requests
FOR DELETE
TO authenticated
USING (
  auth.email() = 'haris.a.mannan@gmail.com'
);

-- ============================================
-- 4. Also ensure UPDATE policies work for the same user
-- ============================================

-- Drop and recreate UPDATE policy for feedback
DROP POLICY IF EXISTS "Admin update feedback" ON feedback;
CREATE POLICY "Admin update feedback"
ON feedback
FOR UPDATE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com')
WITH CHECK (auth.email() = 'haris.a.mannan@gmail.com');

-- Drop and recreate UPDATE policy for teacher_submission_requests
DROP POLICY IF EXISTS "Admin update teacher requests" ON teacher_submission_requests;
CREATE POLICY "Admin update teacher requests"
ON teacher_submission_requests
FOR UPDATE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com')
WITH CHECK (auth.email() = 'haris.a.mannan@gmail.com');

-- ============================================
-- 5. Grant permissions at table level
-- ============================================
GRANT ALL ON feedback TO authenticated;
GRANT ALL ON teacher_submission_requests TO authenticated;

-- ============================================
-- 6. Test the setup
-- ============================================

-- Check if policies are created
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('feedback', 'teacher_submission_requests')
AND cmd IN ('DELETE', 'UPDATE')
ORDER BY tablename, cmd;

-- Check current user's email
SELECT 
  auth.email() as current_user_email,
  auth.uid() as current_user_id,
  CASE 
    WHEN auth.email() = 'haris.a.mannan@gmail.com' THEN 'YES - Admin access granted'
    ELSE 'NO - Not admin'
  END as is_admin;

-- ============================================
-- 7. Alternative: If the above doesn't work, try this simpler approach
-- ============================================
-- Uncomment the section below if the email-based policies don't work

/*
-- TEMPORARY: Allow all authenticated users to delete (for testing only)
DROP POLICY IF EXISTS "Admin delete feedback" ON feedback;
DROP POLICY IF EXISTS "Admin delete teacher requests" ON teacher_submission_requests;

CREATE POLICY "Allow delete feedback"
ON feedback
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Allow delete teacher requests"
ON teacher_submission_requests
FOR DELETE
TO authenticated
USING (true);
*/

-- ============================================
-- 8. Debug information
-- ============================================
SELECT 
  'Current session info:' as info,
  current_user as database_user,
  auth.uid() as auth_user_id,
  auth.email() as auth_user_email,
  auth.role() as auth_role;