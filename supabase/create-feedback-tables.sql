-- Create feedback table for storing all types of feedback
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

-- Create teacher submission requests table for more detailed teacher requests
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_submission_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (for public submission)
CREATE POLICY "Anyone can submit feedback" ON feedback
  FOR INSERT WITH CHECK (true);

-- Allow anyone to insert teacher requests (for public submission)  
CREATE POLICY "Anyone can submit teacher requests" ON teacher_submission_requests
  FOR INSERT WITH CHECK (true);

-- Only admins can view all feedback (we'll check admin email in the app)
CREATE POLICY "Admins can view all feedback" ON feedback
  FOR SELECT USING (true);

CREATE POLICY "Admins can update feedback" ON feedback
  FOR UPDATE USING (true);

CREATE POLICY "Admins can view teacher requests" ON teacher_submission_requests
  FOR SELECT USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE
ON feedback FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_requests_created_at ON teacher_submission_requests(created_at DESC);