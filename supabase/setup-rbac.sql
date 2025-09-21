-- Role-Based Access Control Setup for Teacher Rank
-- This script sets up proper RBAC without hardcoded emails

-- 1. Add role column to profiles table if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' 
CHECK (role IN ('user', 'admin', 'moderator'));

-- 2. Create an index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 3. Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop existing policies that use hardcoded emails
DROP POLICY IF EXISTS "Admin can delete any rating" ON ratings;
DROP POLICY IF EXISTS "Admin can delete reviews" ON ratings;
DROP POLICY IF EXISTS "Admin delete policy" ON ratings;

-- 6. Create new role-based policies for ratings table
CREATE POLICY "Admins can delete any rating" 
ON ratings FOR DELETE 
TO authenticated
USING (is_current_user_admin());

CREATE POLICY "Users can delete own ratings"
ON ratings FOR DELETE
TO authenticated
USING (student_id = auth.uid());

-- 7. Create policies for teachers table
DROP POLICY IF EXISTS "Admin can delete teachers" ON teachers;

CREATE POLICY "Admins can manage teachers"
ON teachers FOR ALL
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- 8. Create policies for teacher_requests table
DROP POLICY IF EXISTS "Admin can manage requests" ON teacher_requests;

CREATE POLICY "Admins can manage teacher requests"
ON teacher_requests FOR ALL
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- 9. Create a secure function to promote user to admin (run manually via Supabase dashboard)
-- This should only be run once to set initial admin
-- Replace 'your-admin-user-id' with the actual user ID from auth.users table
/*
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'your-admin-user-id';
*/

-- 10. Create RLS policies for profiles table to protect role column
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile except role"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() AND 
  (role = (SELECT role FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- 11. Create audit log table for admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Create function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  action_type TEXT,
  target_table TEXT,
  target_id UUID,
  action_details JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO admin_audit_log (admin_id, action, table_name, record_id, details)
  VALUES (auth.uid(), action_type, target_table, target_id, action_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To set up the initial admin user, run this in Supabase SQL Editor:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@example.com';
-- This should be done through Supabase dashboard, not in application code