-- IMMEDIATE FIX for ON CONFLICT error
-- Run this in Supabase SQL Editor NOW to fix the error

-- Option 1: Try to create the constraint (this might fail if duplicates exist)
ALTER TABLE ratings 
ADD CONSTRAINT ratings_teacher_student_unique 
UNIQUE (teacher_id, student_id);

-- If Option 1 fails with "duplicate key" error, run these steps:

-- Step 1: Check for duplicate reviews
SELECT 
  teacher_id, 
  student_id, 
  COUNT(*) as duplicate_count,
  array_agg(id) as rating_ids,
  array_agg(created_at ORDER BY created_at DESC) as created_dates
FROM ratings
WHERE student_id IS NOT NULL
GROUP BY teacher_id, student_id
HAVING COUNT(*) > 1;

-- Step 2: If duplicates exist, keep only the most recent one
-- This deletes older duplicates, keeping the newest review
WITH duplicates AS (
  SELECT 
    id,
    teacher_id,
    student_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY teacher_id, student_id 
      ORDER BY created_at DESC
    ) as rn
  FROM ratings
  WHERE student_id IS NOT NULL
)
DELETE FROM ratings
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 3: Now create the constraint (should work after removing duplicates)
ALTER TABLE ratings 
ADD CONSTRAINT ratings_teacher_student_unique 
UNIQUE (teacher_id, student_id);

-- Step 4: Verify it worked
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'ratings'::regclass
  AND contype = 'u';

-- You should see: ratings_teacher_student_unique | UNIQUE (teacher_id, student_id)