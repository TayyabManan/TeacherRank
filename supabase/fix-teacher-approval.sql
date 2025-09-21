-- Fix for teacher approval errors

-- 1. Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add missing columns to teachers table if they don't exist
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Make sure optional fields are nullable
ALTER TABLE teachers 
ALTER COLUMN linkedin_url DROP NOT NULL,
ALTER COLUMN bio DROP NOT NULL,
ALTER COLUMN avatar_url DROP NOT NULL,
ALTER COLUMN email DROP NOT NULL,
ALTER COLUMN designation DROP NOT NULL;

-- 4. Ensure proper permissions for authenticated users
GRANT INSERT, SELECT, UPDATE ON teachers TO authenticated;

-- 5. If teachers table uses UUID for ID, ensure it has proper default
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teachers' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE teachers ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- 6. Make sure the email_queue table exists
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

-- 7. Grant permissions for email_queue
GRANT SELECT, INSERT, UPDATE ON email_queue TO authenticated;

-- 8. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at);

-- 9. Test by checking the tables structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'teachers'
ORDER BY ordinal_position;