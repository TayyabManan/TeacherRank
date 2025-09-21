-- Add new fields to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Add some example data to existing teachers (optional)
UPDATE teachers SET 
  designation = CASE 
    WHEN name LIKE '%Dr.%' THEN 'Professor'
    WHEN name LIKE '%Prof.%' THEN 'Associate Professor'
    ELSE 'Lecturer'
  END,
  city = CASE 
    WHEN institute LIKE '%MIT%' THEN 'Cambridge'
    WHEN institute LIKE '%Stanford%' THEN 'Stanford'
    WHEN institute LIKE '%Harvard%' THEN 'Cambridge'
    WHEN institute LIKE '%Berkeley%' THEN 'Berkeley'
    WHEN institute LIKE '%Columbia%' THEN 'New York'
    WHEN institute LIKE '%Yale%' THEN 'New Haven'
    WHEN institute LIKE '%Princeton%' THEN 'Princeton'
    WHEN institute LIKE '%Carnegie%' THEN 'Pittsburgh'
    WHEN institute LIKE '%Oxford%' THEN 'Oxford'
    ELSE 'Unknown'
  END
WHERE designation IS NULL;