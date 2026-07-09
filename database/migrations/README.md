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
   `feedback`, 4 on `teacher_submission_requests`, 1 on `email_queue`); the
   Messages tab shows which old policies were dropped.
3. New query — paste `009_cleanup_audit_probe_rows.sql` → **Run**.
   The verification select must return zero rows.

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

## Admin model

Policies use `public.is_admin(uuid)` (SECURITY DEFINER, pinned `search_path`),
which checks `profiles.role = 'admin'` — the same source of truth the app uses
in `src/lib/auth.ts`. Grant admin with:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
```
