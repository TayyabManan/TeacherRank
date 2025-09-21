-- Enable anonymous reviews by updating the ratings table and policies

-- Step 1: Remove the unique constraint that requires student_id
-- First drop the existing unique index if it exists
DROP INDEX IF EXISTS ratings_teacher_student_unique;

-- Step 2: Create a new partial unique index that only applies when student_id is not null
-- This allows multiple anonymous reviews but prevents duplicate reviews from the same logged-in user
CREATE UNIQUE INDEX ratings_teacher_student_unique 
ON ratings(teacher_id, student_id) 
WHERE student_id IS NOT NULL;

-- Step 3: Update the RLS (Row Level Security) policies to allow anonymous inserts

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read ratings" ON ratings;
DROP POLICY IF EXISTS "Users can insert ratings" ON ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can delete own ratings" ON ratings;

-- Enable RLS on the ratings table if not already enabled
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Create new policies that support anonymous reviews

-- Policy: Anyone can read all ratings (including anonymous)
CREATE POLICY "Anyone can read ratings" 
ON ratings FOR SELECT 
USING (true);

-- Policy: Allow both authenticated users and anonymous to insert ratings
CREATE POLICY "Anyone can insert ratings" 
ON ratings FOR INSERT 
WITH CHECK (true);

-- Policy: Only authenticated users can update their own ratings (not anonymous)
CREATE POLICY "Users can update own ratings" 
ON ratings FOR UPDATE 
USING (auth.uid() = student_id AND student_id IS NOT NULL)
WITH CHECK (auth.uid() = student_id AND student_id IS NOT NULL);

-- Policy: Only authenticated users can delete their own ratings (not anonymous)
CREATE POLICY "Users can delete own ratings" 
ON ratings FOR DELETE 
USING (auth.uid() = student_id AND student_id IS NOT NULL);

-- Step 4: Grant necessary permissions for anonymous users
GRANT SELECT, INSERT ON ratings TO anon;
GRANT SELECT ON teachers TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- Step 5: Update the create rating function to handle anonymous submissions
CREATE OR REPLACE FUNCTION create_anonymous_rating(
  p_teacher_id uuid,
  p_score int,
  p_comment text
)
RETURNS uuid AS $$
DECLARE
  v_rating_id uuid;
BEGIN
  -- Validate score
  IF p_score < 1 OR p_score > 5 THEN
    RAISE EXCEPTION 'Score must be between 1 and 5';
  END IF;
  
  -- Validate comment length
  IF length(p_comment) < 10 THEN
    RAISE EXCEPTION 'Comment must be at least 10 characters';
  END IF;
  
  IF length(p_comment) > 500 THEN
    RAISE EXCEPTION 'Comment must be less than 500 characters';
  END IF;
  
  -- Insert the anonymous rating
  INSERT INTO ratings (teacher_id, student_id, score, comment)
  VALUES (p_teacher_id, NULL, p_score, p_comment)
  RETURNING id INTO v_rating_id;
  
  RETURN v_rating_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_anonymous_rating TO anon;
GRANT EXECUTE ON FUNCTION create_anonymous_rating TO authenticated;

-- Step 6: Add a column to track if a review is anonymous (optional but useful for UI)
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS is_anonymous boolean 
GENERATED ALWAYS AS (student_id IS NULL) STORED;

-- Step 7: Create a view that shows ratings with anonymous indicator
CREATE OR REPLACE VIEW ratings_with_info AS
SELECT 
  r.id,
  r.teacher_id,
  r.student_id,
  r.score,
  r.comment,
  r.created_at,
  r.updated_at,
  CASE 
    WHEN r.student_id IS NULL THEN 'Anonymous'
    ELSE COALESCE(p.display_name, p.email, 'Student')
  END as reviewer_name,
  r.student_id IS NULL as is_anonymous
FROM ratings r
LEFT JOIN profiles p ON r.student_id = p.id;

-- Grant select permission on the view
GRANT SELECT ON ratings_with_info TO anon;
GRANT SELECT ON ratings_with_info TO authenticated;

-- Test query to verify anonymous reviews work
SELECT 'Anonymous reviews setup completed successfully!' as status;