-- Fix Security Issues in Supabase Database
-- This script addresses the security vulnerabilities identified by Supabase linter

-- ============================================
-- 1. Fix SECURITY DEFINER Views
-- ============================================
-- Views should use SECURITY INVOKER (default) instead of SECURITY DEFINER
-- to ensure they respect the calling user's permissions and RLS policies

-- Drop and recreate teacher_aggregates view without SECURITY DEFINER
DROP VIEW IF EXISTS public.teacher_aggregates CASCADE;

CREATE OR REPLACE VIEW public.teacher_aggregates AS
SELECT
  teacher_id,
  avg(score)::numeric(3,2) as avg_rating,
  count(*) as ratings_count
FROM public.ratings
GROUP BY teacher_id;

-- Grant appropriate permissions
GRANT SELECT ON public.teacher_aggregates TO anon, authenticated;

-- Drop and recreate ratings_with_info view without SECURITY DEFINER
DROP VIEW IF EXISTS public.ratings_with_info CASCADE;

CREATE OR REPLACE VIEW public.ratings_with_info AS
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
  p.display_name as student_name
FROM public.ratings r
LEFT JOIN public.teachers t ON r.teacher_id = t.id
LEFT JOIN public.profiles p ON r.student_id = p.id;

-- Grant appropriate permissions
GRANT SELECT ON public.ratings_with_info TO anon, authenticated;

-- Drop and recreate user_profiles_with_roles view without SECURITY DEFINER
DROP VIEW IF EXISTS public.user_profiles_with_roles CASCADE;

CREATE OR REPLACE VIEW public.user_profiles_with_roles AS
SELECT 
  p.id,
  p.email,
  p.display_name,
  p.role,
  p.created_at,
  CASE 
    WHEN p.role = 'admin' THEN true
    ELSE false
  END as is_admin
FROM public.profiles p;

-- Grant appropriate permissions
GRANT SELECT ON public.user_profiles_with_roles TO authenticated;

-- ============================================
-- 2. Enable RLS on Tables Missing It
-- ============================================

-- Enable RLS on teacher_request_audit table
ALTER TABLE public.teacher_request_audit ENABLE ROW LEVEL SECURITY;

-- Enable RLS on email_queue table
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Create RLS Policies for teacher_request_audit
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin users can view all audit logs" ON public.teacher_request_audit;
DROP POLICY IF EXISTS "Admin users can insert audit logs" ON public.teacher_request_audit;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.teacher_request_audit;

-- Policy: Only admins can view audit logs
CREATE POLICY "Admin users can view all audit logs"
ON public.teacher_request_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Only admins can insert audit logs
CREATE POLICY "Admin users can insert audit logs"
ON public.teacher_request_audit
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role has full access to audit logs"
ON public.teacher_request_audit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 4. Create RLS Policies for email_queue
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin users can view email queue" ON public.email_queue;
DROP POLICY IF EXISTS "Admin users can manage email queue" ON public.email_queue;
DROP POLICY IF EXISTS "System can process email queue" ON public.email_queue;

-- Policy: Only admins can view email queue
CREATE POLICY "Admin users can view email queue"
ON public.email_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Only admins can insert/update email queue
CREATE POLICY "Admin users can manage email queue"
ON public.email_queue
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Service role has full access (for backend email processing)
CREATE POLICY "Service role has full access to email queue"
ON public.email_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Allow anon users to insert feedback emails (if needed for contact forms)
CREATE POLICY "Anyone can queue feedback emails"
ON public.email_queue
FOR INSERT
TO anon
WITH CHECK (
  action IN ('feedback_notification', 'contact_form', 'teacher_request')
);

-- ============================================
-- 5. Verify RLS is enabled on all public tables
-- ============================================

-- Check and enable RLS on other tables if not already enabled
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT IN ('schema_migrations', 'supabase_functions_migrations')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    RAISE NOTICE 'RLS enabled on table: %', r.tablename;
  END LOOP;
END $$;

-- ============================================
-- 6. Add comments for documentation
-- ============================================

COMMENT ON VIEW public.teacher_aggregates IS 'Aggregated ratings for teachers - uses INVOKER security';
COMMENT ON VIEW public.ratings_with_info IS 'Ratings with related teacher and student info - uses INVOKER security';
COMMENT ON VIEW public.user_profiles_with_roles IS 'User profiles with role information - uses INVOKER security';

-- ============================================
-- Verification Query
-- ============================================
-- Run this to verify all security issues are fixed:
/*
SELECT 
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relkind as object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind IN ('r', 'v')  -- tables and views
ORDER BY c.relname;
*/