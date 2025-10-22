-- Migration: Add Database Constraints and Server-Side Validation
-- Date: 2025-10-22
-- Description: Add constraints, triggers, and validation functions for data integrity
-- Security Fix: Prevent duplicate entries, validate inputs server-side, enforce data quality

-- =============================================================================
-- STEP 1: Add Unique Constraints (Prevent Duplicates)
-- =============================================================================

-- Prevent duplicate teachers (same name + institute)
-- Drop existing index if exists
DROP INDEX IF EXISTS idx_unique_teacher;

-- Create unique index (case-insensitive)
CREATE UNIQUE INDEX idx_unique_teacher
ON teachers (LOWER(TRIM(name)), LOWER(TRIM(institute)));

COMMENT ON INDEX idx_unique_teacher IS 'Prevents duplicate teachers with same name and institute (case-insensitive)';

-- Prevent duplicate ratings from same user to same teacher
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_rating_per_user
ON ratings (teacher_id, student_id)
WHERE student_id IS NOT NULL;

COMMENT ON INDEX idx_unique_rating_per_user IS 'Ensures one rating per student per teacher';

-- =============================================================================
-- STEP 2: Add Check Constraints
-- =============================================================================

-- Rating score must be between 0.5 and 5
ALTER TABLE ratings
DROP CONSTRAINT IF EXISTS check_rating_score_range,
ADD CONSTRAINT check_rating_score_range
CHECK (score >= 0.5 AND score <= 5 AND (score * 2)::INTEGER = (score * 2));

COMMENT ON CONSTRAINT check_rating_score_range ON ratings IS 'Rating must be 0.5-5 in half-star increments';

-- Rating comment must have reasonable length
ALTER TABLE ratings
DROP CONSTRAINT IF EXISTS check_comment_length,
ADD CONSTRAINT check_comment_length
CHECK (length(TRIM(comment)) >= 10 AND length(comment) <= 1000);

COMMENT ON CONSTRAINT check_comment_length ON ratings IS 'Comment must be 10-1000 characters';

-- Teacher name constraints
ALTER TABLE teachers
DROP CONSTRAINT IF EXISTS check_teacher_name_length,
ADD CONSTRAINT check_teacher_name_length
CHECK (length(TRIM(name)) >= 2 AND length(name) <= 100);

-- Institute name constraints
ALTER TABLE teachers
DROP CONSTRAINT IF EXISTS check_institute_length,
ADD CONSTRAINT check_institute_length
CHECK (length(TRIM(institute)) >= 2 AND length(institute) <= 200);

-- =============================================================================
-- STEP 3: Server-Side Validation Functions
-- =============================================================================

-- Function to validate and sanitize feedback
CREATE OR REPLACE FUNCTION validate_feedback()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim whitespace
  NEW.title := TRIM(NEW.title);
  NEW.description := TRIM(NEW.description);

  -- Length validation
  IF length(NEW.title) < 1 OR length(NEW.title) > 100 THEN
    RAISE EXCEPTION 'Title must be 1-100 characters';
  END IF;

  IF length(NEW.description) < 10 OR length(NEW.description) > 1000 THEN
    RAISE EXCEPTION 'Description must be 10-1000 characters';
  END IF;

  -- Basic XSS prevention
  IF NEW.title ~* '<script|javascript:|on\w+=' THEN
    RAISE EXCEPTION 'Title contains potentially dangerous content';
  END IF;

  IF NEW.description ~* '<script|<iframe|javascript:|on\w+=' THEN
    RAISE EXCEPTION 'Description contains potentially dangerous content';
  END IF;

  -- Email validation if provided
  IF NEW.email IS NOT NULL AND NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_feedback_before_insert
  BEFORE INSERT OR UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION validate_feedback();

-- Function to validate teacher data
CREATE OR REPLACE FUNCTION validate_teacher()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim all string fields
  NEW.name := TRIM(NEW.name);
  NEW.institute := TRIM(NEW.institute);
  NEW.designation := TRIM(NEW.designation);
  NEW.city := TRIM(NEW.city);

  -- Name validation (letters, spaces, hyphens, apostrophes, periods only)
  IF NEW.name !~* '^[a-zA-Z\s\-''\.]+$' THEN
    RAISE EXCEPTION 'Teacher name contains invalid characters';
  END IF;

  -- City validation
  IF NEW.city !~* '^[a-zA-Z\s\-''\.]+$' THEN
    RAISE EXCEPTION 'City name contains invalid characters';
  END IF;

  -- LinkedIn URL validation if provided
  IF NEW.linkedin_url IS NOT NULL AND NEW.linkedin_url != '' THEN
    IF NEW.linkedin_url !~* '^https?://(www\.)?linkedin\.com/.*' THEN
      RAISE EXCEPTION 'LinkedIn URL must be a valid LinkedIn profile URL';
    END IF;
  END IF;

  -- Bio XSS prevention
  IF NEW.bio IS NOT NULL AND NEW.bio ~* '<script|<iframe|javascript:|on\w+=' THEN
    RAISE EXCEPTION 'Bio contains potentially dangerous content';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_teacher_before_insert
  BEFORE INSERT OR UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION validate_teacher();

