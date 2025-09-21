-- SQL script to enable admin to delete inappropriate reviews
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Enable RLS on ratings table
-- ============================================
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Create DELETE policy for admin
-- ============================================

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Admin can delete reviews" ON ratings;

-- Create new delete policy for admin
-- Replace the email with your admin email
CREATE POLICY "Admin can delete reviews"
ON ratings
FOR DELETE
TO authenticated
USING (
  auth.email() = 'haris.a.mannan@gmail.com'
  OR auth.email() = (SELECT email FROM auth.users WHERE id = auth.uid() AND email = 'haris.a.mannan@gmail.com')
);

-- ============================================
-- 3. Also allow admin to update reviews (for soft delete or flagging)
-- ============================================

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Admin can update reviews" ON ratings;

-- Create update policy for admin
CREATE POLICY "Admin can update reviews"
ON ratings
FOR UPDATE
TO authenticated
USING (
  auth.email() = 'haris.a.mannan@gmail.com'
)
WITH CHECK (
  auth.email() = 'haris.a.mannan@gmail.com'
);

-- ============================================
-- 4. Add a flagged column for marking inappropriate content
-- ============================================

-- Add column to track flagged/inappropriate reviews
ALTER TABLE ratings 
ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES auth.users(id);

-- ============================================
-- 5. Create a view for admin to see all reviews with details
-- ============================================

DROP VIEW IF EXISTS admin_reviews_dashboard;

CREATE VIEW admin_reviews_dashboard AS
SELECT 
  r.id,
  r.teacher_id,
  r.student_id,
  r.score,
  r.comment,
  r.created_at,
  r.updated_at,
  r.flagged,
  r.flagged_reason,
  r.flagged_at,
  t.name as teacher_name,
  t.institute as teacher_institute,
  p.email as student_email,
  p.display_name as student_name,
  LENGTH(r.comment) as comment_length,
  -- Flag potentially problematic reviews
  CASE 
    WHEN r.comment ~* '(fuck|shit|damn|ass|bitch|bastard|crap|piss|dick|cock|pussy|fag|gay|retard|nigger|cunt)' THEN true
    WHEN LENGTH(r.comment) < 10 THEN true
    WHEN r.comment ~* '(.)\1{5,}' THEN true -- Repeated characters
    WHEN r.comment ~* '(https?://|www\.)' THEN true -- URLs
    ELSE false
  END as potentially_inappropriate
FROM ratings r
LEFT JOIN teachers t ON r.teacher_id = t.id
LEFT JOIN profiles p ON r.student_id = p.id
ORDER BY 
  CASE WHEN r.flagged THEN 0 ELSE 1 END, -- Flagged first
  r.created_at DESC;

-- Grant access to admin
GRANT SELECT ON admin_reviews_dashboard TO authenticated;

-- ============================================
-- 6. Create function to flag a review
-- ============================================

CREATE OR REPLACE FUNCTION flag_review(
  review_id UUID,
  reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is admin
  IF auth.email() != 'haris.a.mannan@gmail.com' THEN
    RAISE EXCEPTION 'Only admin can flag reviews';
  END IF;

  -- Flag the review
  UPDATE ratings
  SET 
    flagged = true,
    flagged_reason = reason,
    flagged_at = NOW(),
    flagged_by = auth.uid()
  WHERE id = review_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION flag_review(UUID, TEXT) TO authenticated;

-- ============================================
-- 7. Create function to unflag a review
-- ============================================

CREATE OR REPLACE FUNCTION unflag_review(
  review_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is admin
  IF auth.email() != 'haris.a.mannan@gmail.com' THEN
    RAISE EXCEPTION 'Only admin can unflag reviews';
  END IF;

  -- Unflag the review
  UPDATE ratings
  SET 
    flagged = false,
    flagged_reason = NULL,
    flagged_at = NULL,
    flagged_by = NULL
  WHERE id = review_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION unflag_review(UUID) TO authenticated;

-- ============================================
-- 8. Grant necessary permissions
-- ============================================

GRANT DELETE ON ratings TO authenticated;
GRANT UPDATE ON ratings TO authenticated;

-- ============================================
-- 9. Test the policies
-- ============================================

SELECT 
  'Current user email:' as info,
  auth.email() as email,
  CASE 
    WHEN auth.email() = 'haris.a.mannan@gmail.com' THEN 'YES - Admin access granted'
    ELSE 'NO - Not admin'
  END as is_admin;

-- ============================================
-- 10. Sample query to find inappropriate reviews
-- ============================================

SELECT 
  'Sample inappropriate reviews:' as info;

SELECT 
  id,
  teacher_name,
  score,
  LEFT(comment, 100) as comment_preview,
  potentially_inappropriate,
  flagged
FROM admin_reviews_dashboard
WHERE potentially_inappropriate = true
OR flagged = true
LIMIT 10;