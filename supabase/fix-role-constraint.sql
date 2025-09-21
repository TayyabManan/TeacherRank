-- Fix the role constraint to include 'admin' as a valid value

-- 1. First, drop the existing check constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add the new constraint with 'admin' included
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('user', 'admin', 'moderator'));

-- 3. Now you can set yourself as admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'haris.a.mannan@gmail.com';

-- 4. Verify the update worked
SELECT id, email, display_name, role 
FROM profiles 
WHERE email = 'haris.a.mannan@gmail.com';

-- You should see your profile with role = 'admin'