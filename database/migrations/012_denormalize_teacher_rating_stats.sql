-- Migration 012: denormalize per-teacher rating stats onto teachers
--
-- Every listing/profile view currently aggregates the ratings table (via the
-- teacher_aggregates view or the get_teachers_* RPCs). This moves the two
-- numbers the app actually reads — avg_rating and ratings_count — onto the
-- teachers row, maintained by a trigger on ratings, so reads never touch
-- ratings at all.
--
-- The trigger function MUST be SECURITY DEFINER: since migration 008,
-- teachers is admin-only-writable, and a public rating INSERT would fail
-- with 42501 when the trigger tries to update the teacher's stats.
--
-- Also drops the orphaned teacher_rankings materialized view (never queried:
-- idx_scan = 0 on all three of its indexes as of 2026-07-09) and its refresh
-- function (nothing schedules it — pg_cron isn't even installed).

-- 1. Denormalized columns
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2),
  ADD COLUMN IF NOT EXISTS ratings_count integer NOT NULL DEFAULT 0;

-- 2. Maintenance trigger: recompute the affected teacher(s) from scratch on
--    every ratings write. Recompute-not-increment keeps it correct under
--    concurrent updates and re-runs.
CREATE OR REPLACE FUNCTION public.recompute_teacher_rating_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $fn$
DECLARE
  t_new uuid;
  t_old uuid;
BEGIN
  t_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.teacher_id END;
  t_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.teacher_id END;

  IF t_new IS NOT NULL THEN
    UPDATE public.teachers t
    SET avg_rating = s.a, ratings_count = s.c
    FROM (SELECT avg(score)::numeric(3,2) AS a, count(*)::integer AS c
          FROM public.ratings WHERE teacher_id = t_new) s
    WHERE t.id = t_new;
  END IF;

  IF t_old IS NOT NULL AND t_old IS DISTINCT FROM t_new THEN
    UPDATE public.teachers t
    SET avg_rating = s.a, ratings_count = s.c
    FROM (SELECT avg(score)::numeric(3,2) AS a, count(*)::integer AS c
          FROM public.ratings WHERE teacher_id = t_old) s
    WHERE t.id = t_old;
  END IF;

  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION public.recompute_teacher_rating_stats() IS
  'Keeps teachers.avg_rating/ratings_count in sync with ratings. SECURITY DEFINER because teachers is admin-only-writable under RLS (008).';

DROP TRIGGER IF EXISTS maintain_teacher_rating_stats ON public.ratings;
CREATE TRIGGER maintain_teacher_rating_stats
AFTER INSERT OR UPDATE OF score, teacher_id OR DELETE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.recompute_teacher_rating_stats();

-- 3. Backfill from current ratings
UPDATE public.teachers t
SET avg_rating = agg.a, ratings_count = agg.c
FROM (SELECT teacher_id, avg(score)::numeric(3,2) AS a, count(*)::integer AS c
      FROM public.ratings GROUP BY teacher_id) agg
WHERE t.id = agg.teacher_id;

-- 4. Listing sort index
CREATE INDEX IF NOT EXISTS idx_teachers_rating_sort
  ON public.teachers (avg_rating DESC, ratings_count DESC, name);

-- 5. teacher_aggregates becomes a cheap projection of the new columns.
--    (No other DB object depends on it; app consumers read only
--    teacher_id/avg_rating/ratings_count — unique_raters had no readers.)
DROP VIEW IF EXISTS public.teacher_aggregates;
CREATE VIEW public.teacher_aggregates
WITH (security_invoker = on) AS
SELECT id AS teacher_id, avg_rating, ratings_count
FROM public.teachers;

-- 6. Drop the orphaned rankings matview + its refresh function
DROP MATERIALIZED VIEW IF EXISTS public.teacher_rankings;
DROP FUNCTION IF EXISTS public.refresh_teacher_rankings();

-- Verification (run after): must return zero rows.
-- SELECT t.id, t.avg_rating, t.ratings_count, m.a, m.c
-- FROM public.teachers t
-- LEFT JOIN (SELECT teacher_id, avg(score)::numeric(3,2) a, count(*)::int c
--            FROM public.ratings GROUP BY teacher_id) m ON m.teacher_id = t.id
-- WHERE t.avg_rating IS DISTINCT FROM m.a
--    OR t.ratings_count IS DISTINCT FROM COALESCE(m.c, 0);
