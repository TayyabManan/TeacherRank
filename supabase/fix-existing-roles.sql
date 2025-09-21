-- Check and fix existing role values in profiles table

-- 1. First, let's see what role values currently exist
SELECT DISTINCT role, COUNT(*) as count 
FROM profiles 
GROUP BY role;

-- 2. Check for any NULL or invalid role values
SELECT id, email, role 
FROM profiles 
WHERE role IS NULL 
   OR role NOT IN ('user', 'admin', 'moderator');

-- 3. Fix any NULL or invalid roles by setting them to 'user'
UPDATE profiles 
SET role = 'user' 
WHERE role IS NULL 
   OR role NOT IN ('user', 'admin', 'moderator');

-- 4. Now we can safely add the constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('user', 'admin', 'moderator'));

-- 5. Set your account as admin (using the role-based system)
-- Since you can already access admin, this makes it official in the database
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'haris.a.mannan@gmail.com';

-- 6. Verify everything is correct
SELECT 
  role, 
  COUNT(*) as user_count 
FROM profiles 
GROUP BY role 
ORDER BY role;

-- 7. Show admin users
SELECT id, email, display_name, role 
FROM profiles 
WHERE role = 'admin';