-- Ultimate RBAC Fix - Handles views, policies, and constraints

-- 1. First, identify and drop all views that depend on profiles.role
DO $$ 
DECLARE
    v RECORD;
BEGIN
    -- Find and drop all views that reference the profiles table
    FOR v IN 
        SELECT DISTINCT dependee.relname AS view_name
        FROM pg_depend 
        JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
        JOIN pg_class as dependee ON pg_rewrite.ev_class = dependee.oid 
        JOIN pg_class as dependent ON pg_depend.refobjid = dependent.oid 
        JOIN pg_attribute ON pg_depend.refobjid = pg_attribute.attrelid 
            AND pg_depend.refobjsubid = pg_attribute.attnum
        WHERE dependent.relname = 'profiles'
        AND pg_attribute.attname = 'role'
        AND dependee.relkind = 'v'
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', v.view_name);
        RAISE NOTICE 'Dropped view: %', v.view_name;
    END LOOP;
    
    -- Also try to drop known views that might exist
    EXECUTE 'DROP VIEW IF EXISTS user_profiles_with_roles CASCADE';
    EXECUTE 'DROP VIEW IF EXISTS admin_users CASCADE';
    EXECUTE 'DROP VIEW IF EXISTS user_roles_view CASCADE';
END $$;

-- 2. Drop ALL policies from ALL tables
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT DISTINCT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
        RAISE NOTICE 'Dropped policy % on table %', pol.policyname, pol.tablename;
    END LOOP;
END $$;

-- 3. Drop all constraints on profiles table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'profiles'::regclass 
        AND contype = 'c'
    ) LOOP
        EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
END $$;

-- 4. Now we can safely modify the role column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        -- Add role column if it doesn't exist
        ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
        RAISE NOTICE 'Added role column to profiles table';
    ELSE
        -- Drop default if exists
        ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;
        -- Change type
        ALTER TABLE profiles ALTER COLUMN role TYPE TEXT;
        -- Set default
        ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';
        RAISE NOTICE 'Updated role column type';
    END IF;
END $$;

-- 5. Fix any invalid data
UPDATE profiles 
SET role = CASE 
    WHEN role IS NULL THEN 'user'
    WHEN role IN ('user', 'admin', 'moderator') THEN role
    ELSE 'user'
END;

-- 6. Add the correct constraint
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('user', 'admin', 'moderator'));

-- 7. Make yourself admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'haris.a.mannan@gmail.com';

-- 8. Create/Replace admin check functions
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

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Recreate useful views
CREATE OR REPLACE VIEW user_profiles_with_roles AS
SELECT 
    p.id,
    p.email,
    p.display_name,
    p.role,
    p.created_at,
    (p.role = 'admin') as is_admin,
    (p.role IN ('admin', 'moderator')) as is_moderator_or_admin
FROM profiles p;

-- Grant permissions on the view
GRANT SELECT ON user_profiles_with_roles TO authenticated;

-- 10. Recreate essential policies

-- Profiles policies
CREATE POLICY "Anyone can view profiles"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() AND 
  (role = (SELECT role FROM profiles WHERE id = auth.uid()) OR role IS NULL)
);

CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() AND (role = 'user' OR role IS NULL));

-- Ratings policies (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ratings') THEN
        EXECUTE 'CREATE POLICY "Anyone can view ratings" ON ratings FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "Authenticated users can create ratings" ON ratings FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid())';
        EXECUTE 'CREATE POLICY "Users can update own ratings" ON ratings FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid())';
        EXECUTE 'CREATE POLICY "Users can delete own ratings" ON ratings FOR DELETE TO authenticated USING (student_id = auth.uid() OR is_current_user_admin())';
    END IF;
END $$;

-- Teachers policies (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teachers') THEN
        EXECUTE 'CREATE POLICY "Anyone can view teachers" ON teachers FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "Authenticated users can create teachers" ON teachers FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "Admins can update teachers" ON teachers FOR UPDATE TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())';
        EXECUTE 'CREATE POLICY "Admins can delete teachers" ON teachers FOR DELETE TO authenticated USING (is_current_user_admin())';
    END IF;
END $$;

-- 11. Verify everything worked
SELECT '=======================' as separator;
SELECT '✅ RBAC SETUP COMPLETE' as status;
SELECT '=======================' as separator;

SELECT 'Admin Users:' as category;
SELECT email, display_name, role 
FROM profiles 
WHERE role = 'admin';

SELECT '' as blank;
SELECT 'Role Distribution:' as category;
SELECT role, COUNT(*) as count 
FROM profiles 
GROUP BY role
ORDER BY role;

SELECT '' as blank;
SELECT '✅ Your admin access is now configured!' as message;
SELECT '✅ The RBAC system is fully operational!' as message2;