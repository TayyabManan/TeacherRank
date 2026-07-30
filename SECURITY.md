# Security Implementation Guide

This document describes the comprehensive security measures implemented in the TeacherRank application to protect against common vulnerabilities.

## 🔒 Security Overview

TeacherRank implements defense-in-depth security with multiple layers of protection:

1. **Database Security** - Row Level Security (RLS) policies
2. **Application Security** - Input validation, authorization checks, sanitization
3. **Network Security** - Security headers, CSP, HTTPS enforcement
4. **Rate Limiting** - Both client and server-side rate limiting
5. **Audit Logging** - Tracking of admin operations

---

## 🛡️ Implemented Security Fixes

### 1. Row Level Security (RLS) Policies

**File:** `database/migrations/008_restore_rls_policies.sql`

> **2026-07-09:** a production audit found the policies below were no longer in
> effect (anon could write to `teachers`, update `teacher_submission_requests`,
> and read requester PII) — the original `002_implement_rls_policies.sql` had
> been deleted from the repo and its restrictions overridden in production.
> Migration 008 restores this posture and additionally locks down `email_queue`
> (admin-only) and sets `security_invoker` on the public views. Apply notes and
> a post-apply test checklist live in `database/migrations/README.md`.

**Protection Against:**
- Unauthorized data access
- Privilege escalation
- Data tampering by unauthorized users

**Implementation:**

All database tables have RLS enabled with granular policies:

#### Teachers Table
- ✅ **Read:** Public (anyone can view teachers)
- ✅ **Create/Update/Delete:** Admin only

#### Ratings Table
- ✅ **Read:** Public (anyone can view ratings)
- ✅ **Create:** Authenticated users (for their own ratings)
- ✅ **Update/Delete:** Users can only modify their own ratings
- ✅ **Admin Override:** Admins can manage all ratings

#### Profiles Table
- ✅ **Read Own:** Users can read their complete profile
- ✅ **Read Public:** `anon` has no SELECT on `profiles` at all - verified 2026-07-30
  (`GET /rest/v1/profiles` returns `42501 permission denied`). That is stricter
  than the "display_name only" this line used to claim. Note the consequence:
  signed-out visitors cannot resolve reviewer names, so `useRatings` soft-fails
  and renders them as "Anonymous Student".
- ✅ **Update:** Users can only update their own profile
- ✅ **Admin Access:** Admins can read all profiles

#### Feedback & Teacher Requests
- ✅ **Submit:** Anyone can submit
- ✅ **Read/Update/Delete:** Admin only

### 2. Input Validation & Sanitization

**Files:**
- `src/lib/validation.ts` - Sanitization functions
- `database/migrations/003_add_constraints_and_validation.sql` - Server-side validation

**Protection Against:**
- SQL Injection
- XSS (Cross-Site Scripting)
- Content injection
- Spam submissions

**Validation Layers:**

1. **Client-Side Validation** (Zod schemas)
   - Immediate feedback to users
   - Type safety in TypeScript
   - Format validation (email, URL, etc.)

2. **Database-Level Validation** (Triggers & Constraints)
   - Cannot be bypassed - but this applies only where a trigger or constraint
     actually exists. Content moderation (`src/lib/profanityFilter.ts`) and the
     Zod schemas are client-side only and ARE bypassable by posting straight
     to PostgREST.
   - Validates on every insert/update
   - Enforces data integrity

**Sanitization Features:**

```typescript
// Search input sanitization
sanitizeSearchInput(userInput)
// Removes: , ; | ( ) \ ' * .
// Prevents: Filter injection, SQL injection, pattern attacks
```

### 3. Authorization Checks (IDOR Prevention)

**Files:**
- `src/hooks/useRatings.ts` - Rating authorization
- `src/hooks/useTeachers.ts` - Teacher management authorization

**Protection Against:**
- Insecure Direct Object References (IDOR)
- Unauthorized data modification
- Privilege escalation

**Implementation:**

All sensitive operations verify ownership:

