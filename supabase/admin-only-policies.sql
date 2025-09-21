-- Admin-Only Teacher Management Policies
-- This gives full control to the admin email only

-- Remove all existing teacher policies
DROP POLICY IF EXISTS "Teachers are viewable by everyone" ON teachers;
DROP POLICY IF EXISTS "Authenticated users can insert teachers" ON teachers;
DROP POLICY IF EXISTS "Authenticated users can update teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can insert teachers" ON teachers;
DROP POLICY IF EXISTS "Only admins can update teachers" ON teachers;
DROP POLICY IF EXISTS "Only admin can insert teachers" ON teachers;
DROP POLICY IF EXISTS "Only admin can update teachers" ON teachers;

-- Keep public viewing (everyone can see teachers)
CREATE POLICY "Teachers are viewable by everyone" 
ON teachers FOR SELECT 
USING (true);

-- Only admin can insert teachers
CREATE POLICY "Only admin can insert teachers" 
ON teachers FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
);

-- Only admin can update teachers
CREATE POLICY "Only admin can update teachers" 
ON teachers FOR UPDATE 
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
);

-- Only admin can delete teachers
CREATE POLICY "Only admin can delete teachers" 
ON teachers FOR DELETE 
USING (
  auth.jwt() ->> 'email' = 'haris.a.mannan@gmail.com'
);

-- Verify policies are working
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'teachers';