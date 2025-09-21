-- Add 'ignored' to the allowed statuses for teacher_submission_requests
ALTER TABLE teacher_submission_requests 
DROP CONSTRAINT IF EXISTS teacher_submission_requests_status_check;

ALTER TABLE teacher_submission_requests 
ADD CONSTRAINT teacher_submission_requests_status_check 
CHECK (status IN ('pending', 'under_review', 'needs_info', 'approved', 'rejected', 'modified', 'ignored'));

-- Update any existing requests without a status to be 'pending'
UPDATE teacher_submission_requests 
SET status = 'pending' 
WHERE status IS NULL;

-- Verify the update
SELECT DISTINCT status, COUNT(*) 
FROM teacher_submission_requests 
GROUP BY status
ORDER BY status;