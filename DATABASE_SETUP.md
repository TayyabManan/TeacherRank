# Database Security Setup Guide

This guide will walk you through setting up the comprehensive security measures for the TeacherRank database.

## 📋 Prerequisites

- Access to Supabase dashboard or PostgreSQL command line
- Admin credentials for your database
- Backup of existing data (recommended)

---

## 🚀 Quick Start

### Option 1: Using Supabase Dashboard (Recommended)

1. Open **Supabase Dashboard** → Your Project
2. Navigate to **SQL Editor**
3. Execute migrations in order (copy & paste)
4. Verify results

### Option 2: Using Command Line

```bash
# Navigate to project directory
cd "/mnt/e/Haris/GIS Portfolio/Teacher Rank"

# Run migrations in order
psql -U postgres -d your_database -f database/migrations/002_implement_rls_policies.sql
psql -U postgres -d your_database -f database/migrations/003_add_constraints_and_validation.sql
```

---

## 📝 Step-by-Step Instructions

### Step 1: Backup Your Database

**Always backup before applying migrations!**

#### Via Supabase Dashboard:
1. Go to **Database** → **Backups**
2. Click **Create Backup**
3. Wait for completion

#### Via Command Line:
```bash
pg_dump -U postgres your_database > backup_$(date +%Y%m%d).sql
```

---

### Step 2: Apply RLS Policies Migration

**File:** `database/migrations/002_implement_rls_policies.sql`

This migration:
- Creates authorization helper functions
- Enables Row Level Security on all tables
- Sets up granular access policies
- Grants necessary permissions

#### Via Supabase Dashboard:

1. Open **SQL Editor**
2. Click **New Query**
3. Copy entire contents of `002_implement_rls_policies.sql`
4. Click **Run**
5. Check for errors in output

#### Expected Output:
```sql
ALTER TABLE
ALTER TABLE
CREATE POLICY
CREATE POLICY
...
GRANT
```

#### Verification:

Run this query to verify RLS is enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('teachers', 'ratings', 'profiles', 'feedback', 'teacher_submission_requests');
```

**Expected Result:**
| tablename | rowsecurity |
|-----------|-------------|
| teachers | t (true) |
| ratings | t (true) |
| profiles | t (true) |
| feedback | t (true) |
| teacher_submission_requests | t (true) |

#### Verify Policies Exist:

```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Expected Result:**
| tablename | policy_count |
|-----------|--------------|
| feedback | 4 |
| profiles | 4 |
| ratings | 5 |
| teacher_submission_requests | 4 |
| teachers | 4 |

---

### Step 3: Apply Constraints & Validation Migration

**File:** `database/migrations/003_add_constraints_and_validation.sql`

This migration:
- Adds unique constraints (prevent duplicates)
- Adds check constraints (data validation)
- Creates validation triggers
- Sets up audit logging
- Adds performance indexes

#### Via Supabase Dashboard:

1. Open **SQL Editor**
2. Click **New Query**
3. Copy entire contents of `003_add_constraints_and_validation.sql`
4. Click **Run**
5. Check for errors

#### Expected Output:
```sql
CREATE UNIQUE INDEX
ALTER TABLE
CREATE FUNCTION
CREATE TRIGGER
...
```

#### Verification:

Check constraints exist:

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('teachers'::regclass, 'ratings'::regclass)
AND contype = 'c';
```

Check triggers exist:

```sql
SELECT tgname, tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgrelid IN ('teachers'::regclass, 'ratings'::regclass, 'feedback'::regclass)
AND tgname LIKE 'validate%';
```

---

### Step 4: Assign Admin Roles

**Critical:** After RLS is enabled, you MUST assign admin roles to specific users.

#### Find Your User ID:

1. Log into your application
2. Open browser console
3. Run:
```javascript
console.log((await supabase.auth.getUser()).data.user.id)
```

Or via SQL:

```sql
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at;
```

#### Set Admin Role:

```sql
-- Replace with your actual email
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';

-- Or by user ID
UPDATE profiles
SET role = 'admin'
WHERE id = 'your-user-uuid';
```

#### Verify Admin Status:

```sql
SELECT id, email, role
FROM profiles
WHERE role = 'admin';
```

---

### Step 5: Test Security Setup

#### Test 1: Verify RLS Protection

```sql
-- This should FAIL (non-admin trying to insert)
INSERT INTO teachers (name, institute, designation, city, created_by)
VALUES ('Test Teacher', 'Test Institute', 'Professor', 'Test City', '00000000-0000-0000-0000-000000000000');
```

**Expected:** ERROR: new row violates row-level security policy

#### Test 2: Verify Unique Constraint

```sql
-- Try to create duplicate teacher (should fail)
INSERT INTO teachers (name, institute, designation, city)
VALUES
  ('John Doe', 'Harvard University', 'Professor', 'Cambridge'),
  ('John Doe', 'Harvard University', 'Professor', 'Cambridge');
