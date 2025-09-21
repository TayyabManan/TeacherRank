-- Complete RBAC Fix - Drops ALL policies that might reference role column

-- 1. Drop ALL policies from ALL tables that might reference the role column
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies from profiles table
    FOR pol IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
        RAISE NOTICE 'Dropped policy on profiles: %', pol.policyname;
    END LOOP;

    -- Drop all policies from teacher_request_audit table
    FOR pol IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'teacher_request_audit' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON teacher_request_audit', pol.policyname);
        RAISE NOTICE 'Dropped policy on teacher_request_audit: %', pol.policyname;
    END LOOP;

    -- Drop all policies from admin_audit_log table if it exists
    FOR pol IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'admin_audit_log' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON admin_audit_log', pol.policyname);
        RAISE NOTICE 'Dropped policy on admin_audit_log: %', pol.policyname;
    END LOOP;

    -- Drop policies from any other tables that might reference profiles.role
    FOR pol IN 
        SELECT DISTINCT p.tablename, p.policyname 
        FROM pg_policies p 
        WHERE p.schemaname = 'public' 
        AND (p.definition LIKE '%profiles.role%' OR p.definition LIKE '%role%')
        AND p.tablename NOT IN ('profiles', 'teacher_request_audit', 'admin_audit_log')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
        RAISE NOTICE 'Dropped policy % on table %', pol.policyname, pol.tablename;
    END LOOP;
END $$;

-- 2. Drop all constraints on role column
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'profiles'::regclass 
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%role%'
    ) LOOP
        EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
END $$;

-- 3. Check if role column exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
        RAISE NOTICE 'Added role column to profiles table';
    ELSE
        -- Alter existing column type
        ALTER TABLE profiles ALTER COLUMN role TYPE TEXT;
        RAISE NOTICE 'Updated role column type';
    END IF;
END $$;

-- 4. Fix any invalid data
UPDATE profiles 
SET role = CASE 
    WHEN role IS NULL THEN 'user'
    WHEN role IN ('user', 'admin', 'moderator') THEN role
    ELSE 'user'
END;

-- 5. Add the correct constraint
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('user', 'admin', 'moderator'));

-- 6. Make yourself admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'haris.a.mannan@gmail.com';

-- 7. Make sure the admin functions exist
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

-- 8. Recreate essential policies for profiles table
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
WITH CHECK (id = auth.uid() AND (role = 'user' OR role IS NULL));

-- 9. Recreate policies for ratings table if needed
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ratings') THEN
        -- Drop existing policies first
        FOR pol IN 
            SELECT policyname FROM pg_policies 
            WHERE tablename = 'ratings' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON ratings', pol.policyname);
        END LOOP;
        
        -- Create new policies
        EXECUTE 'CREATE POLICY "Anyone can view ratings" ON ratings FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "Authenticated users can create ratings" ON ratings FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid())';
        EXECUTE 'CREATE POLICY "Users can update own ratings" ON ratings FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid())';
        EXECUTE 'CREATE POLICY "Users can delete own ratings" ON ratings FOR DELETE TO authenticated USING (student_id = auth.uid())';
        EXECUTE 'CREATE POLICY "Admins can manage any rating" ON ratings FOR ALL TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())';
    END IF;
END $$;

-- 10. Verify everything worked
SELECT '=== RBAC Setup Complete ===' as status;

SELECT '=== Current Admin Users ===' as status;
SELECT id, email, display_name, role 
FROM profiles 
WHERE role = 'admin';

SELECT '=== Role Distribution ===' as status;
SELECT role, COUNT(*) as user_count 
FROM profiles 
GROUP BY role
ORDER BY role;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ RBAC setup completed successfully!';
    RAISE NOTICE '✅ Your admin role has been set.';
    RAISE NOTICE '✅ All policies have been recreated.';
    RAISE NOTICE '';
END $$;