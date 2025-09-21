-- Fix teacher deletion issues
-- This script uses the user_roles table for permission checking

-- Drop existing RLS policies that might be preventing deletion
DROP POLICY IF EXISTS "Admins and moderators can delete teachers" ON teachers;

-- Create a proper delete policy for admins and moderators using user_roles table
CREATE POLICY "Admins and moderators can delete teachers"
ON teachers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'moderator')
  )
);

-- Ensure cascading deletes are set up properly for ratings table
-- When a teacher is deleted, their ratings should also be deleted

-- Check if foreign key constraint exists and update it for ratings
ALTER TABLE ratings
DROP CONSTRAINT IF EXISTS ratings_teacher_id_fkey;

ALTER TABLE ratings
ADD CONSTRAINT ratings_teacher_id_fkey
FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- Note: teacher_aggregates is a view, not a table, so it doesn't need foreign key constraints
-- It will automatically reflect changes when teachers are deleted

-- Grant delete permission to authenticated users (RLS will control who can actually delete)
GRANT DELETE ON teachers TO authenticated;

-- Verify the policies are working
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies
WHERE tablename = 'teachers'
AND cmd = 'DELETE';

-- Check if user_roles table exists and has admin users
SELECT 
  'User Roles Table Check' as check_type,
  COUNT(*) as admin_count 
FROM user_roles 
WHERE role = 'admin';

-- Show current foreign key constraints on ratings table
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'ratings'
  AND ccu.table_name = 'teachers';

-- Check if the current user has admin or moderator role
-- Replace this with your actual user ID after running setup-admin-role.sql
SELECT 
  'Your Roles' as check_type,
  user_id,
  role 
FROM user_roles 
WHERE user_id = auth.uid();