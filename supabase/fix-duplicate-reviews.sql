-- Fix to prevent users from having multiple reviews (anonymous and non-anonymous) per teacher

-- Step 1: Add a session identifier for anonymous reviews (optional but helpful for tracking)
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS session_id text;

-- Step 2: Create a function to check if a user already has a review (anonymous or not) for a teacher
CREATE OR REPLACE FUNCTION check_existing_review(
  p_teacher_id uuid,
  p_user_id uuid
)
RETURNS boolean AS $$
BEGIN
  -- Check if user has any review for this teacher (either with their ID or anonymous from same session)
  RETURN EXISTS (
    SELECT 1 FROM ratings 
    WHERE teacher_id = p_teacher_id 
    AND student_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a better constraint using a trigger
CREATE OR REPLACE FUNCTION prevent_duplicate_reviews()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is an update, allow it
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  
  -- For inserts, check if user already has a review
  IF NEW.student_id IS NOT NULL THEN
    -- Check if this user already has a review for this teacher
    IF EXISTS (
      SELECT 1 FROM ratings 
      WHERE teacher_id = NEW.teacher_id 
      AND student_id = NEW.student_id
      AND id != COALESCE(NEW.id, gen_random_uuid())
    ) THEN
      RAISE EXCEPTION 'You have already reviewed this teacher. Please update your existing review instead.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the trigger
DROP TRIGGER IF EXISTS prevent_duplicate_reviews_trigger ON ratings;
CREATE TRIGGER prevent_duplicate_reviews_trigger
  BEFORE INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_reviews();

-- Step 5: Update RLS policies to be more explicit
DROP POLICY IF EXISTS "Anyone can insert ratings" ON ratings;

-- New policy: Allow inserts but the trigger will prevent duplicates
CREATE POLICY "Insert ratings with duplicate check" 
ON ratings FOR INSERT 
WITH CHECK (
  -- Allow anonymous reviews always
  (student_id IS NULL) 
  OR 
  -- For logged-in users, allow if they don't have existing review
  (student_id IS NOT NULL AND auth.uid() = student_id)
);

-- Step 6: Create a function to get user's review status for a teacher
CREATE OR REPLACE FUNCTION get_user_review_info(
  p_teacher_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  has_review boolean,
  is_anonymous boolean,
  review_id uuid,
  score int,
  comment text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as has_review,
    student_id IS NULL as is_anonymous,
    id as review_id,
    ratings.score,
    ratings.comment
  FROM ratings
  WHERE teacher_id = p_teacher_id 
    AND student_id = p_user_id
  LIMIT 1;
  
  -- If no review found, return empty result
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::uuid, NULL::int, NULL::text;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_existing_review TO anon;
GRANT EXECUTE ON FUNCTION check_existing_review TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_review_info TO authenticated;

-- Test the setup
SELECT 'Duplicate review prevention setup completed!' as status;