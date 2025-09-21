-- Safe RBAC Setup - Handles existing policies and objects
-- This script can be run multiple times safely

-- 1. Add role column to profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN role TEXT DEFAULT 'user' 
    CHECK (role IN ('user', 'admin', 'moderator'));
  END IF;
END $$;

-- 2. Create an index for faster role lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 3. Create or replace function to check if a user is an admin
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

-- 4. Create or replace function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop ALL existing policies on ratings table to start fresh
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'ratings' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON ratings', pol.policyname);
  END LOOP;
END $$;

-- 6. Create new role-based policies for ratings table
CREATE POLICY "Anyone can view ratings" 
ON ratings FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create ratings"
ON ratings FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Users can update own ratings"
ON ratings FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Users can delete own ratings"
ON ratings FOR DELETE
TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Admins can manage any rating"
ON ratings FOR ALL
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- 7. Drop and recreate policies for teachers table
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'teachers' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON teachers', pol.policyname);
  END LOOP;
END $$;

-- Create new teachers policies
CREATE POLICY "Anyone can view teachers"
ON teachers FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create teachers"
ON teachers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update teachers"
ON teachers FOR UPDATE
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete teachers"
ON teachers FOR DELETE
TO authenticated
USING (is_current_user_admin());

-- 8. Handle teacher_requests table if it exists
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'teacher_requests'
  ) THEN
    -- Drop existing policies
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE tablename = 'teacher_requests' 
      AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON teacher_requests', pol.policyname);
    END LOOP;
    
    -- Create new policies
    EXECUTE 'CREATE POLICY "Users can view own requests" ON teacher_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_current_user_admin())';
    EXECUTE 'CREATE POLICY "Users can create requests" ON teacher_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Admins can manage all requests" ON teacher_requests FOR ALL TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())';
  END IF;
END $$;

-- 9. Ensure RLS is enabled on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 10. Drop and recreate profiles policies
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() AND 
  -- Prevent users from changing their own role
  (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() AND role = 'user');

-- 11. Create audit log table if not exists
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Create or replace audit function
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

-- 13. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE 'RBAC setup completed successfully!';
  RAISE NOTICE 'Next step: Update your profile role to admin by running:';
  RAISE NOTICE 'UPDATE profiles SET role = ''admin'' WHERE email = ''your-email@example.com'';';
END $$;