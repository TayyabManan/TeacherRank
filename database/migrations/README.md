# Database migrations

Production Supabase project: `aieiseomnniqnillyylx` (the `VITE_SUPABASE_URL` in `.env`).

History note: migrations 001–007 were added in commit `b686423` and deleted from
the repo in commit `218eb35` (both 2025-10-22). A 2026-07-09 security audit found
that 002's write restrictions are no longer in effect in production (anon could
INSERT into `teachers`, UPDATE `teacher_submission_requests`, and read requester
PII), while 003's unique index and validation triggers appear to still be live.
Migration 008 restores the documented posture from a clean slate.

## Files

| File | Purpose |
|------|---------|
| `008_restore_rls_policies.sql` | Restores the RLS posture documented in `SECURITY.md` |
| `008_restore_rls_policies_rollback.sql` | Emergency rollback for 008 (**reopens the vulnerability**) |
| `009_cleanup_audit_probe_rows.sql` | Deletes the junk rows left by the audit |
| `010_fix_teacher_request_audit_trigger.sql` | Fixes the audit trigger that aborted every admin status change (`column "details" of relation "teacher_request_audit" does not exist`) |
| `011_restore_profile_autocreation.sql` | Restores the `on_auth_user_created` trigger (CASCADE-dropped Sept 2025) with a valid role and backfills profiles for every user created since — without it, new signups never get a `profiles` row |
| `012_denormalize_teacher_rating_stats.sql` | Adds `teachers.avg_rating`/`ratings_count`, maintained by a SECURITY DEFINER trigger on `ratings`; redefines `teacher_aggregates` as a projection; drops the orphaned `teacher_rankings` matview |
| `013_authoritative_get_teachers_functions.sql` | Replaces every overload of `get_teachers_with_stats`/`get_teachers_count` with one signature matching the client (incl. `city_filter`) — before this, the deployed app's listing RPC 404'd and fell back to downloading the whole teachers table |
| `014_platform_stats_rpc.sql` | `get_platform_stats()`: the home-page stats card in one request (was 6, two transferring every ratings row) |
| `015_rate_limiting_and_anon_abuse.sql` | DB-enforced write limits (BEFORE INSERT trigger on `ratings`/`feedback`/`teacher_submission_requests`; identity = `auth.uid()` else first `x-forwarded-for` hop), anon caps (1/24 h/IP/teacher + 20 anon/teacher/hour), unique anon fingerprint index, drops the old edge-function rate-limiter storage, pg_cron daily cleanup |
| `016_drop_dead_objects.sql` | **NOT APPLIED — soak-gated.** Drops superseded RPC overloads, the unused `ratings_with_info` view, `query_performance_logs`, and zero-scan indexes. Apply no earlier than ~2026-07-17 after re-running the audit in the file header |

## Applying (Supabase dashboard)

**Order matters, and 008 must ship together with the app change below.**

0. **Deploy the app change first** (same commit as these files):
   `src/pages/Feedback.tsx` now generates the feedback id client-side instead of
   `.insert(...).select()`. The old code breaks once 008 makes `feedback`
   insert-only for the public, because insert-returning needs SELECT rights on
   the new row. (Applying 008 before the deploy breaks only the public
   "Request a teacher" form, and only until the deploy lands — general feedback
   and everything else is unaffected.)
1. Dashboard → **Database → Backups** — confirm a recent backup exists.
2. Dashboard → **SQL Editor → New query** — paste the whole of
   `008_restore_rls_policies.sql` → **Run**.
   The result grid should list exactly 13 policies (4 on `teachers`, 4 on
   `feedback`, 4 on `teacher_submission_requests`, 1 on `email_queue`) followed
   by exactly one `is_admin` signature (`is_admin(user_id uuid)`); the
   Messages tab shows which old policies were dropped.
   (A first attempt of 008 failed with `42725: function name "public.is_admin"
   is not unique` and rolled back completely — the live DB has a legacy zero-arg
   `is_admin()` overload from the Sept 2025 dashboard scripts. The current 008
   drops that overload, upgrades `is_admin(uuid)` in place, and recreates its
   sole caller `admin_delete_review`. Safe to re-run.)
3. New query — paste `009_cleanup_audit_probe_rows.sql` → **Run**.
   The verification select must return zero rows.