```typescript
// Before update/delete
1. Get current user
2. Fetch existing record
3. Verify ownership/permissions
4. Perform operation with double-check via RLS
```

### 4. Security Headers

**File:** [`vercel.json`](vercel.json) (`headers` block). There is no
`public/_headers` file - that path was never created.

**Protection Against:**
- Clickjacking (X-Frame-Options)
- MIME sniffing (X-Content-Type-Options)
- XSS attacks (Content-Security-Policy)
- Mixed content (upgrade-insecure-requests)
- Information leakage (Referrer-Policy)

**Implemented Headers:**

```
✅ X-Frame-Options: DENY
✅ X-Content-Type-Options: nosniff
✅ Content-Security-Policy: [comprehensive policy]
✅ Strict-Transport-Security: HTTPS enforcement
✅ Cross-Origin-Embedder-Policy
✅ Cross-Origin-Opener-Policy
✅ Permissions-Policy: Restrict browser features
```

### 5. Rate Limiting

**Files:**
- `src/lib/rateLimit.ts` - Client-side rate limiting
- `database/migrations/015_rate_limiting_and_anon_abuse.sql` +
  `019_anon_privacy_and_rate_limit_identity.sql` - the real server-side
  enforcement: a `BEFORE INSERT/UPDATE` trigger. There is no
  `rate-limit-enforcer` edge function; that file has never existed here.

**Protection Against:**
- Brute force attacks
- DoS (Denial of Service)
- Spam submissions
- Resource exhaustion

**Rate Limits:**

| Action | Limit | Window |
|--------|-------|---------|
| Create Rating | 5 | 1 minute |
| Update Rating | 10 | 1 minute |
| Sign In | 5 | 15 minutes |
| Sign Up | 3 | 1 hour |
| Search | 30 | 1 minute |

### 6. Data Constraints

**File:** `database/migrations/003_add_constraints_and_validation.sql`

**Protection Against:**
- Duplicate entries
- Invalid data formats
- Data corruption
- Integrity violations

**Constraints:**

✅ Unique teacher (name + institute)
✅ One rating per user per teacher
✅ Rating score: 0.5-5 in half-star increments
✅ Comment length: 10-1000 characters
✅ Email format validation
✅ URL format validation
✅ XSS pattern detection

### 7. Audit Logging

**File:** `database/migrations/003_add_constraints_and_validation.sql`

**Protection Against:**
- Unauthorized actions going unnoticed
- Lack of accountability
- Security incident investigation challenges

**Features:**

- Logs all admin operations (create, update, delete)
- Stores old and new data for comparison
- Immutable audit trail
- Admin-only access to logs

---

## 🚀 Deployment Instructions

### Step 1: Run Database Migrations

**Order is important!** Run migrations in sequence:

```bash
# Restore RLS policies (2026-07-09 — replaces the deleted 002)
psql -U postgres -d your_database -f database/migrations/008_restore_rls_policies.sql
```

**Via Supabase Dashboard:**

1. Go to SQL Editor
2. Copy contents of each migration file
3. Execute in order
4. Verify with test queries provided in migration files

Full apply instructions, rollback, and a post-apply admin-flow test checklist:
`database/migrations/README.md`.

### Step 2: Deploy Edge Functions (Optional but Recommended)

```bash
# NOTE: there is no rate-limit-enforcer function. Rate limiting is enforced by
# the DB trigger in migrations 015 + 019 - apply those instead. The only edge
# function in this repo is send-email:
supabase functions deploy send-email
# SQL provided in the edge function file
```

### Step 3: Set Admin Roles

**Important:** After enabling RLS, you must assign admin roles:

```sql
-- Set admin role for specific users
UPDATE profiles
SET role = 'admin'
WHERE email IN ('your-admin-email@example.com');

-- Verify
SELECT id, email, role FROM profiles WHERE role = 'admin';
```

### Step 4: Verify Security Configuration

Run these verification queries:

```sql
-- 1. Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 2. Check policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- 3. Test as non-admin (should fail)
-- This simulates a regular user trying to insert a teacher
INSERT INTO teachers (name, institute, designation, city)
VALUES ('Test', 'Test', 'Test', 'Test');
-- Expected: Permission denied error
```

