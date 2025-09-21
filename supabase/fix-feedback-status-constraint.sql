-- First, we need to update the feedback table's status constraint to include new status values

-- Drop the existing constraint (the name might vary, so we'll check first)
ALTER TABLE feedback 
DROP CONSTRAINT IF EXISTS feedback_status_check;

-- Add the updated constraint with all status values
ALTER TABLE feedback 
ADD CONSTRAINT feedback_status_check 
CHECK (status IN ('new', 'in_progress', 'resolved', 'closed', 'pending', 'under_review', 'needs_info', 'approved', 'rejected', 'modified'));

-- Now update any existing 'new' statuses to 'pending' for teacher requests
UPDATE feedback 
SET status = 'pending' 
WHERE type = 'teacher_request' 
AND status = 'new';

-- Then run the rest of the schema updates
-- Update teacher_submission_requests table for better status tracking
ALTER TABLE teacher_submission_requests 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'needs_info', 'approved', 'rejected', 'modified')),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create an audit log table for tracking status changes
CREATE TABLE IF NOT EXISTS teacher_request_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES teacher_submission_requests(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teacher_requests_status ON teacher_submission_requests(status);
CREATE INDEX IF NOT EXISTS idx_teacher_requests_reviewed_by ON teacher_submission_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_request_audit_request_id ON teacher_request_audit(request_id);

-- Update the feedback table status to sync with teacher requests
UPDATE feedback f
SET status = COALESCE(tsr.status, 'pending')
FROM teacher_submission_requests tsr
WHERE f.id = tsr.feedback_id
AND f.type = 'teacher_request';

-- Create a function to automatically update feedback status when teacher request status changes
CREATE OR REPLACE FUNCTION sync_feedback_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feedback 
  SET status = NEW.status,
      admin_notes = NEW.admin_notes
  WHERE id = NEW.feedback_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync statuses
DROP TRIGGER IF EXISTS sync_feedback_status_trigger ON teacher_submission_requests;
CREATE TRIGGER sync_feedback_status_trigger
AFTER UPDATE OF status ON teacher_submission_requests
FOR EACH ROW
EXECUTE FUNCTION sync_feedback_status();

-- Create a function to log status changes
CREATE OR REPLACE FUNCTION log_teacher_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO teacher_request_audit (
      request_id,
      action,
      previous_status,
      new_status,
      notes,
      performed_by
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        WHEN NEW.status = 'modified' THEN 'modified'
        WHEN NEW.status = 'needs_info' THEN 'requested_info'
        ELSE 'status_changed'
      END,
      OLD.status,
      NEW.status,
      NEW.admin_notes,
      NEW.reviewed_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to log changes
DROP TRIGGER IF EXISTS log_teacher_request_changes ON teacher_submission_requests;
CREATE TRIGGER log_teacher_request_changes
AFTER UPDATE ON teacher_submission_requests
FOR EACH ROW
EXECUTE FUNCTION log_teacher_request_status_change();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON teacher_request_audit TO authenticated;
GRANT SELECT, UPDATE ON teacher_submission_requests TO authenticated;