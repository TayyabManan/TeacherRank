-- Migration 016: drop dead DB objects — STILL PENDING (status as of 2026-08-26)
--
-- Every drop below was verified to have ZERO client references (repo-wide
-- grep over src/, api/, scripts/, edge functions on 2026-07-10; RE-VERIFIED
-- 2026-08-26 against the current tree — still zero) and, for indexes,
-- idx_scan = 0 in the 2026-07-09 snapshot (see the runbook below).
--
-- TIMELINE: the original soak gate ("7 days after 013 went live 2026-07-10")
-- expired ~2026-07-17. The migration then sat unapplied while the data
-- changed under it: the 2026-08-05 Bahria import grew `teachers` 127 → 362
-- rows, so every "zero-scan index" conclusion drawn against the smaller table
-- is STALE. The grep half of the audit is current; the pg_stat half must be
-- re-run fresh — do not apply on the 2026-07-09 numbers.
--
-- PRE-APPLY RUNBOOK (all must pass, in order):
-- 1. Re-run the index audit against TODAY's stats; every index dropped below
--    must still be ~0 scans (small deltas can come from autovacuum/pg_dump —
--    judge against the 2026-07-09 baseline in the plan notes, remembering the
--    table is now ~3x larger):
--      SELECT indexrelname, idx_scan FROM pg_stat_user_indexes
--      WHERE schemaname='public' ORDER BY relname, idx_scan DESC;
--    Pay particular attention to idx_teachers_search_text: ILIKE over 362 rows
--    is still cheap, but if search latency has degraded since the import,
--    keeping (and using) a trigram index may now be the right call instead of
--    dropping it — see the pg_trgm note in the README backlog.
-- 2. Confirm the functions are still uncalled (no new client code references):
--      grep -rn "get_teachers_with_stats_and_count|get_distinct_institutes|get_teacher_with_stats\b|create_anonymous_rating|ratings_with_info|query_performance" src/ api/ scripts/
--    (Last run 2026-08-26: zero references.)
-- 3. Prod smoke afterwards: listing, profile, rate, feedback, admin approve.
--
-- Keep this OUT of the 019/021/020 security run — bundling reversible cleanup
-- with security fixes makes both harder to verify and to roll back.

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
