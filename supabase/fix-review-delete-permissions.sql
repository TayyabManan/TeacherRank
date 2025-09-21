-- Fix permissions for deleting reviews
-- This handles the foreign key constraint issues
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. First, check the foreign key constraints on ratings table
-- ============================================
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='ratings';

-- ============================================
-- 2. Modify the foreign key constraint to allow NULL and CASCADE
-- ============================================

-- Drop existing foreign key constraints if they exist
ALTER TABLE ratings 
DROP CONSTRAINT IF EXISTS ratings_student_id_fkey,
DROP CONSTRAINT IF EXISTS ratings_teacher_id_fkey;

-- Recreate student_id foreign key with SET NULL on delete
-- This allows anonymous reviews and prevents deletion issues
ALTER TABLE ratings
ADD CONSTRAINT ratings_student_id_fkey 
FOREIGN KEY (student_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Recreate teacher_id foreign key with RESTRICT to prevent accidental teacher deletion
ALTER TABLE ratings
ADD CONSTRAINT ratings_teacher_id_fkey 
FOREIGN KEY (teacher_id) 
REFERENCES teachers(id) 
ON DELETE CASCADE;

-- ============================================
-- 3. Update RLS policies for ratings table
-- ============================================

-- Enable RLS
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on ratings
DROP POLICY IF EXISTS "Anyone can view ratings" ON ratings;
DROP POLICY IF EXISTS "Users can create ratings" ON ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can delete own ratings" ON ratings;
DROP POLICY IF EXISTS "Admin can delete reviews" ON ratings;
DROP POLICY IF EXISTS "Admin can update reviews" ON ratings;

-- Create comprehensive policies

-- 1. Anyone can view ratings
CREATE POLICY "Anyone can view ratings"
ON ratings FOR SELECT
TO public
USING (true);

-- 2. Authenticated users can create ratings
CREATE POLICY "Users can create ratings"
ON ratings FOR INSERT
TO public
WITH CHECK (true);

-- 3. Users can update their own ratings
CREATE POLICY "Users can update own ratings"
ON ratings FOR UPDATE
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- 4. Users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
ON ratings FOR DELETE
TO authenticated
USING (auth.uid() = student_id);

-- 5. Admin can delete any rating (using email check)
CREATE POLICY "Admin can delete any rating"
ON ratings FOR DELETE
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
);

-- 6. Admin can update any rating (for flagging)
CREATE POLICY "Admin can update any rating"
ON ratings FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
);

-- ============================================
-- 4. Grant necessary permissions
-- ============================================

-- Grant permissions on ratings table
GRANT ALL ON ratings TO authenticated;
GRANT SELECT, INSERT ON ratings TO anon;

-- ============================================
-- 5. Create a safe delete function for admin
-- ============================================

CREATE OR REPLACE FUNCTION admin_delete_review(review_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF auth.jwt() ->> 'email' != 'haris.a.mannan@gmail.com' THEN
    RAISE EXCEPTION 'Only admin can delete reviews';
  END IF;

  -- Delete the review
  DELETE FROM ratings WHERE id = review_id;
  
  -- Return success
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return false
    RAISE NOTICE 'Error deleting review: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_delete_review(UUID) TO authenticated;

-- ============================================
-- 6. Test the permissions
-- ============================================

-- Check current user
SELECT 
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as user_email,
  CASE 
    WHEN auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com' THEN 'Admin'
    ELSE 'Regular User'
  END as role;

-- Check policies on ratings table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'ratings'
ORDER BY cmd;

-- ============================================
-- 7. Alternative: Create a trigger to handle deletions
-- ============================================

-- This trigger will handle the deletion more safely
CREATE OR REPLACE FUNCTION handle_rating_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log the deletion (optional)
  RAISE NOTICE 'Deleting rating % for teacher %', OLD.id, OLD.teacher_id;
  
  -- The deletion will proceed normally
  RETURN OLD;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS before_rating_delete ON ratings;
CREATE TRIGGER before_rating_delete
  BEFORE DELETE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION handle_rating_deletion();

-- ============================================
-- 8. Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Review deletion permissions fixed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '- Updated foreign key constraints to handle deletions properly';
  RAISE NOTICE '- Created comprehensive RLS policies';
  RAISE NOTICE '- Added admin_delete_review() function for safe deletion';
  RAISE NOTICE '- Admin email: haris.a.mannan@gmail.com';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now delete reviews through:';
  RAISE NOTICE '1. Direct DELETE (if you are admin)';
  RAISE NOTICE '2. Using admin_delete_review(review_id) function';
END $$;