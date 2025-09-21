-- First, let's see what columns the teachers table actually has
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'teachers'
ORDER BY ordinal_position;

-- Add email column if it doesn't exist (make it optional)
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Ensure all the columns we need exist
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS institute VARCHAR(255),
ADD COLUMN IF NOT EXISTS designation VARCHAR(255),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Make sure optional fields are nullable
ALTER TABLE teachers 
ALTER COLUMN email DROP NOT NULL,
ALTER COLUMN linkedin_url DROP NOT NULL,
ALTER COLUMN bio DROP NOT NULL,
ALTER COLUMN avatar_url DROP NOT NULL,
ALTER COLUMN designation DROP NOT NULL,
ALTER COLUMN created_by DROP NOT NULL;

-- Grant permissions
GRANT ALL ON teachers TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;