```

**Expected:** ERROR: duplicate key value violates unique constraint

#### Test 3: Verify Rating Validation

```sql
-- Try invalid rating score (should fail)
INSERT INTO ratings (teacher_id, student_id, score, comment)
VALUES (
  'some-teacher-id',
  'some-student-id',
  6.0,  -- Invalid: max is 5
  'Test comment with enough characters'
);
```

**Expected:** ERROR: new row violates check constraint "check_rating_score_range"

#### Test 4: Verify Profile Email Protection

As a regular (non-admin) user, try:

```sql
SELECT email FROM profiles WHERE id != current_setting('request.jwt.claims.sub')::uuid;
```

**Expected:** Should only return display_name, not email (unless admin)

---

### Step 6: Configure Admin Functions (Optional)

If you want to use the server-side rate limiting:

```sql
-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_time BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX idx_rate_limits_reset_time ON rate_limits(reset_time);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read their own limits
CREATE POLICY "rate_limits_select_own" ON rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can manage rate limits
CREATE POLICY "rate_limits_system_manage" ON rate_limits
  FOR ALL
  USING (current_user = 'service_role');
```

---

## 🔍 Troubleshooting

### Issue: "Permission denied for table X"

**Cause:** User doesn't have required permissions

**Solution:**
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ratings TO authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;
```

### Issue: "Function is_admin() does not exist"

**Cause:** RLS migration (002) not applied correctly

**Solution:**
Re-run migration file `002_implement_rls_policies.sql`

### Issue: "RLS policy prevents operation"

**Cause:** User doesn't have admin role or isn't authorized

**Solution:**
```sql
-- Check user's role
SELECT role FROM profiles WHERE id = auth.uid();

-- Set admin role if needed
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Issue: "Constraint violation" errors

**Cause:** Existing data violates new constraints

**Solution:**
```sql
-- Find problematic data
SELECT * FROM teachers
WHERE length(TRIM(name)) < 2 OR name IS NULL;

-- Fix or remove
UPDATE teachers SET name = TRIM(name) WHERE name != TRIM(name);
DELETE FROM teachers WHERE length(TRIM(name)) < 2;
```

---

## 🔄 Rolling Back (Emergency)

If you need to rollback the security changes:

### Disable RLS (NOT RECOMMENDED):

```sql
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_submission_requests DISABLE ROW LEVEL SECURITY;
```

### Drop Policies:

```sql
-- List all policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Drop specific policy
DROP POLICY "policy_name" ON table_name;
```

### Remove Constraints:

```sql
-- Drop unique constraint
DROP INDEX IF EXISTS idx_unique_teacher;

-- Drop check constraints
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS check_rating_score_range;
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS check_comment_length;
```

---

## ✅ Post-Setup Checklist

After completing setup, verify:

- [ ] RLS enabled on all tables
- [ ] Admin role assigned to at least one user
- [ ] Can login and view data
- [ ] Non-admin users can't modify restricted data
- [ ] Validation triggers working (test with invalid data)
- [ ] Audit log receiving entries
- [ ] Application functions normally

---

## 📊 Monitoring & Maintenance

### Regular Checks

Run these queries weekly:

```sql
-- Check for RLS policy violations
SELECT COUNT(*) as violations
FROM audit_log
WHERE operation = 'SECURITY_VIOLATION'
AND timestamp > NOW() - INTERVAL '7 days';

-- Check audit log growth
SELECT COUNT(*), DATE_TRUNC('day', timestamp) as day
FROM audit_log
GROUP BY day
ORDER BY day DESC
LIMIT 7;

-- Check rate limit violations
SELECT action, COUNT(*) as violations
FROM rate_limits
WHERE count >= (
  SELECT limit FROM rate_limit_config WHERE action = rate_limits.action
)
GROUP BY action;
```

### Cleanup Old Data

```sql
-- Clean up old audit logs (keep 90 days)
DELETE FROM audit_log
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Clean up expired rate limits
DELETE FROM rate_limits
WHERE reset_time < EXTRACT(EPOCH FROM NOW()) * 1000;
```

---

## 📚 Additional Resources

- [SECURITY.md](./SECURITY.md) - Complete security documentation
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)

---

## 🆘 Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review migration file comments
3. Check Supabase logs: Dashboard → Logs
4. Verify user roles: `SELECT * FROM profiles WHERE id = auth.uid();`
5. Test with admin user first

---

## 🎯 Success Criteria

Your setup is successful when:

✅ All migrations run without errors
✅ Admin user can perform all operations
✅ Non-admin users are restricted appropriately
✅ Validation triggers prevent invalid data
✅ Audit log captures admin operations
✅ Application works normally for end users

**Last Updated:** 2025-10-22
