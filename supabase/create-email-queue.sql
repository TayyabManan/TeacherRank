-- Create email queue table for managing email notifications
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  request_id UUID REFERENCES teacher_submission_requests(id) ON DELETE SET NULL,
  action VARCHAR(50),
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_request_id ON email_queue(request_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON email_queue TO authenticated;
GRANT SELECT ON email_queue TO anon;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamp
DROP TRIGGER IF EXISTS update_email_queue_timestamp_trigger ON email_queue;
CREATE TRIGGER update_email_queue_timestamp_trigger
BEFORE UPDATE ON email_queue
FOR EACH ROW
EXECUTE FUNCTION update_email_queue_timestamp();