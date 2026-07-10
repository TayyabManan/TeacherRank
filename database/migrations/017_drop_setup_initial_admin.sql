-- Migration 017: remove the anon-callable admin-escalation RPC setup_initial_admin
--
-- SECURITY FIX (Critical — anonymous privilege escalation to admin).
-- public.setup_initial_admin(text) was SECURITY DEFINER (owner postgres) with
-- EXECUTE granted to anon + authenticated and NO caller check. Its whole body:
--     UPDATE public.profiles SET role = 'admin' WHERE email = user_email;
-- Because SECURITY DEFINER bypasses RLS, any holder of the public anon key could
--     POST /rest/v1/rpc/setup_initial_admin   {"user_email":"<any email>"}
-- and mint an admin — a full privilege escalation that also defeats the profiles
-- UPDATE/INSERT RLS (which otherwise pins role to its existing value) and the
-- handle_new_user trigger (which hardcodes role='user').
--
-- No caller anywhere: repo-wide grep (src/, api/, scripts/, supabase/functions,
-- database/migrations) returns zero references (2026-07-10). The legitimate way
-- to grant admin is the manual SQL UPDATE documented in this folder's README
-- ("Admin model"), run as postgres in the SQL editor — not an anon-exposed RPC.
-- Dropping the function removes all its EXECUTE grants with it.
--
-- Pre-check (2026-07-10): exactly 1 admin, the expected account; 0 unexpected
-- admins and 0 malformed roles — the hole had not been exploited when this shipped.

DROP FUNCTION IF EXISTS public.setup_initial_admin(text);

NOTIFY pgrst, 'reload schema';

-- Verification (run after):
--   1. Function is gone (expect 0):
--        SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--        WHERE n.nspname = 'public' AND p.proname = 'setup_initial_admin';
--   2. RPC endpoint 404s:
--        POST /rest/v1/rpc/setup_initial_admin {"user_email":"x@y.z"}  -> 404
--   3. No new admins crept in (expect 1, the expected account):
--        SELECT count(*) FILTER (WHERE role = 'admin') FROM public.profiles;
