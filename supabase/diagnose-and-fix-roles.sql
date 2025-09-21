-- Diagnose and fix the role constraint issue

-- 1. First, let's see what constraints exist on the profiles table
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
AND contype = 'c';

-- 2. Check current column definition
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'profiles' 
AND column_name = 'role';

-- 3. Drop ALL constraints on the role column
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 4. Check if there are any other constraints
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

-- 5. Now alter the column without any constraint first
ALTER TABLE profiles 
ALTER COLUMN role TYPE TEXT;

-- 6. Set all NULL values to 'user' first
UPDATE profiles 
SET role = 'user' 
WHERE role IS NULL;

-- 7. Set invalid values to 'user'
UPDATE profiles 
SET role = 'user' 
WHERE role NOT IN ('user', 'admin', 'moderator');

-- 8. Now add the constraint back
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('user', 'admin', 'moderator'));

-- 9. Finally, set your role to admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'haris.a.mannan@gmail.com';

-- 10. Verify the results
SELECT id, email, display_name, role 
FROM profiles 
WHERE email = 'haris.a.mannan@gmail.com';

-- Show role distribution
SELECT role, COUNT(*) as count 
FROM profiles 
GROUP BY role;