-- Migration: Fix Ratings Insert Permission
-- Date: 2025-10-22
-- Description: Fix "permission denied for table ratings" when adding ratings
-- Issue: RLS policy too restrictive for INSERT operations

-- =============================================================================
-- PROBLEM DIAGNOSIS
-- =============================================================================
-- The current policy only allows:
-- 1. Authenticated users to insert with their own student_id
-- 2. Anonymous ratings (student_id IS NULL)
--
-- But it's blocking legitimate rating submissions.
-- This fix makes the policy more permissive while still secure.

-- =============================================================================
-- FIX: Update Ratings INSERT Policy
-- =============================================================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "ratings_insert_own" ON ratings;

-- Create a more permissive INSERT policy
CREATE POLICY "ratings_insert_allowed" ON ratings
  FOR INSERT
  WITH CHECK (
    -- Case 1: Anonymous users can insert with student_id = NULL
    (auth.uid() IS NULL AND student_id IS NULL)
    OR
    -- Case 2: Authenticated users can insert with their own student_id
    (auth.uid() IS NOT NULL AND auth.uid() = student_id)
    OR
    -- Case 3: Authenticated users can insert anonymous ratings (student_id = NULL)
    (auth.uid() IS NOT NULL AND student_id IS NULL)
  );

COMMENT ON POLICY "ratings_insert_allowed" ON ratings IS
  'Allow anonymous and authenticated users to insert ratings with proper constraints';

-- =============================================================================
-- ADDITIONAL FIX: Ensure UPDATE/DELETE policies are correct
-- =============================================================================

-- Verify UPDATE policy (users can only update their own ratings)
DROP POLICY IF EXISTS "ratings_update_own" ON ratings;

CREATE POLICY "ratings_update_own" ON ratings
  FOR UPDATE
  USING (
    -- Only allow if authenticated AND it's their rating
    auth.uid() IS NOT NULL AND auth.uid() = student_id
  )
  WITH CHECK (
    -- Ensure they're not changing the student_id to someone else's
    auth.uid() IS NOT NULL AND auth.uid() = student_id
  );

-- Verify DELETE policy (users can only delete their own ratings)
DROP POLICY IF EXISTS "ratings_delete_own" ON ratings;

CREATE POLICY "ratings_delete_own" ON ratings
  FOR DELETE
  USING (
    -- Only allow if authenticated AND it's their rating
    auth.uid() IS NOT NULL AND auth.uid() = student_id
  );

-- Keep admin override policy
-- (Already exists from previous migration, but let's ensure it's there)
DROP POLICY IF EXISTS "ratings_admin_all" ON ratings;

CREATE POLICY "ratings_admin_all" ON ratings
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- =============================================================================
-- GRANT NECESSARY PERMISSIONS
-- =============================================================================

-- Ensure authenticated users can INSERT into ratings
GRANT INSERT ON ratings TO authenticated;

-- Ensure anonymous users can INSERT into ratings (for anonymous reviews)
GRANT INSERT ON ratings TO anon;

-- Both can SELECT (read) ratings
GRANT SELECT ON ratings TO authenticated, anon;

-- Only authenticated users can UPDATE/DELETE their own (controlled by RLS)
GRANT UPDATE, DELETE ON ratings TO authenticated;

-- =============================================================================
-- FIX: Ensure sequences are accessible
-- =============================================================================

-- If ratings table has any sequences (like auto-increment ID), grant access
DO $$
DECLARE
  seq_name TEXT;
BEGIN
  -- Find sequences associated with ratings table
  FOR seq_name IN
    SELECT quote_ident(sequence_schema) || '.' || quote_ident(sequence_name)
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    AND sequence_name LIKE 'ratings_%'
  LOOP
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE ' || seq_name || ' TO authenticated, anon';
  END LOOP;
END $$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check the policies on ratings table
SELECT
  policyname,
  cmd,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'ratings'
ORDER BY policyname;

-- Check permissions on ratings table
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'ratings';

-- =============================================================================
-- TEST SCENARIOS
-- =============================================================================

-- Test 1: Anonymous user inserts a rating
-- SET ROLE anon;
-- INSERT INTO ratings (teacher_id, student_id, score, comment)
-- VALUES ('test-teacher-id', NULL, 4.5, 'Test anonymous comment that is long enough');
-- -- Should work ✅

-- Test 2: Authenticated user inserts their own rating
-- SET ROLE authenticated;
-- SET request.jwt.claims.sub = 'test-user-id';
-- INSERT INTO ratings (teacher_id, student_id, score, comment)
-- VALUES ('test-teacher-id', 'test-user-id', 4.5, 'Test authenticated comment long enough');
-- -- Should work ✅

-- Test 3: User tries to insert rating as someone else
-- SET ROLE authenticated;
-- SET request.jwt.claims.sub = 'user-A-id';
-- INSERT INTO ratings (teacher_id, student_id, score, comment)
-- VALUES ('test-teacher-id', 'user-B-id', 4.5, 'Test comment that is long enough');
-- -- Should fail ❌

-- Test 4: User updates their own rating
-- UPDATE ratings SET score = 5.0 WHERE id = 'their-rating-id';
-- -- Should work if it's their rating ✅

-- RESET ROLE;

-- =============================================================================
-- DEBUGGING HELPER FUNCTION
-- =============================================================================

-- Function to check if current user can insert a rating
CREATE OR REPLACE FUNCTION can_insert_rating(
  p_teacher_id UUID,
  p_student_id UUID
)
RETURNS TABLE (
  can_insert BOOLEAN,
  reason TEXT
) AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    IF p_student_id IS NULL THEN
      RETURN QUERY SELECT TRUE, 'Anonymous user can insert anonymous rating';
    ELSE
      RETURN QUERY SELECT FALSE, 'Anonymous user cannot insert rating with student_id';
    END IF;
  ELSE
    -- User is authenticated
    IF p_student_id = auth.uid() THEN
      RETURN QUERY SELECT TRUE, 'Authenticated user can insert their own rating';
    ELSIF p_student_id IS NULL THEN
      RETURN QUERY SELECT TRUE, 'Authenticated user can insert anonymous rating';
    ELSE
      RETURN QUERY SELECT FALSE, 'Authenticated user cannot insert rating for another user';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION can_insert_rating TO authenticated, anon;

COMMENT ON FUNCTION can_insert_rating IS
  'Helper function to check if current user can insert a rating - useful for debugging';

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Ratings INSERT permission fixed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '1. Updated INSERT policy to allow both anonymous and authenticated ratings';
  RAISE NOTICE '2. Granted INSERT permission to anon and authenticated roles';
  RAISE NOTICE '3. Granted USAGE on sequences';
  RAISE NOTICE '4. Added debugging helper function: can_insert_rating()';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now:';
  RAISE NOTICE '- Submit ratings as anonymous users';
  RAISE NOTICE '- Submit ratings as authenticated users';
  RAISE NOTICE '- Update/delete only your own ratings';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ Test the rating submission in your app to verify!';
END $$;
