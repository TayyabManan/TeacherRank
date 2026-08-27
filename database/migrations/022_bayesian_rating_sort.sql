-- Migration 022: credibility-weighted "Top Rated" ordering (Bayesian average)
--
-- The listing's default sort (rating_desc, "Top Rated") ordered by raw
-- teachers.avg_rating, so a teacher with a 5.0 average from 3 reviews outranked
-- a 4.8 from 50 (verified live 2026-08-27: the home page's #1 slot was a
-- 3-review 5.0). Rating volume IS credibility — Baymard's review-UX research
-- finds ~70% of users trust 4.5×180 over 4.8×39 — and the raw sort inverted
-- that.
--
-- Fix: rating_desc / rating_asc now ORDER BY the IMDb-style weighted score
--
--     score = (v*R + m*C) / (v + m)        -- = (v/(v+m))*R + (m/(v+m))*C
--
--   v = ratings_count, R = avg_rating (both denormalized by 012)
--   C = review-weighted platform mean, computed inline from the same
--       teachers scan (equals the mean over all ratings rows, within
--       avg_rating's 2-dp storage rounding). Deliberately computed from
--       teachers, not ratings: teachers is ~362 rows and always readable,
--       and this invoker's-rights function then never depends on the
--       ratings table's column grants (019).
--   m = 5: the prior weight — a teacher's own average pulls the score
--       halfway off the platform mean at 5 reviews and dominates beyond
--       ~15. Sized for the current ~362-teacher, mostly-single-digit-
--       review-count dataset; tune with verification query 2 below.
--
-- Example (C ≈ 4.2): 5.0×3 → (15+21)/8 = 4.50; 4.8×50 → (240+21)/55 ≈ 4.75.
-- The 50-review teacher now leads.
--
-- Unrated teachers pin to score 0, not C: they stay at the BOTTOM of
-- "Top Rated" (and first in rating_asc), exactly where the raw sort put
-- them — a bare (v*R+m*C)/(v+m) would float them mid-list at C.
--
-- rating_asc ("Rising Stars") mirrors to score ASC in the same change
-- because TeacherListing's rank badges require it: under rating_asc the
-- badge counts DOWN from the filtered total (rank = total - offset - index),
-- which only reads correctly while asc is the reverse of desc. Both sorts
-- keep their old name-ASC final tiebreak, so tie groups stay exactly as
-- approximate as before — no worse.
--
-- What does NOT change: the RPC signature, the returned columns, the
-- displayed averages (average_rating stays the raw mean — only the ORDER BY
-- moves), and get_teachers_count. The client is untouched
-- (src/hooks/useTeachersOptimized.ts calls are byte-identical; the listing's
-- #N rank badges are position-derived, so they follow the weighted order
-- automatically — no deploy needed).
--
-- Perf: the ORDER BY has been CASE-per-sort since 013, so it never used
-- 012's idx_teachers_rating_sort anyway; a top-N sort over ~362 rows is
-- sub-millisecond. The index stays (index cleanup is 016's soak-gated job).
--
-- Apply order: needs 012 + 013 (both live since 2026-07-10); independent of
-- the pending 021/020/016 runs — safe to apply on its own at any time.
-- Idempotent: CREATE OR REPLACE against 013's exact signature; re-run freely.
-- search_path is pinned INLINE (013 pinned via a follow-up ALTER) because
-- CREATE OR REPLACE resets unspecified function-level SET options — without
-- the inline clause, this replace would silently UNPIN 013's search_path.

CREATE OR REPLACE FUNCTION public.get_teachers_with_stats(
  search_query text DEFAULT NULL,
  institute_filter text DEFAULT NULL,
  department_filter text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  sort_by text DEFAULT 'rating_desc',
  page_num integer DEFAULT 1,
  page_size integer DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  name text,
  institute text,
  department text,
  designation text,
  city text,
  linkedin_url text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  average_rating numeric,
  ratings_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  WITH platform AS (
    -- One row: m (prior weight) and C (review-weighted platform mean).
    -- Uncorrelated, so it is evaluated once per call, not per teacher row.
    SELECT
      5::numeric AS m,
      COALESCE(sum(pt.avg_rating * pt.ratings_count)
                 / NULLIF(sum(pt.ratings_count), 0), 0)::numeric AS c
    FROM public.teachers pt
  )
  SELECT
    t.id, t.name, t.institute, t.department, t.designation, t.city,
    t.linkedin_url, t.avatar_url, t.bio, t.created_at,
    COALESCE(t.avg_rating, 0)::numeric AS average_rating,
    t.ratings_count::bigint AS ratings_count
  FROM public.teachers t
  CROSS JOIN platform p
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN t.ratings_count > 0 THEN
        (t.ratings_count * COALESCE(t.avg_rating, 0) + p.m * p.c)
          / (t.ratings_count + p.m)
      ELSE 0::numeric
    END AS weighted_rating
  ) w
  WHERE
    (search_query IS NULL OR search_query = '' OR
     t.name ILIKE '%' || search_query || '%' OR
     t.institute ILIKE '%' || search_query || '%' OR
     t.department ILIKE '%' || search_query || '%' OR
     t.designation ILIKE '%' || search_query || '%' OR
     t.city ILIKE '%' || search_query || '%')
    AND (institute_filter IS NULL OR institute_filter = 'all' OR t.institute = institute_filter)
    AND (department_filter IS NULL OR department_filter = 'all' OR t.department = department_filter)
    AND (city_filter IS NULL OR city_filter = 'all' OR t.city = city_filter)
  ORDER BY
    CASE WHEN sort_by = 'rating_desc' THEN w.weighted_rating END DESC,
    CASE WHEN sort_by = 'rating_desc' THEN t.ratings_count END DESC,
    CASE WHEN sort_by = 'rating_asc' THEN w.weighted_rating END ASC,
    CASE WHEN sort_by = 'rating_asc' THEN t.ratings_count END ASC,
    CASE WHEN sort_by = 'institute_az' THEN t.institute END ASC,
    t.name ASC
  LIMIT page_size
  OFFSET (page_num - 1) * page_size
$$;

-- Body-only change to an existing signature — PostgREST's schema cache keys
-- on signatures, so this is not strictly required; kept for parity with 013.
NOTIFY pgrst, 'reload schema';

-- Verification (run after):
--
-- 1. Signature untouched, search_path still pinned — exactly one row:
--      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.proconfig
--      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public' AND p.proname = 'get_teachers_with_stats';
--    args must list the same 7 parameters 013 created; proconfig must contain
--    search_path=public, pg_catalog. (get_teachers_count is untouched by 022.)
--
-- 2. Re-rank eyeball on live data — this is also the m-tuning loop:
--      WITH platform AS (
--        SELECT 5::numeric AS m,
--               COALESCE(sum(avg_rating * ratings_count)
--                          / NULLIF(sum(ratings_count), 0), 0)::numeric AS c
--        FROM public.teachers
--      ), scored AS (
--        SELECT t.name, t.avg_rating, t.ratings_count,
--               CASE WHEN t.ratings_count > 0
--                    THEN (t.ratings_count * COALESCE(t.avg_rating, 0) + p.m * p.c)
--                           / (t.ratings_count + p.m)
--                    ELSE 0 END AS weighted,
--               rank() OVER (ORDER BY COALESCE(t.avg_rating, 0) DESC,
--                                     t.ratings_count DESC) AS raw_rank
--        FROM public.teachers t CROSS JOIN platform p
--      )
--      SELECT rank() OVER (ORDER BY weighted DESC, ratings_count DESC) AS weighted_rank,
--             raw_rank, name, avg_rating, ratings_count, round(weighted, 3) AS score
--      FROM scored ORDER BY weighted_rank LIMIT 20;
--    Expected: the top slots hold high-volume 4.x teachers; the low-volume
--    5.0s that were raw #1 sit below them. If the top 10 still looks
--    volume-starved, raise m; if excellent low-volume teachers vanish
--    entirely, lower it — edit the `5::numeric` in BOTH the function and
--    this query, re-run the file (idempotent), re-eyeball.
--
-- 3. The RPC returns the same order as query 2's top rows:
--      SELECT name, average_rating, ratings_count
--      FROM public.get_teachers_with_stats(sort_by => 'rating_desc', page_size => 10);
--
-- 4. rating_asc still leads with unrated teachers (placement unchanged from
--    the raw sort): ratings_count = 0 rows first, name-alphabetical:
--      SELECT name, average_rating, ratings_count
--      FROM public.get_teachers_with_stats(sort_by => 'rating_asc', page_size => 5);
--
-- 5. From the deployed site (devtools) or curl with the anon key, the
--    client's exact call still succeeds: POST /rest/v1/rpc/get_teachers_with_stats
--    with the usual JSON body (incl. city_filter) → 200, first item is the
--    weighted #1. Hard-refresh the home page: the #1 rank badge should now
--    sit on a teacher with real review volume.
