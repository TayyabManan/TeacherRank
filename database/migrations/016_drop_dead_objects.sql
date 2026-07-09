-- Migration 016: drop dead DB objects — DO NOT APPLY BEFORE ~2026-07-17
--
-- Every drop below was verified to have ZERO client references (repo-wide
-- grep over src/, api/, scripts/, edge functions on 2026-07-10) and, for
-- indexes, idx_scan = 0 in the 2026-07-09 snapshot (see the runbook below).
-- The soak gate exists because 013 replaced the listing RPCs on 2026-07-10:
-- give the new query shapes a full week of production traffic, then re-run
-- the audit before dropping anything.
--
-- PRE-APPLY RUNBOOK (all must pass):
-- 1. At least 7 days since 2026-07-10 (013 live).
-- 2. Re-run the index audit; every index dropped below must still be ~0 scans
--    (small deltas can come from autovacuum/pg_dump — judge against the
--    2026-07-09 baseline in the plan notes):
--      SELECT indexrelname, idx_scan FROM pg_stat_user_indexes
--      WHERE schemaname='public' ORDER BY relname, idx_scan DESC;
-- 3. Confirm the functions are still uncalled (no new client code references):
--      grep -rn "get_teachers_with_stats_and_count|get_distinct_institutes|get_teacher_with_stats\b|create_anonymous_rating|ratings_with_info|query_performance" src/ api/ scripts/
-- 4. Prod smoke afterwards: listing, profile, rate, feedback, admin approve.

-- Superseded listing RPCs (013 is the single authoritative pair)
DROP FUNCTION IF EXISTS public.get_teachers_with_stats_and_count(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_teacher_with_stats(uuid);
DROP FUNCTION IF EXISTS public.get_distinct_institutes();

-- Anonymous-rating helper the client never calls (inserts go straight to the
-- ratings table; 015's trigger enforces the caps)
DROP FUNCTION IF EXISTS public.create_anonymous_rating(uuid, integer, text);

-- View with no readers (admin dashboard queries tables directly)
DROP VIEW IF EXISTS public.ratings_with_info;

-- Write-only query-performance log (nothing reads it; its insert path is dead)
DROP TABLE IF EXISTS public.query_performance_logs;
DROP FUNCTION IF EXISTS public.log_query_performance(text, integer, jsonb);

-- Zero-scan indexes (idx_scan = 0 on 2026-07-09 — re-verify per runbook)
DROP INDEX IF EXISTS public.idx_ratings_score_decimal;
DROP INDEX IF EXISTS public.idx_ratings_teacher_id;        -- covered by idx_ratings_teacher_score / _teacher_created
DROP INDEX IF EXISTS public.idx_ratings_fingerprint;       -- superseded by uniq_ratings_anon_fingerprint (015)
DROP INDEX IF EXISTS public.idx_teachers_search_text;      -- 160 KB gin index, never scanned (search uses ILIKE)
DROP INDEX IF EXISTS public.idx_email_queue_created_at;
DROP INDEX IF EXISTS public.idx_profiles_role;
DROP INDEX IF EXISTS public.idx_teacher_requests_status;
DROP INDEX IF EXISTS public.idx_teacher_requests_reviewed_by;
DROP INDEX IF EXISTS public.idx_teacher_requests_requester_email;

NOTIFY pgrst, 'reload schema';
