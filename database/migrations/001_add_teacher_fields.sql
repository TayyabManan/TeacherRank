-- Migration: Add new fields to teachers table
-- Date: 2025-09-02
-- Description: Add designation, city, and linkedin_url fields to the teachers table

-- Add the new columns to the teachers table
ALTER TABLE teachers 
ADD COLUMN designation VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN city VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN linkedin_url TEXT DEFAULT NULL;

-- Update existing records to have default values
UPDATE teachers 
SET 
    designation = 'Professor' 
WHERE designation = '';

UPDATE teachers 
SET 
    city = 'Unknown' 
WHERE city = '';

-- Add comments to explain the new columns
COMMENT ON COLUMN teachers.designation IS 'Teacher designation/title (e.g., Professor, Assistant Professor, Lecturer)';
COMMENT ON COLUMN teachers.city IS 'City where the institute/teacher is located';
COMMENT ON COLUMN teachers.linkedin_url IS 'Optional LinkedIn profile URL for the teacher';

-- Create index for better search performance on new fields
CREATE INDEX idx_teachers_designation ON teachers(designation);
CREATE INDEX idx_teachers_city ON teachers(city);

-- Grant permissions (adjust as needed based on your setup)
-- GRANT SELECT, INSERT, UPDATE ON teachers TO your_app_user;