---

## 🔍 Security Testing

### Testing RLS Policies

```sql
-- Test as regular user
SET ROLE authenticated;
SET request.jwt.claims.sub = 'non-admin-user-uuid';

-- Should work:
SELECT * FROM teachers;
SELECT * FROM ratings;

-- Should fail:
INSERT INTO teachers (name, institute) VALUES ('Test', 'Test');
DELETE FROM ratings WHERE id = 'any-id';

-- Reset
RESET ROLE;
```

### Testing Client Authorization

1. **Test Rating Authorization:**
   - Try to update someone else's rating → Should fail
   - Try to delete someone else's rating → Should fail
   - Update your own rating → Should succeed

2. **Test Teacher Authorization:**
   - Non-admin tries to create teacher → Should fail
   - Non-admin tries to update teacher → Should fail
   - Admin creates/updates teacher → Should succeed

### Testing Input Validation

```javascript
// Test sanitization
import { sanitizeSearchInput } from './src/lib/validation'

sanitizeSearchInput("test'; DROP TABLE teachers--")
// Should return: "test DROP TABLE teachers"

sanitizeSearchInput("test<script>alert('xss')</script>")
// Should return: "testscriptalert'xss'script"
```

---

## 🛠️ Development Guidelines

### Adding New Tables

When adding new tables, always:

1. ✅ Enable RLS: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;`
2. ✅ Create appropriate policies
3. ✅ Add validation triggers
4. ✅ Define constraints
5. ✅ Grant minimal required permissions

### Adding New Operations

For any new data modification:

1. ✅ Add authorization check
2. ✅ Validate input server-side
3. ✅ Sanitize user input
4. ✅ Add rate limiting
5. ✅ Test with non-admin user

### Code Review Checklist

- [ ] Does it query the database? → Check RLS policies
- [ ] Does it accept user input? → Validate & sanitize
- [ ] Does it modify data? → Verify authorization
- [ ] Does it expose data? → Check for information disclosure
- [ ] Is it a frequent operation? → Add rate limiting

---

## 📚 Security Best Practices

### DO ✅

- Always use parameterized queries
- Sanitize all user input
- Verify authorization on both client and server
- Use HTTPS in production
- Keep dependencies updated
- Log security-relevant events
- Use principle of least privilege
- Test security measures regularly

### DON'T ❌

- Trust client-side validation alone
- Store secrets in client code
- Expose user emails publicly
- Allow unbounded queries
- Skip input validation
- Bypass RLS policies
- Use default credentials
- Ignore security warnings

---

## 🚨 Incident Response

If you discover a security vulnerability:

1. **DO NOT** disclose publicly immediately
2. **DO** email security contact (if configured)
3. **DO** document the issue with:
   - Steps to reproduce
   - Potential impact
   - Affected versions
4. **DO** apply temporary mitigation if possible
5. **DO** update this document after fix

---

## 📊 Security Metrics

Monitor these metrics for security health:

- Failed authentication attempts
- Rate limit violations
- RLS policy violations
- Suspicious query patterns
- Admin operation frequency
- Audit log anomalies

**Query for failed auth attempts:**

```sql
SELECT COUNT(*), DATE_TRUNC('hour', created_at) as hour
FROM audit_log
WHERE table_name = 'auth.users'
  AND operation = 'INSERT'
  AND new_data->>'error' IS NOT NULL
GROUP BY hour
ORDER BY hour DESC;
```

---

## 📖 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-security.html)
- [Content Security Policy Reference](https://content-security-policy.com/)

---

## 🔄 Updates

This document should be updated whenever:
- New security measures are implemented
- Vulnerabilities are discovered and fixed
- Security policies change
- New features with security implications are added

**Last Updated:** 2026-07-09
**Version:** 1.1.0
**Status:** ⚠️ RLS policies restored in `database/migrations/008_restore_rls_policies.sql` — pending application to production (see `database/migrations/README.md`)
