-- Fix admin panel permissions and ensure all tables are accessible
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Check if tables exist and create if missing
-- ============================================

-- Create feedback table if it doesn't exist
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

-- Create teacher_submission_requests table if it doesn't exist
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

-- ============================================
-- 2. Enable RLS on all admin tables
-- ============================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_submission_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Create RLS policies for feedback table
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public can create feedback" ON feedback;
DROP POLICY IF EXISTS "Admin can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Admin can update feedback" ON feedback;
DROP POLICY IF EXISTS "Admin can delete feedback" ON feedback;

-- Anyone can submit feedback
CREATE POLICY "Public can create feedback"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

-- Admin can view all feedback
CREATE POLICY "Admin can view all feedback"
ON feedback FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
  OR auth.email() = 'haris.a.mannan@gmail.com'
);

-- Admin can update feedback
CREATE POLICY "Admin can update feedback"
ON feedback FOR UPDATE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com')
WITH CHECK (auth.email() = 'haris.a.mannan@gmail.com');

-- Admin can delete feedback
CREATE POLICY "Admin can delete feedback"
ON feedback FOR DELETE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com');

-- ============================================
-- 4. Create RLS policies for teacher_submission_requests
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public can create teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Admin can view all teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Admin can update teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Admin can delete teacher requests" ON teacher_submission_requests;

-- Anyone can submit teacher requests
CREATE POLICY "Public can create teacher requests"
ON teacher_submission_requests FOR INSERT
TO public
WITH CHECK (true);

-- Admin can view all teacher requests
CREATE POLICY "Admin can view all teacher requests"
ON teacher_submission_requests FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
  OR auth.email() = 'haris.a.mannan@gmail.com'
);

-- Admin can update teacher requests
CREATE POLICY "Admin can update teacher requests"
ON teacher_submission_requests FOR UPDATE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com')
WITH CHECK (auth.email() = 'haris.a.mannan@gmail.com');

-- Admin can delete teacher requests
CREATE POLICY "Admin can delete teacher requests"
ON teacher_submission_requests FOR DELETE
TO authenticated
USING (auth.email() = 'haris.a.mannan@gmail.com');

-- ============================================
-- 5. Create RLS policies for ratings (reviews)
-- ============================================

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Anyone can view ratings" ON ratings;
DROP POLICY IF EXISTS "Admin can view all ratings" ON ratings;

-- Anyone can view ratings
CREATE POLICY "Anyone can view ratings"
ON ratings FOR SELECT
TO public
USING (true);

-- ============================================
-- 6. Grant permissions
-- ============================================

-- Grant permissions on feedback table
GRANT ALL ON feedback TO authenticated;
GRANT SELECT, INSERT ON feedback TO anon;

-- Grant permissions on teacher_submission_requests table
GRANT ALL ON teacher_submission_requests TO authenticated;
GRANT SELECT, INSERT ON teacher_submission_requests TO anon;

-- Grant permissions on ratings table
GRANT ALL ON ratings TO authenticated;
GRANT SELECT, INSERT ON ratings TO anon;

-- Grant permissions on teachers table (for joins)
GRANT SELECT ON teachers TO authenticated;
GRANT SELECT ON teachers TO anon;

-- Grant permissions on profiles table (for joins)
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- ============================================
-- 7. Test the setup
-- ============================================

-- Check current user
SELECT 
  'Current User:' as info,
  auth.uid() as user_id,
  auth.email() as user_email,
  auth.jwt() ->> 'email' as jwt_email,
  CASE 
    WHEN auth.email() = 'haris.a.mannan@gmail.com' THEN 'ADMIN ACCESS'
    ELSE 'Regular User'
  END as access_level;

-- Check if tables are accessible
SELECT 'Testing table access:' as test;

-- Test feedback access
SELECT COUNT(*) as feedback_count FROM feedback;

-- Test teacher_submission_requests access
SELECT COUNT(*) as teacher_request_count FROM teacher_submission_requests;

-- Test ratings access
SELECT COUNT(*) as ratings_count FROM ratings;

-- Check policies
SELECT 
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('feedback', 'teacher_submission_requests', 'ratings')
ORDER BY tablename, cmd;

-- ============================================
-- 8. Create helper function to check admin status
-- ============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.email() = 'haris.a.mannan@gmail.com' 
      OR auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============================================
-- 9. Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin permissions fixed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin email: haris.a.mannan@gmail.com';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables checked/created:';
  RAISE NOTICE '- feedback';
  RAISE NOTICE '- teacher_submission_requests';
  RAISE NOTICE '- ratings';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies created for admin to:';
  RAISE NOTICE '- View all data';
  RAISE NOTICE '- Update records';
  RAISE NOTICE '- Delete records';
  RAISE NOTICE '';
  RAISE NOTICE 'If you still see errors, check:';
  RAISE NOTICE '1. You are logged in with: haris.a.mannan@gmail.com';
  RAISE NOTICE '2. Tables exist with proper structure';
  RAISE NOTICE '3. Browser console for specific error messages';
END $$;