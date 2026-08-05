-- Migration 020: remove the anonymous-reviewer device fingerprints that were
-- already published, after 019 closes the hole that published them.
--
-- RUN THIS ONLY AFTER 019. On its own it accomplishes nothing: while anon still
-- holds SELECT on ratings.metadata, new reviews keep publishing a fresh
-- fingerprint and scrubbing the old ones just loses data for no gain.
--
-- WHY THIS IS NEEDED AT ALL
-- 019 revokes SELECT on `metadata`, so nobody can read the column through
-- PostgREST any more. It does not remove what is already stored. Re-verified
-- against production on 2026-08-05 with the public anon key:
--     GET /rest/v1/ratings?select=metadata  ->  200, 15/15 anonymous rows
--     carrying metadata.fingerprint, across 14 distinct devices.
-- Those values are, at this point, public. Rotating them is pointless — anyone
-- who wanted them has had them. What the scrub buys is that the linkage stops
-- living in the table, so a future grant regression, a service-key leak, or a
-- database export cannot re-expose it a second time.
--
-- THE TRADEOFF (small here, but real)
-- `get_anon_rating_id` (019) matches a device to its prior review via
-- metadata->>'fingerprint'. Removing the key means those specific historical
-- reviews can no longer be edited by the device that wrote them — a repeat
-- visitor gets a NEW review instead of updating the old one. At the time of
-- writing that affects 15 rows / 14 devices on a table with 15 total ratings,
-- and no device has yet re-reviewed the same teacher (checked: 0 same-device,
-- same-teacher pairs). If that ratio is very different when you run this,
-- reconsider — see the count check below, which is why it runs first.
--
-- The `timestamp` key is deliberately kept: it is not identifying, and it is
-- the only record of when the anonymous submission happened.

-- ---------------------------------------------------------------------------
-- 0. Look before you leap. Run this SELECT on its own first.
-- ---------------------------------------------------------------------------
--   SELECT count(*) FILTER (WHERE metadata ? 'fingerprint')            AS with_fingerprint,
--          count(DISTINCT metadata->>'fingerprint')                    AS distinct_devices,
--          count(*)                                                    AS anon_rows
--   FROM public.ratings
--   WHERE student_id IS NULL;
--
-- If `distinct_devices` is close to `with_fingerprint`, each device has one
-- review and losing the edit path costs almost nothing. If it is much smaller,
-- devices are re-reviewing and you are taking away a capability people use.

-- ---------------------------------------------------------------------------
-- 1. Drop only the identifying key, preserving the rest of the object
-- ---------------------------------------------------------------------------
-- `metadata - 'fingerprint'` removes that one key from the jsonb object rather
-- than nulling the whole column, so `timestamp` survives.

UPDATE public.ratings
SET metadata = metadata - 'fingerprint'
WHERE student_id IS NULL
  AND metadata ? 'fingerprint';

-- ---------------------------------------------------------------------------
-- 2. Verification (expect 0)
-- ---------------------------------------------------------------------------
--   SELECT count(*) FROM public.ratings
--   WHERE student_id IS NULL AND metadata ? 'fingerprint';
--
-- And confirm the timestamps survived (expect the same count as before):
--   SELECT count(*) FROM public.ratings
--   WHERE student_id IS NULL AND metadata ? 'timestamp';
--
-- Note on the unique index: uniq_ratings_anon_fingerprint constrains
-- metadata->>'fingerprint' for anonymous rows. Postgres treats NULLs as
-- distinct in a unique index, so removing the key from many rows at once does
-- not collide. New reviews still write a fingerprint and are still deduped.
