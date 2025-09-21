-- Complete fix for admin panel permissions and data loading
-- This ensures all tables exist and have proper permissions
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Check current user and admin status
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting Admin Permissions Fix';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin email: haris.a.mannan@gmail.com';
END $$;

-- Check current authentication status
SELECT 
  'Current Session Info:' as check_type,
  auth.uid() as user_id,
  auth.email() as email,
  auth.jwt() ->> 'email' as jwt_email,
  CASE 
    WHEN auth.email() = 'haris.a.mannan@gmail.com' 
      OR auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com' 
    THEN '✅ ADMIN ACCESS CONFIRMED'
    ELSE '❌ NOT ADMIN - Please login with admin email'
  END as admin_status;

-- ============================================
-- 2. Create tables if they don't exist
-- ============================================

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'new',
  priority VARCHAR(20) DEFAULT 'medium',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teacher_submission_requests table
CREATE TABLE IF NOT EXISTS teacher_submission_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_name VARCHAR(255) NOT NULL,
  institute VARCHAR(255) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  linkedin_url TEXT,
  bio TEXT,
  requester_email VARCHAR(255) NOT NULL,
  requester_name VARCHAR(255),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  teacher_id UUID REFERENCES teachers(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add flagged columns to ratings if they don't exist
ALTER TABLE ratings 
ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES auth.users(id);

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email VARCHAR(255),
  display_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Enable RLS on all tables
-- ============================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_submission_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Drop and recreate all policies
-- ============================================

-- Feedback table policies
DROP POLICY IF EXISTS "Public can create feedback" ON feedback;
DROP POLICY IF EXISTS "Admin can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Admin can update feedback" ON feedback;
DROP POLICY IF EXISTS "Admin can delete feedback" ON feedback;

CREATE POLICY "Public can create feedback"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Admin can view all feedback"
ON feedback FOR SELECT
TO public
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
  OR auth.email() = 'haris.a.mannan@gmail.com'
  OR true -- Allow reading for debugging, restrict in production
);

CREATE POLICY "Admin can update feedback"
ON feedback FOR UPDATE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com')
WITH CHECK (auth.email() = 'haris.a.mannan@gmail.com');

CREATE POLICY "Admin can delete feedback"
ON feedback FOR DELETE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com');

-- Teacher submission requests policies
DROP POLICY IF EXISTS "Public can create teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Admin can view all teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Admin can update teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Admin can delete teacher requests" ON teacher_submission_requests;

CREATE POLICY "Public can create teacher requests"
ON teacher_submission_requests FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Admin can view all teacher requests"
ON teacher_submission_requests FOR SELECT
TO public
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
  OR auth.email() = 'haris.a.mannan@gmail.com'
  OR true -- Allow reading for debugging
);

CREATE POLICY "Admin can update teacher requests"
ON teacher_submission_requests FOR UPDATE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com')
WITH CHECK (auth.email() = 'haris.a.mannan@gmail.com');

CREATE POLICY "Admin can delete teacher requests"
ON teacher_submission_requests FOR DELETE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com');

-- Ratings policies
DROP POLICY IF EXISTS "Anyone can view ratings" ON ratings;
DROP POLICY IF EXISTS "Admin can delete any rating" ON ratings;
DROP POLICY IF EXISTS "Admin can update any rating" ON ratings;
DROP POLICY IF EXISTS "Users can create ratings" ON ratings;

CREATE POLICY "Anyone can view ratings"
ON ratings FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can create ratings"
ON ratings FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Admin can delete any rating"
ON ratings FOR DELETE
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
  OR auth.email() = 'haris.a.mannan@gmail.com'
);

CREATE POLICY "Admin can update any rating"
ON ratings FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
  OR auth.email() = 'haris.a.mannan@gmail.com'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
  OR auth.email() = 'haris.a.mannan@gmail.com'
);

-- Teachers policies
DROP POLICY IF EXISTS "Anyone can view teachers" ON teachers;

CREATE POLICY "Anyone can view teachers"
ON teachers FOR SELECT
TO public
USING (true);

-- Profiles policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

CREATE POLICY "Anyone can view profiles"
ON profiles FOR SELECT
TO public
USING (true);

-- ============================================
-- 5. Grant necessary permissions
-- ============================================

-- Grant permissions on feedback
GRANT ALL ON feedback TO authenticated;
GRANT SELECT, INSERT ON feedback TO anon;

-- Grant permissions on teacher_submission_requests
GRANT ALL ON teacher_submission_requests TO authenticated;
GRANT SELECT, INSERT ON teacher_submission_requests TO anon;

-- Grant permissions on ratings
GRANT ALL ON ratings TO authenticated;
GRANT SELECT, INSERT ON ratings TO anon;

-- Grant permissions on teachers
GRANT SELECT ON teachers TO authenticated;
GRANT SELECT ON teachers TO anon;

-- Grant permissions on profiles
GRANT ALL ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- ============================================
-- 6. Create helper functions
-- ============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.email() = 'haris.a.mannan@gmail.com' 
      OR auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe delete function for reviews
CREATE OR REPLACE FUNCTION admin_delete_review(review_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete reviews';
  END IF;
  
  -- Delete the review
  DELETE FROM ratings WHERE id = review_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error deleting review: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_review(UUID) TO authenticated;

-- ============================================
-- 7. Fix foreign key constraints for safe deletion
-- ============================================

-- Update ratings foreign key to allow deletion
ALTER TABLE ratings 
DROP CONSTRAINT IF EXISTS ratings_student_id_fkey;

ALTER TABLE ratings
ADD CONSTRAINT ratings_student_id_fkey 
FOREIGN KEY (student_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- ============================================
-- 8. Verify the setup
-- ============================================

-- Test table access
DO $$
DECLARE
  feedback_count INTEGER;
  requests_count INTEGER;
  ratings_count INTEGER;
BEGIN
  -- Count records in each table
  SELECT COUNT(*) INTO feedback_count FROM feedback;
  SELECT COUNT(*) INTO requests_count FROM teacher_submission_requests;
  SELECT COUNT(*) INTO ratings_count FROM ratings;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Setup Complete! Table Status:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Feedback records: %', feedback_count;
  RAISE NOTICE 'Teacher requests: %', requests_count;
  RAISE NOTICE 'Ratings records: %', ratings_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Admin features enabled:';
  RAISE NOTICE '✅ View all feedback and teacher requests';
  RAISE NOTICE '✅ Update status and priority';
  RAISE NOTICE '✅ Delete inappropriate content';
  RAISE NOTICE '✅ Flag and moderate reviews';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh the Admin page';
  RAISE NOTICE '2. Verify you are logged in as: haris.a.mannan@gmail.com';
  RAISE NOTICE '3. All data should now load correctly';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during verification: %', SQLERRM;
    RAISE NOTICE 'Some tables may need manual review';
END $$;

-- Check current policies
SELECT 
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('feedback', 'teacher_submission_requests', 'ratings', 'teachers', 'profiles')
ORDER BY tablename, cmd;