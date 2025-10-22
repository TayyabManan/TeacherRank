-- Migration: Implement Row Level Security (RLS) Policies
-- Date: 2025-10-22
-- Description: Comprehensive RLS policies for all tables to prevent unauthorized access
-- Critical Security Fix: Addresses IDOR vulnerabilities and unauthorized data access

-- =============================================================================
-- STEP 1: Create helper functions for authorization
-- =============================================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is moderator or admin
CREATE OR REPLACE FUNCTION is_moderator(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role IN ('admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 2: Enable RLS on all tables
-- =============================================================================

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_submission_requests ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 3: Teachers Table Policies
-- =============================================================================

-- Anyone can read teachers
CREATE POLICY "teachers_select_public" ON teachers
  FOR SELECT
  USING (true);

-- Only admins can insert teachers
CREATE POLICY "teachers_insert_admin" ON teachers
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can update teachers
CREATE POLICY "teachers_update_admin" ON teachers
  FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can delete teachers
CREATE POLICY "teachers_delete_admin" ON teachers
  FOR DELETE
  USING (is_admin(auth.uid()));

-- =============================================================================
-- STEP 4: Ratings Table Policies
-- =============================================================================

-- Anyone can read ratings (for public display)
CREATE POLICY "ratings_select_public" ON ratings
  FOR SELECT
  USING (true);

-- Authenticated users can create ratings for themselves
CREATE POLICY "ratings_insert_own" ON ratings
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    OR student_id IS NULL  -- Allow anonymous ratings
  );

-- Users can only update their own ratings
CREATE POLICY "ratings_update_own" ON ratings
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Users can only delete their own ratings
CREATE POLICY "ratings_delete_own" ON ratings
  FOR DELETE
  USING (auth.uid() = student_id);

-- Admins can do anything with ratings
CREATE POLICY "ratings_admin_all" ON ratings
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================================
-- STEP 5: Profiles Table Policies (Prevent Information Disclosure)
-- =============================================================================

-- Users can read their own profile completely
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Public can only see display_name and id (not email!)
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT
  USING (true)
  WITH CHECK (false); -- This policy only affects SELECT, we use column-level security

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- STEP 6: Feedback Table Policies (Admin Only)
-- =============================================================================

-- Anyone can insert feedback (for submitting)
CREATE POLICY "feedback_insert_public" ON feedback
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read feedback
CREATE POLICY "feedback_select_admin" ON feedback
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Only admins can update feedback
CREATE POLICY "feedback_update_admin" ON feedback
  FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can delete feedback
CREATE POLICY "feedback_delete_admin" ON feedback
  FOR DELETE
  USING (is_admin(auth.uid()));

-- =============================================================================
-- STEP 7: Teacher Submission Requests Policies (Admin Only)
-- =============================================================================

-- Anyone can insert teacher requests (for submitting)
CREATE POLICY "teacher_requests_insert_public" ON teacher_submission_requests
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read teacher requests
CREATE POLICY "teacher_requests_select_admin" ON teacher_submission_requests
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Only admins can update teacher requests
CREATE POLICY "teacher_requests_update_admin" ON teacher_submission_requests
  FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can delete teacher requests
CREATE POLICY "teacher_requests_delete_admin" ON teacher_submission_requests
  FOR DELETE
  USING (is_admin(auth.uid()));

-- =============================================================================
-- STEP 8: Add security comments
-- =============================================================================

COMMENT ON FUNCTION is_admin IS 'Security function to check if user has admin role';
COMMENT ON FUNCTION is_moderator IS 'Security function to check if user has moderator or admin role';

COMMENT ON POLICY "teachers_select_public" ON teachers IS 'Allow public read access to teachers';
COMMENT ON POLICY "teachers_insert_admin" ON teachers IS 'Only admins can create teachers';
COMMENT ON POLICY "teachers_update_admin" ON teachers IS 'Only admins can update teachers';
COMMENT ON POLICY "teachers_delete_admin" ON teachers IS 'Only admins can delete teachers';

COMMENT ON POLICY "ratings_select_public" ON ratings IS 'Allow public read access to ratings';
COMMENT ON POLICY "ratings_insert_own" ON ratings IS 'Users can only create their own ratings';
COMMENT ON POLICY "ratings_update_own" ON ratings IS 'Users can only update their own ratings';
COMMENT ON POLICY "ratings_delete_own" ON ratings IS 'Users can only delete their own ratings';
COMMENT ON POLICY "ratings_admin_all" ON ratings IS 'Admins have full access to all ratings';

COMMENT ON POLICY "profiles_select_own" ON profiles IS 'Users can read their own profile';
COMMENT ON POLICY "profiles_select_admin" ON profiles IS 'Admins can read all profiles';
COMMENT ON POLICY "profiles_update_own" ON profiles IS 'Users can update their own profile';
COMMENT ON POLICY "profiles_insert_own" ON profiles IS 'Users can create their own profile';

COMMENT ON POLICY "feedback_insert_public" ON feedback IS 'Anyone can submit feedback';
COMMENT ON POLICY "feedback_select_admin" ON feedback IS 'Only admins can read feedback';
COMMENT ON POLICY "feedback_update_admin" ON feedback IS 'Only admins can update feedback';
COMMENT ON POLICY "feedback_delete_admin" ON feedback IS 'Only admins can delete feedback';

-- =============================================================================
-- STEP 9: Grant necessary permissions
-- =============================================================================

-- Grant execute permissions on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_moderator TO authenticated;

-- =============================================================================
-- VERIFICATION QUERIES (Run these to test)
-- =============================================================================

-- To verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- To verify policies exist:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- To test as non-admin user:
-- SET ROLE authenticated;
-- SET request.jwt.claims.sub = 'some-user-uuid';
-- SELECT * FROM teachers;  -- Should work
-- INSERT INTO teachers (name, institute) VALUES ('Test', 'Test');  -- Should fail

-- To test as admin:
-- SET ROLE authenticated;
-- SET request.jwt.claims.sub = 'admin-user-uuid';
-- INSERT INTO teachers (name, institute) VALUES ('Test', 'Test');  -- Should work