4. New query — paste `010_fix_teacher_request_audit_trigger.sql` → **Run**.
   The verification select must return one row with
   `writes_previous_status = true` and `details_reference_removed = true`.
   Without 010, **every** admin status change (approve/reject/ignore/needs-info)
   fails — the `log_teacher_request_changes` trigger references a `details`
   column that doesn't exist on `teacher_request_audit`.
5. New query — paste `011_restore_profile_autocreation.sql` → **Run**.
   The first verification select must list `on_auth_user_created`; the second
   must return `users_without_profile = 0`. 011 is independent of 008–010 and
   safe to run in any order / re-run, but don't skip it: since Sept 2025 no
   signup (Google or email) has received a `profiles` row, leaving users stuck
   on "Setting up your profile...".

## 012–015 (applied 2026-07-10 via Supabase MCP)

All four were applied and verified against production on 2026-07-10:

- **012**: backfill matches a fresh aggregate for every teacher (0 mismatches).
  Order matters: **012 before 013** (013 reads the denormalized columns).
- **013**: `POST /rest/v1/rpc/get_teachers_with_stats` with the client's exact
  JSON body (incl. `city_filter`) returns 200 with rows — the deployed app's
  full-table fallback died the moment this applied, no client deploy needed.
- **014**: `SELECT * FROM get_platform_stats()` returns one row.
- **015**: 6 rapid feedback inserts from one IP → the 6th raises
  `P0001 RATE_LIMITED` (tested in a rolled-back transaction — no junk rows);
  `cron.job` lists `cleanup_rate_limit_events` (daily 03:17 UTC);
  `uniq_ratings_anon_fingerprint` exists. The paired client cleanup (same
  commit) removed `src/lib/serverRateLimit.ts` and the two undeployed edge
  functions; friendly error mapping lives in `src/lib/dbErrors.ts`.

Re-run safety: 012/014/015 are idempotent (IF NOT EXISTS / OR REPLACE);
013 drops-and-recreates whatever overloads exist.

## Post-apply testing

The Admin panel does **all writes client-side with the admin's JWT** — there is
no server between the browser and RLS — so test these as a signed-in admin
(`profiles.role = 'admin'`) right after applying:

- [ ] Admin → Teacher Requests: **approve** a request (updates the request,
      inserts a teacher, updates linked feedback, queues an email)
- [ ] Admin → Teacher Requests: **reject** and **request more info** flows
- [ ] Teacher Management: **add**, **edit**, **delete** a teacher
- [ ] Admin → Feedback: list loads, status updates work

And as a signed-out visitor:

- [ ] Teacher listing, profiles, and ratings still load
- [ ] Submitting a rating works
- [ ] Feedback page: general feedback submits
- [ ] Feedback page: "Request a teacher" submits (requires the deployed app fix)

Negative checks (browser devtools console on the public site, signed out —
these must all fail or return empty):

```js
// Should error (RLS): anon insert into teachers
await supabase.from('teachers').insert({ name: 'x', institute: 'x', designation: 'x', city: 'x' })
// Should return no rows: anon read of request/feedback PII
await supabase.from('teacher_submission_requests').select('requester_email').limit(1)
await supabase.from('feedback').select('email').limit(1)
```

If an admin flow breaks and can't be fixed forward quickly, run
`008_restore_rls_policies_rollback.sql` (this reopens the public-write hole —
re-apply 008 as soon as possible).

## Backlog (documented, deliberately not done)

- **email_queue is a non-retrying outbox**: a failed send stays `pending`
  forever with no retry loop. Fine at admin-approval volume (a few emails a
  week, Gmail SMTP ~500/day cap noted); revisit only if email volume grows.
- **pg_trgm search index**: `pg_trgm` is installed but unused. Add a trigram
  index on `teachers(name/institute)` + switch the RPC search to it when
  teachers > ~5k rows or search p95 > 100 ms — below that, ILIKE over the
  ~130-row table is faster than the index maintenance is worth.
- **Abuse escalation path**: if anonymous-rating abuse outgrows 015's caps
  (fingerprint dedupe + 1/24h/IP/teacher + 20/teacher/hour), the documented
  next step is requiring sign-in to rate: flip the client to hide the
  anonymous option and replace `ratings_insert_allowed` with a
  `student_id = auth.uid()` policy. No code needed ahead of time.

## Admin model

Policies use `public.is_admin(uuid)` (SECURITY DEFINER, pinned `search_path`),
which checks `profiles.role = 'admin'` — the same source of truth the app uses
in `src/lib/auth.ts`. Grant admin with:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
```
