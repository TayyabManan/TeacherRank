-- Fix for ON CONFLICT error when submitting reviews

-- Step 1: Drop the existing partial unique index if it exists
DROP INDEX IF EXISTS ratings_teacher_student_unique;

-- Step 2: Create a proper unique constraint that works with ON CONFLICT
-- This creates a unique constraint on the combination of teacher_id and student_id
-- But only when student_id is not null (partial index)
ALTER TABLE ratings 
DROP CONSTRAINT IF EXISTS ratings_teacher_student_key;

-- Step 3: Add a proper unique constraint for non-anonymous reviews
ALTER TABLE ratings 
ADD CONSTRAINT ratings_teacher_student_key 
UNIQUE (teacher_id, student_id);

-- Note: This will allow multiple NULL values for student_id (anonymous reviews)
-- which is what we want - multiple anonymous reviews per teacher are allowed

-- Step 4: Verify the constraint was created
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_namespace nsp ON nsp.oid = con.connamespace
JOIN pg_class cls ON cls.oid = con.conrelid
WHERE cls.relname = 'ratings'
  AND con.contype = 'u';

-- If the above doesn't work because of existing duplicate data, 
-- first check for duplicates:
SELECT teacher_id, student_id, COUNT(*) as count
FROM ratings
WHERE student_id IS NOT NULL
GROUP BY teacher_id, student_id
HAVING COUNT(*) > 1;

-- If duplicates exist, you'll need to remove them first:
-- This query keeps only the most recent review for each teacher-student pair
DELETE FROM ratings r1
WHERE student_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM ratings r2
    WHERE r2.teacher_id = r1.teacher_id
      AND r2.student_id = r1.student_id
      AND r2.created_at > r1.created_at
  );

-- Then try adding the constraint again
-- After running this, the ON CONFLICT clause should work properly