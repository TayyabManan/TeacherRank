-- Role-Based Access Control (RBAC) Migration for Supabase
-- This version works with Supabase's security restrictions

-- 1. Create user_roles table for managing roles
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- 3. Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create function to check if user has a specific role
-- Using public schema instead of auth schema
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, check_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = $1 
    AND user_roles.role = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to check if current user has a specific role
CREATE OR REPLACE FUNCTION public.current_user_has_role(check_role text)
RETURNS boolean AS $$
BEGIN
  RETURN public.has_role(auth.uid(), check_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Policies for user_roles table
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON user_roles;

-- Only admins can view all roles
CREATE POLICY "Admins can view all roles" 
ON user_roles FOR SELECT 
USING (public.current_user_has_role('admin'));

-- Users can view their own roles
CREATE POLICY "Users can view own roles" 
ON user_roles FOR SELECT 
USING (auth.uid() = user_id);

-- Only admins can insert roles
CREATE POLICY "Only admins can insert roles" 
ON user_roles FOR INSERT 
WITH CHECK (public.current_user_has_role('admin'));

-- Only admins can update roles
CREATE POLICY "Only admins can update roles" 
ON user_roles FOR UPDATE 
USING (public.current_user_has_role('admin'));

-- Only admins can delete roles
CREATE POLICY "Only admins can delete roles" 
ON user_roles FOR DELETE 
USING (public.current_user_has_role('admin'));

-- 7. Update teachers table policies to use RBAC
-- Drop old policies with hardcoded email
DROP POLICY IF EXISTS "Only admin can insert teachers" ON teachers;
DROP POLICY IF EXISTS "Only admin can update teachers" ON teachers;
DROP POLICY IF EXISTS "Only admin can delete teachers" ON teachers;

-- Create new policies using RBAC
CREATE POLICY "Admins and moderators can insert teachers" 
ON teachers FOR INSERT 
WITH CHECK (
  public.current_user_has_role('admin') OR 
  public.current_user_has_role('moderator')
);

CREATE POLICY "Admins and moderators can update teachers" 
ON teachers FOR UPDATE 
USING (
  public.current_user_has_role('admin') OR 
  public.current_user_has_role('moderator')
);

CREATE POLICY "Only admins can delete teachers" 
ON teachers FOR DELETE 
USING (public.current_user_has_role('admin'));

-- 8. Create a function to grant admin role to existing admin user
-- This is a one-time setup function
CREATE OR REPLACE FUNCTION public.setup_initial_admin(admin_email text)
RETURNS void AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the user ID for the admin email
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = admin_email;
  
  IF admin_user_id IS NOT NULL THEN
    -- Insert admin role for this user
    -- We bypass RLS here since this is initial setup
    INSERT INTO user_roles (user_id, role, created_by)
    VALUES (admin_user_id, 'admin', admin_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to user with email: %', admin_email;
  ELSE
    RAISE EXCEPTION 'User with email % not found', admin_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to get current user's roles
CREATE OR REPLACE FUNCTION public.get_current_user_roles()
RETURNS TABLE(role text) AS $$
BEGIN
  RETURN QUERY
  SELECT user_roles.role 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add RLS policies for ratings table based on roles
DROP POLICY IF EXISTS "Authenticated users can insert ratings" ON ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can delete own ratings" ON ratings;
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON ratings;
DROP POLICY IF EXISTS "Users can delete own ratings or admins can delete any" ON ratings;

-- Anyone can view ratings
CREATE POLICY "Ratings are viewable by everyone" 
ON ratings FOR SELECT 
USING (true);

-- Authenticated users can insert ratings
CREATE POLICY "Authenticated users can insert ratings" 
ON ratings FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings" 
ON ratings FOR UPDATE 
USING (auth.uid() = student_id);

-- Users can delete their own ratings, admins can delete any
CREATE POLICY "Users can delete own ratings or admins can delete any" 
ON ratings FOR DELETE 
USING (
  auth.uid() = student_id OR 
  public.current_user_has_role('admin')
);

-- 11. Create a view to show user information with roles (optional)
CREATE OR REPLACE VIEW user_profiles_with_roles AS
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.role as profile_role,
  COALESCE(
    array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
    ARRAY[]::text[]
  ) as system_roles,
  p.created_at
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
GROUP BY p.id, p.email, p.display_name, p.role, p.created_at;

-- Grant access to the view
GRANT SELECT ON user_profiles_with_roles TO authenticated;

-- ============================================
-- IMPORTANT: After running this migration, you need to:
-- 1. First, manually insert yourself as admin using Supabase Dashboard
-- 2. Go to Table Editor > user_roles table
-- 3. Click "Insert row"
-- 4. Add your user_id (find it in auth.users table) with role 'admin'
-- 
-- OR if you have SQL access with proper permissions, run:
-- SELECT public.setup_initial_admin('haris.a.mannan@gmail.com');
-- ============================================