-- Function to validate rating data
CREATE OR REPLACE FUNCTION validate_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim comment
  NEW.comment := TRIM(NEW.comment);

  -- Check for spam patterns in comment
  IF NEW.comment ~* 'https?://|www\.' THEN
    RAISE EXCEPTION 'Comments cannot contain URLs';
  END IF;

  -- Check for excessive repeated characters
  IF NEW.comment ~* '(.)\1{5,}' THEN
    RAISE EXCEPTION 'Comment contains excessive repeated characters';
  END IF;

  -- Check for spam keywords
  IF NEW.comment ~* '\b(click here|buy now|limited offer|act now|visit my)\b' THEN
    RAISE EXCEPTION 'Comment appears to contain spam';
  END IF;

  -- Validate score is in half-star increments
  IF (NEW.score * 2)::INTEGER != (NEW.score * 2) THEN
    RAISE EXCEPTION 'Score must be in half-star increments';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_rating_before_insert
  BEFORE INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION validate_rating();

-- Function to validate teacher submission requests
CREATE OR REPLACE FUNCTION validate_teacher_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim fields
  NEW.teacher_name := TRIM(NEW.teacher_name);
  NEW.institute := TRIM(NEW.institute);
  NEW.designation := TRIM(NEW.designation);
  NEW.city := TRIM(NEW.city);
  NEW.reason := TRIM(NEW.reason);

  -- Validate requester email
  IF NEW.requester_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid requester email format';
  END IF;

  -- Validate reason length
  IF length(NEW.reason) < 10 OR length(NEW.reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be 10-500 characters';
  END IF;

  -- LinkedIn URL validation
  IF NEW.linkedin_url IS NOT NULL AND NEW.linkedin_url != '' THEN
    IF NEW.linkedin_url !~* '^https?://(www\.)?linkedin\.com/.*' THEN
      RAISE EXCEPTION 'LinkedIn URL must be a valid LinkedIn profile URL';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_teacher_request_before_insert
  BEFORE INSERT OR UPDATE ON teacher_submission_requests
  FOR EACH ROW EXECUTE FUNCTION validate_teacher_request();

-- =============================================================================
-- STEP 4: Add Updated Timestamp Triggers
-- =============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables that have updated_at column
CREATE TRIGGER set_updated_at_teachers
  BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_ratings
  BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_feedback
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- STEP 5: Add Audit Logging (Optional but recommended)
-- =============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "audit_log_select_admin" ON audit_log
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Function to log admin operations
CREATE OR REPLACE FUNCTION log_admin_operation()
RETURNS TRIGGER AS $$
BEGIN
  IF is_admin(auth.uid()) THEN
    INSERT INTO audit_log (table_name, operation, user_id, old_data, new_data)
    VALUES (
      TG_TABLE_NAME,
      TG_OP,
      auth.uid(),
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit logging to sensitive tables
CREATE TRIGGER audit_teachers
  AFTER INSERT OR UPDATE OR DELETE ON teachers
  FOR EACH ROW EXECUTE FUNCTION log_admin_operation();

CREATE TRIGGER audit_ratings_delete
  AFTER DELETE ON ratings
  FOR EACH ROW EXECUTE FUNCTION log_admin_operation();

-- =============================================================================
-- STEP 6: Add Indexes for Performance
-- =============================================================================

-- Index for faster rating queries
CREATE INDEX IF NOT EXISTS idx_ratings_teacher_id ON ratings(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ratings_student_id ON ratings(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at DESC);

-- Index for faster teacher queries
CREATE INDEX IF NOT EXISTS idx_teachers_institute ON teachers(institute);
CREATE INDEX IF NOT EXISTS idx_teachers_city ON teachers(city);
CREATE INDEX IF NOT EXISTS idx_teachers_created_at ON teachers(created_at DESC);

-- Index for feedback queries
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- =============================================================================
-- STEP 7: Add Helper Functions for Common Operations
-- =============================================================================

-- Function to safely delete a review (admin only)
CREATE OR REPLACE FUNCTION admin_delete_review(review_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  DELETE FROM ratings WHERE id = review_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_delete_review TO authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE audit_log IS 'Audit trail of admin operations for security monitoring';
COMMENT ON FUNCTION validate_feedback IS 'Server-side validation for feedback submissions';
COMMENT ON FUNCTION validate_teacher IS 'Server-side validation for teacher data';
COMMENT ON FUNCTION validate_rating IS 'Server-side validation for rating submissions';
COMMENT ON FUNCTION validate_teacher_request IS 'Server-side validation for teacher requests';
COMMENT ON FUNCTION update_updated_at_column IS 'Automatically updates updated_at timestamp';
COMMENT ON FUNCTION log_admin_operation IS 'Logs admin operations to audit trail';
COMMENT ON FUNCTION admin_delete_review IS 'Safely delete a review with admin authorization';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- To verify constraints:
-- SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'teachers'::regclass;

-- To verify triggers:
-- SELECT tgname, tgtype, tgenabled FROM pg_trigger WHERE tgrelid = 'teachers'::regclass;
