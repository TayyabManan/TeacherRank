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
| `016_drop_dead_objects.sql` | **NOT APPLIED — still pending as of 2026-08-26.** Drops superseded RPC overloads, the unused `ratings_with_info` view, `query_performance_logs`, and zero-scan indexes. The grep half of its audit was re-run 2026-08-26 (zero client references, still); the `pg_stat` half is STALE — `teachers` went 127 → 362 rows on 2026-08-05 (Bahria import) — so re-run the index-scan query in the file header before applying. Keep it out of the 019/021/020 security run |
| `017_drop_setup_initial_admin.sql` | **Security fix (Critical) — applied 2026-07-10 via MCP.** Drops `setup_initial_admin(text)`, a `SECURITY DEFINER` RPC that let any anon-key holder set `profiles.role = 'admin'` via `POST /rest/v1/rpc/setup_initial_admin` (no caller check, bypassed RLS). Zero repo references; the legitimate admin-grant path is the manual `UPDATE` in "Admin model" below |
| `019_anon_privacy_and_rate_limit_identity.sql` | **APPLIED — confirmed against prod 2026-08-26** (it was applied some time after the 2026-08-05 check that recorded it as pending; who ran it is not recorded here). (a) Column-level SELECT on `ratings` so `metadata` (the anonymous reviewer's device fingerprint) is no longer world-readable; adds `get_anon_rating_id()`. (b) Rebuilds `enforce_rate_limit()`: identity uses the **rightmost** x-forwarded-for hop and is never NULL, closing a silent fail-open; extends the ratings trigger to UPDATE. Confirming probes: `GET /rest/v1/ratings?select=metadata` → **401**, `GET …?select=*` → **42501**, `POST /rpc/get_anon_rating_id` → **200**. ⚠ **It went in ahead of its app prerequisite**, which broke two things now fixed in the commit that added this line: `useUserRating` selected `*` on ratings (signed-in "your review" prefill dead — 42501) and the Admin delete fallback used a bare `.select()`. It also broke anonymous re-review, which needs migration 021 — see below |
| `020_scrub_leaked_anon_fingerprints.sql` | **NOT APPLIED — run only after 019.** Strips the `fingerprint` key from `metadata` on historical anonymous rows. 019 stops future reads but leaves the already-published linkage stored, where a grant regression or DB export could re-expose it. Keeps the `timestamp` key. Tradeoff documented in the file header: those specific historical reviews lose their device-edit path. Includes a pre-flight count so you can check the ratio before committing |
| `018_fix_teacher_delete_fk.sql` | **Bug fix — applied 2026-07-30.** Admin teacher-delete failed with 23503 ("existing related data") for any teacher created by approving a request: `teacher_submission_requests.teacher_id` referenced `teachers(id)` with NO ACTION (verified in prod before the fix). Rebuilds the FK as `ON DELETE SET NULL` so the delete succeeds and the request survives as an audit record |
| `021_ratings_write_policies_and_anon_edit_rpc.sql` | **Bug fix + hardening (2026-08-26 audit) — NOT APPLIED.** Primarily fixes a LIVE BREAKAGE: since 019 went in, anonymous re-review errors out — `get_anon_rating_id` finds the row (200) but the client's follow-up `UPDATE` is refused (`anon` has no UPDATE on ratings: PATCH/DELETE on a real anon row both → **42501**, verified 2026-08-26). `update_anon_rating()` replaces the two-step with one SECURITY DEFINER call that verifies the fingerprint server-side. Also puts the ratings WRITE policies under source control for the first time (008 treatment — they exist only as Sept-2025 dashboard scripts): INSERT requires `student_id = auth.uid()` or NULL, UPDATE/DELETE = own-or-admin, anon UPDATE/DELETE explicitly revoked, plus a BEFORE UPDATE trigger making `flagged*` admin-only. Note: the audit's hypothesis that anon could rewrite *any* anonymous review is **refuted** for the current DB by those 42501s — the value here is that the posture becomes reviewable and re-appliable, not that a hole is open today. App prerequisite ships in the same commit as this README change |

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

## 017 (applied 2026-07-10 via Supabase MCP)

Critical security fix from the 2026-07-10 whole-app review — **not** soak-gated
(an actively-exploitable anon→admin hole is closed immediately, not soaked like
016's dead-object drops). `DROP FUNCTION public.setup_initial_admin(text)`.

Verified against production right after applying:
- `setup_initial_admin` no longer exists in `pg_proc` (0 rows) → the
  `/rest/v1/rpc/setup_initial_admin` endpoint 404s.
- `profiles` admins unchanged: `admin_count = 1`, the expected account, `0`
  unexpected admins — the pre-fix audit found no evidence the hole was abused.

Idempotent (`DROP ... IF EXISTS`); safe to re-run. To reverse (not advised), the
function body was a bare `UPDATE public.profiles SET role='admin' WHERE
email = user_email;` — but grant admin via the manual `UPDATE` in "Admin model"
instead of re-exposing an anon-callable RPC.

## Live state and what is pending (verified 2026-08-26)

`npm run verify:rls` probes the live posture with the public anon key and names
the migration behind any gap. Run it before and after any change here. As of
2026-08-26 every probe passes except `update_anon_rating` (migration 021).

Confirmed applied: **008–015, 017, 018, 019**.
Pending: **021** (below), **020** (after 021), **016** (unrelated cleanup).

**019 was applied ahead of its app-side prerequisite**, and two things have been
broken in production since:

1. *Signed-in review prefill* — `useUserRating` selected `*` on `ratings`, which
   is 42501 under 019's column grants. Fixed in the commit that added this
   section (it now uses `RATING_COLUMNS`), plus a `ratingsSelectGuard` test so a
   `select('*')` on ratings cannot come back.
2. *Anonymous re-review* — `get_anon_rating_id` resolves the row but the
   client's follow-up UPDATE is refused (anon has no UPDATE on ratings).
   Needs **021**; the app-side half also ships in that commit.

### The 021 run

0. **Deploy the app first.** The new client prefers `update_anon_rating()` and
   falls back to today's behavior while 021 is unapplied, so deploying first is
   safe and fixes (1) immediately. Applying 021 under an older build leaves
   anonymous re-review broken exactly as it is now.
1. Dashboard → **Database → Backups** — confirm a recent backup exists.
2. Run `021_ratings_write_policies_and_anon_edit_rpc.sql`, then its verification
   queries (bottom of the file). It rebuilds every ratings policy from a clean
   slate, so read them rather than trusting the run to be a no-op.
3. `npm run verify:rls` — all probes must pass now.
4. Smoke as a signed-out visitor: submit an anonymous rating, then submit again
   from the same device — it must **update** the existing review, not error and
   not duplicate. As a signed-in user: the "your existing review" prefill loads.
   As an admin: flag and unflag a review still works.

### Then 020

Run the pre-flight count in `020_scrub_leaked_anon_fingerprints.sql` and judge
the ratio per its header before running the scrub. It is deliberately last: it
removes the fingerprints `update_anon_rating()` matches on, so those historical
rows lose their device-edit path — verify 021's flow works *before* narrowing
the data it works on.

`016` stays out of this: it is dead-object cleanup gated on a fresh `pg_stat`
audit (see its header), not a fix — do not bundle it into this run.

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

- **email_queue is a non-retrying outbox**: no automatic retry loop and no UI —
  an Admin → Emails tab with per-row resend was built 2026-08-26 and removed
  the same day at the owner's request. What remains: every attempt is still
  logged to `email_queue` (queryable via SQL), and send failures surface in the
  admin flows' warning toasts including the reason (`src/lib/emailService.ts`
  maps browser-level blocks — e.g. ad-blockers eating the functions call — to a
  plain-language diagnosis). Historical note: this tab is how we learned 63/65
  notification emails had silently failed. Revisit if email reliability
  matters more later.
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
