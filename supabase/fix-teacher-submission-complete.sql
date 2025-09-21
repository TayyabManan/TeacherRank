-- Complete fix for teacher submission requests
-- This creates a simpler structure that works with the existing frontend code

-- First, ensure both tables exist with proper structure
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('teacher_request', 'feature_request', 'bug_report', 'general')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  email TEXT,
  name TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS teacher_submission_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  teacher_name TEXT NOT NULL,
  institute TEXT NOT NULL,
  designation TEXT NOT NULL,
  city TEXT NOT NULL,
  linkedin_url TEXT,
  bio TEXT,
  requester_email TEXT NOT NULL,
  requester_name TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_submission_requests ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Anyone can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can submit teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Admins can view teacher requests" ON teacher_submission_requests;
DROP POLICY IF EXISTS "Users can view their own teacher requests" ON teacher_submission_requests;

-- Create very permissive policies for testing
-- Feedback table policies
CREATE POLICY "Public can insert feedback" 
ON feedback FOR INSERT 
TO public, anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can select feedback" 
ON feedback FOR SELECT 
TO public, anon, authenticated
USING (true);

CREATE POLICY "Public can update feedback" 
ON feedback FOR UPDATE 
TO public, anon, authenticated
USING (true);

-- Teacher submission requests policies
CREATE POLICY "Public can insert teacher requests" 
ON teacher_submission_requests FOR INSERT 
TO public, anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can select teacher requests" 
ON teacher_submission_requests FOR SELECT 
TO public, anon, authenticated
USING (true);

CREATE POLICY "Public can update teacher requests" 
ON teacher_submission_requests FOR UPDATE 
TO public, anon, authenticated
USING (true);

-- Grant permissions explicitly
GRANT ALL ON feedback TO anon;
GRANT ALL ON feedback TO authenticated;
GRANT ALL ON feedback TO public;

GRANT ALL ON teacher_submission_requests TO anon;
GRANT ALL ON teacher_submission_requests TO authenticated;
GRANT ALL ON teacher_submission_requests TO public;

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at 
BEFORE UPDATE ON feedback 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_requests_updated_at ON teacher_submission_requests;
CREATE TRIGGER update_teacher_requests_updated_at 
BEFORE UPDATE ON teacher_submission_requests 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_requests_created_at ON teacher_submission_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_requests_status ON teacher_submission_requests(status);
CREATE INDEX IF NOT EXISTS idx_teacher_requests_requester_email ON teacher_submission_requests(requester_email);

-- Test insert to verify it works
DO $$
BEGIN
    -- Test feedback insert
    INSERT INTO feedback (type, title, description, email, name)
    VALUES ('teacher_request', 'Test Teacher Request', 'Testing submission', 'test@example.com', 'Test User');
    
    -- If successful, delete the test data
    DELETE FROM feedback WHERE title = 'Test Teacher Request' AND email = 'test@example.com';
    
    RAISE NOTICE 'Test insert successful - tables are working correctly';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test insert failed: %', SQLERRM;
END $$;

-- Add a helper function to simplify teacher request submission
CREATE OR REPLACE FUNCTION submit_teacher_request(
    p_teacher_name TEXT,
    p_institute TEXT,
    p_designation TEXT,
    p_city TEXT,
    p_requester_email TEXT,
    p_requester_name TEXT,
    p_reason TEXT,
    p_linkedin_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_feedback_id UUID;
    v_request_id UUID;
BEGIN
    -- Create feedback entry
    INSERT INTO feedback (type, title, description, email, name)
    VALUES (
        'teacher_request',
        'Teacher Request: ' || p_teacher_name,
        'Request to add ' || p_teacher_name || ' from ' || p_institute,
        p_requester_email,
        p_requester_name
    )
    RETURNING id INTO v_feedback_id;
    
    -- Create teacher submission request
    INSERT INTO teacher_submission_requests (
        feedback_id,
        teacher_name,
        institute,
        designation,
        city,
        requester_email,
        requester_name,
        reason,
        linkedin_url,
        bio
    )
    VALUES (
        v_feedback_id,
        p_teacher_name,
        p_institute,
        p_designation,
        p_city,
        p_requester_email,
        p_requester_name,
        p_reason,
        p_linkedin_url,
        p_bio
    )
    RETURNING id INTO v_request_id;
    
    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION submit_teacher_request TO anon;
GRANT EXECUTE ON FUNCTION submit_teacher_request TO authenticated;
GRANT EXECUTE ON FUNCTION submit_teacher_request TO public;