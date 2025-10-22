-- FINAL FIX: Remove SECURITY DEFINER from all views
-- Just drop and recreate - simple and clean

-- Drop all views
DROP VIEW IF EXISTS teacher_aggregates CASCADE;
DROP VIEW IF EXISTS ratings_with_info CASCADE;
DROP VIEW IF EXISTS teacher_requests_view CASCADE;
DROP VIEW IF EXISTS admin_reviews_dashboard CASCADE;
DROP VIEW IF EXISTS user_profiles_with_roles CASCADE;

-- Create teacher_aggregates (clean, no SECURITY DEFINER)
CREATE VIEW teacher_aggregates AS
SELECT
  r.teacher_id,
  AVG(r.score)::numeric(3,2) as avg_rating,
  COUNT(*)::integer as ratings_count,
  COUNT(DISTINCT r.student_id)::integer as unique_raters
FROM ratings r
GROUP BY r.teacher_id;

-- Create ratings_with_info (clean, no SECURITY DEFINER)
CREATE VIEW ratings_with_info AS
SELECT
  r.id,
  r.teacher_id,
  r.student_id,
  r.score,
  r.comment,
  r.created_at,
  r.updated_at,
  t.name as teacher_name,
  t.institute as teacher_institute
FROM ratings r
LEFT JOIN teachers t ON r.teacher_id = t.id;

-- Create teacher_requests_view (clean, no SECURITY DEFINER)
CREATE VIEW teacher_requests_view AS
SELECT
  tsr.id,
  tsr.teacher_name,
  tsr.institute,
  tsr.designation,
  tsr.city,
  tsr.linkedin_url,
  tsr.bio,
  tsr.requester_email,
  tsr.requester_name,
  tsr.reason,
  tsr.status,
  tsr.created_at,
  tsr.feedback_id,
  f.type as feedback_type,
  f.status as feedback_status
FROM teacher_submission_requests tsr
LEFT JOIN feedback f ON tsr.feedback_id = f.id;

-- Create admin_reviews_dashboard (clean, no SECURITY DEFINER)
CREATE VIEW admin_reviews_dashboard AS
SELECT
  r.id,
  r.teacher_id,
  r.student_id,
  r.score,
  r.comment,
  r.created_at,
  r.updated_at,
  t.name as teacher_name,
  t.institute as teacher_institute,
  CASE
    WHEN r.student_id IS NULL THEN 'Anonymous'::text
    ELSE 'Authenticated'::text
  END as review_type
FROM ratings r
LEFT JOIN teachers t ON r.teacher_id = t.id;

-- Create user_profiles_with_roles (clean, no SECURITY DEFINER)
CREATE VIEW user_profiles_with_roles AS
SELECT
  p.id,
  p.display_name,
  p.role,
  p.created_at,
  p.updated_at,
  CASE
    WHEN (SELECT auth.uid()) = p.id OR (SELECT is_admin((SELECT auth.uid()))) THEN p.email
    ELSE NULL::text
  END as email
FROM profiles p;

-- Grant permissions
GRANT SELECT ON teacher_aggregates TO authenticated, anon;
GRANT SELECT ON ratings_with_info TO authenticated, anon;
GRANT SELECT ON teacher_requests_view TO authenticated;
GRANT SELECT ON admin_reviews_dashboard TO authenticated;
GRANT SELECT ON user_profiles_with_roles TO authenticated;

-- Done
SELECT 'Views recreated successfully' as result;
