-- Complete RBAC Fix - Handles policies and constraints properly

-- 1. First, drop ALL policies on profiles table (they reference the role column)
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
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- 2. Now drop the constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 3. Drop any other constraints on role column
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

-- 4. Now we can alter the column type safely
ALTER TABLE profiles 
ALTER COLUMN role TYPE TEXT;

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

-- 8. Recreate the policies for profiles table
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

-- 9. Verify everything worked
SELECT 'Current admin users:' as message;
SELECT id, email, display_name, role 
FROM profiles 
WHERE role = 'admin';

SELECT 'Role distribution:' as message;
SELECT role, COUNT(*) as count 
FROM profiles 
GROUP BY role
ORDER BY role;

-- Success!
SELECT 'RBAC setup completed successfully!' as message;