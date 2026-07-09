-- Migration 011: Restore automatic profile creation for new users
-- Date: 2026-07-09
--
-- Context: fix-all-security-issues-v2.sql (run 2025-09-04, see the dashboard
-- script archive) executed
--     DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
-- The CASCADE removed the on_auth_user_created trigger on auth.users; the
-- script recreated the FUNCTION but never the TRIGGER, so no profiles row has
-- been auto-created for any signup since. The recreated function also inserts
-- role 'student', which ultimate-rbac-fix.sql (2025-09-05) made invalid:
-- profiles_role_check allows only 'user'/'admin'/'moderator', and the
-- "Users can insert own profile" policy additionally requires role = 'user'
-- (or NULL) for self-service inserts. The app's client-side fallback inserted
-- 'student' too, so EVERY path to a new profile has failed since Sept 2025 —
-- new users sign in fine but sit on "Setting up your profile..." forever.
--
-- Companion app change (same commit as this file): the client now writes
-- role 'user' (src/hooks/useAuth.ts), so either side alone can create the
-- profile; this migration makes the DB self-sufficient and repairs existing
-- accounts.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Fix the function: role 'user' (matches profiles_role_check and the
--    column default), display name from OAuth metadata when available.
--    SECURITY DEFINER so the insert is not subject to the caller's RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Recreate the trigger dropped by the 2025-09-04 CASCADE.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Backfill: every auth user orphaned since Sept 2025 gets a profile now.
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, display_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  'user'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification — first query must return on_auth_user_created; second must
-- return 0.
-- ---------------------------------------------------------------------------
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;

SELECT count(*) AS users_without_profile
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
