-- Migration 014: one-request platform stats
--
-- The home page's usePlatformStats currently issues SIX queries, two of which
-- transfer every ratings row to the client (select score / select student_id)
-- just to compute an average and a distinct count. This RPC returns the whole
-- stats card in one row, one request.
--
-- Client follow-up (same phase): rewrite usePlatformStats to call this RPC and
-- delete the 6-query body. weeklyGrowth stays client-side arithmetic from
-- week_ratings / prev_week_ratings.
--
-- Window semantics: day/week boundaries are computed in UTC (the old client
-- used the browser's local midnight — close enough for a stats card).

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  total_teachers bigint,
  total_ratings bigint,
  average_rating numeric,
  total_students bigint,
  today_ratings bigint,
  week_ratings bigint,
  prev_week_ratings bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT count(*) FROM public.teachers) AS total_teachers,
    count(*) AS total_ratings,
    COALESCE(round(avg(score)::numeric, 1), 0) AS average_rating,
    count(DISTINCT student_id) AS total_students,
    count(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS today_ratings,
    count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS week_ratings,
    count(*) FILTER (WHERE created_at >= now() - interval '14 days'
                       AND created_at <  now() - interval '7 days') AS prev_week_ratings
  FROM public.ratings
$$;

-- Pin search_path (advisor: function_search_path_mutable)
ALTER FUNCTION public.get_platform_stats() SET search_path = public, pg_catalog;

NOTIFY pgrst, 'reload schema';

-- Verification: SELECT * FROM public.get_platform_stats();  → one row whose
-- totals match count(*) on teachers/ratings.
