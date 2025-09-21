-- Complete Supabase Setup for TeachRank
-- Run this entire script in Supabase SQL Editor

-- ========================================
-- 1. ENABLE EXTENSIONS
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 2. CREATE TABLES
-- ========================================

-- Drop existing tables if they exist (for clean setup)
DROP VIEW IF EXISTS teacher_aggregates CASCADE;
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  role TEXT CHECK (role IN ('student', 'teacher')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create teachers table
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  institute TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ratings table
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  score INT CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create unique constraint
CREATE UNIQUE INDEX ratings_teacher_student_unique 
ON ratings(teacher_id, student_id);

-- ========================================
-- 3. CREATE FUNCTIONS AND TRIGGERS
-- ========================================

-- Function for updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ratings updated_at
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON ratings
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'display_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- 4. CREATE VIEWS
-- ========================================

-- View for teacher statistics
CREATE OR REPLACE VIEW teacher_aggregates AS
SELECT
  teacher_id,
  AVG(score)::NUMERIC(3,2) AS avg_rating,
  COUNT(*)::INT AS ratings_count
FROM ratings
GROUP BY teacher_id;

-- ========================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 6. CREATE RLS POLICIES
-- ========================================

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Teachers policies
DROP POLICY IF EXISTS "Teachers are viewable by everyone" ON teachers;
CREATE POLICY "Teachers are viewable by everyone" 
ON teachers FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert teachers" ON teachers;
CREATE POLICY "Authenticated users can insert teachers" 
ON teachers FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update teachers" ON teachers;
CREATE POLICY "Authenticated users can update teachers" 
ON teachers FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Ratings policies
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON ratings;
CREATE POLICY "Ratings are viewable by everyone" 
ON ratings FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert ratings" ON ratings;
CREATE POLICY "Authenticated users can insert ratings" 
ON ratings FOR INSERT 
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Users can update own ratings" ON ratings;
CREATE POLICY "Users can update own ratings" 
ON ratings FOR UPDATE 
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Users can delete own ratings" ON ratings;
CREATE POLICY "Users can delete own ratings" 
ON ratings FOR DELETE 
USING (auth.uid() = student_id);

-- ========================================
-- 7. INSERT SAMPLE DATA
-- ========================================

-- Insert sample teachers
INSERT INTO teachers (name, institute, bio, avatar_url) VALUES
('Dr. Sarah Johnson', 'MIT', 'Professor of Computer Science with 15 years of experience in AI and Machine Learning. Passionate about teaching and mentoring students.', 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=5C7CFA&color=fff'),
('Prof. Michael Chen', 'Stanford University', 'Expert in Data Structures and Algorithms. Published author of several CS textbooks. Known for making complex topics accessible.', 'https://ui-avatars.com/api/?name=Michael+Chen&background=00C896&color=fff'),
('Dr. Emily Williams', 'Harvard University', 'Specializes in Web Development and Software Engineering. Industry experience at Google and Meta. Advocates for clean code practices.', 'https://ui-avatars.com/api/?name=Emily+Williams&background=F06292&color=fff'),
('Prof. James Anderson', 'UC Berkeley', 'Database Systems and Cloud Computing expert. Former Amazon Principal Engineer. Focuses on scalable system design.', 'https://ui-avatars.com/api/?name=James+Anderson&background=845EC2&color=fff'),
('Dr. Maria Garcia', 'Carnegie Mellon', 'Robotics and Computer Vision researcher. TEDx speaker and innovation award winner. Bridging theory and practical applications.', 'https://ui-avatars.com/api/?name=Maria+Garcia&background=FF9671&color=fff'),
('Prof. David Kim', 'Yale University', 'Cybersecurity and Cryptography specialist. Former NSA consultant. Teaching secure coding practices for 10+ years.', 'https://ui-avatars.com/api/?name=David+Kim&background=FFC75F&color=fff'),
('Dr. Lisa Brown', 'Princeton', 'Machine Learning and Neural Networks expert. Research focus on ethical AI. Industry collaborations with OpenAI and DeepMind.', 'https://ui-avatars.com/api/?name=Lisa+Brown&background=C34A36&color=fff'),
('Prof. Robert Taylor', 'Columbia University', 'Operating Systems and Computer Architecture. Author of popular OS textbook. Known for engaging lectures.', 'https://ui-avatars.com/api/?name=Robert+Taylor&background=008B74&color=fff');

-- ========================================
-- 8. GRANT PERMISSIONS
-- ========================================

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant access to anon users (for public read)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ========================================
-- SETUP COMPLETE!
-- ========================================
-- Next steps:
-- 1. Update your .env file with your Supabase URL and anon key
-- 2. Enable Email authentication in Supabase Dashboard
-- 3. Test by creating a new account in your app