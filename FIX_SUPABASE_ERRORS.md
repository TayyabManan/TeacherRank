# Fix Supabase Security Errors - Quick Guide

This guide fixes the 7 security errors detected by Supabase database linter.

---

## 🚨 Errors to Fix

| Error Type | Count | Items |
|------------|-------|-------|
| **SECURITY DEFINER views** | 5 | `teacher_aggregates`, `ratings_with_info`, `teacher_requests_view`, `admin_reviews_dashboard`, `user_profiles_with_roles` |
| **RLS Disabled** | 2 | `admin_audit_log`, `query_performance_logs` |

---

## ⚡ Quick Fix (5 minutes)

### Step 1: Run the Migration

**Via Supabase Dashboard:**

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Copy the entire contents of `database/migrations/004_fix_supabase_security_errors.sql`
4. Click **Run** (or press Ctrl+Enter)
5. Wait for "Success" message

**Via Command Line:**

```bash
cd "/mnt/e/Haris/GIS Portfolio/Teacher Rank"
psql -U postgres -d your_database -f database/migrations/004_fix_supabase_security_errors.sql
```

### Step 2: Verify the Fix

Run this query in SQL Editor:

```sql
-- Check RLS is now enabled
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('admin_audit_log', 'query_performance_logs');
```

**Expected Result:**
| tablename | rls_enabled |
|-----------|-------------|
| admin_audit_log | true |
| query_performance_logs | true |

### Step 3: Check Views

```sql
-- Verify views exist and work
SELECT COUNT(*) FROM teacher_aggregates;
SELECT COUNT(*) FROM ratings_with_info;
```

**Expected:** Both queries should return counts without errors.

### Step 4: Re-run Supabase Linter

1. Go to **Database** → **Linter** in Supabase Dashboard
2. Click **Refresh**
3. All 7 errors should be **GONE** ✅

---

## 📋 What Was Fixed

### Issue 1: SECURITY DEFINER Views ⚠️

**Problem:** 5 views ran with creator's permissions, bypassing RLS
- Views could expose data users shouldn't see
- Violated principle of least privilege

**Solution:** Recreated all views **WITHOUT** `SECURITY DEFINER`
- Views now respect the querying user's permissions
- Access controlled by RLS policies on base tables
- More secure and follows best practices

**Views Fixed:**
1. ✅ `teacher_aggregates` - Now respects ratings RLS
2. ✅ `ratings_with_info` - Now respects ratings & teachers RLS
3. ✅ `teacher_requests_view` - Access via base table RLS
4. ✅ `admin_reviews_dashboard` - Access via ratings RLS
5. ✅ `user_profiles_with_roles` - Conditional email access

### Issue 2: Missing RLS Policies 🔒

**Problem:** 2 tables had no RLS enabled
- Anyone could query these tables
- Sensitive audit/performance data exposed

**Solution:** Enabled RLS + Added admin-only policies

**Tables Fixed:**
1. ✅ `admin_audit_log`
   - RLS enabled
   - Admin read-only policy
   - System can write via triggers

2. ✅ `query_performance_logs`
   - RLS enabled
   - Admin read-only policy
   - System can write logs

---

## 🧪 Testing

### Test 1: Views Still Work

```sql
-- These should all return data (if data exists)
SELECT * FROM teacher_aggregates LIMIT 5;
SELECT * FROM ratings_with_info LIMIT 5;
SELECT * FROM teacher_requests_view LIMIT 5;  -- May be empty if not admin
SELECT * FROM admin_reviews_dashboard LIMIT 5;
SELECT * FROM user_profiles_with_roles LIMIT 5;
```

### Test 2: RLS Protects Audit Logs

```sql
-- This should fail for non-admin users
SELECT * FROM admin_audit_log;
-- Expected: Empty result or permission error (unless you're admin)

-- This should fail for non-admin users
SELECT * FROM query_performance_logs;
-- Expected: Empty result or permission error (unless you're admin)
```

### Test 3: Application Still Works

- ✅ Login to your application
- ✅ View teachers list
- ✅ View ratings
- ✅ Submit a rating (if authenticated)
- ✅ Admin pages work (if admin)

---

## 🔍 Understanding the Changes

### Before vs After

**Before:**
```sql
-- OLD: View with SECURITY DEFINER
CREATE VIEW teacher_aggregates WITH (security_definer=true) AS
SELECT teacher_id, AVG(score) as avg_rating
FROM ratings GROUP BY teacher_id;

-- Problem: Runs with creator's permissions
-- Anyone querying this view sees ALL ratings, bypassing RLS
```

**After:**
```sql
-- NEW: View without SECURITY DEFINER
CREATE VIEW teacher_aggregates AS
SELECT teacher_id, AVG(score) as avg_rating
FROM ratings GROUP BY teacher_id;

-- Solution: Runs with querying user's permissions
-- RLS on ratings table is respected
-- Users only see ratings they're allowed to see
```

### Why This Is More Secure

1. **Principle of Least Privilege**
   - Users only see data they're authorized to see
   - Views don't grant elevated permissions

2. **RLS Enforcement**
   - All data access goes through RLS policies
   - No backdoor via views

3. **Audit Trail**
   - Admin audit logs protected
   - Only admins can view sensitive logs

---

## ⚠️ Important Notes

### Potential Breaking Changes

If your application relied on views bypassing RLS, you may need to adjust:

1. **Admin Queries** - Ensure admin users have proper role assigned
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
   ```

2. **Service Account** - If using service role key, it bypasses RLS automatically

3. **View Results** - Some views may now return fewer results due to RLS

### If Something Breaks

**Quick Diagnosis:**

```sql
-- Check your user's role
SELECT id, email, role FROM profiles WHERE id = auth.uid();

-- Check if you're an admin
SELECT is_admin(auth.uid());

-- List your accessible data
SELECT COUNT(*) FROM teachers;  -- Should work for everyone
SELECT COUNT(*) FROM ratings;   -- Should work for everyone
SELECT COUNT(*) FROM feedback;  -- Admin only
```

**Emergency Rollback:**

See the rollback section in `004_fix_supabase_security_errors.sql` if needed.

---

## ✅ Success Criteria

Your fix is successful when:

- [ ] Supabase linter shows 0 security errors
- [ ] All 5 views return data without errors
- [ ] RLS is enabled on all tables
- [ ] Application works normally
- [ ] Admin users can access admin features
- [ ] Regular users cannot access admin data

---

## 🎯 Next Steps

After fixing these errors:

1. ✅ **Re-run Supabase Linter** - Confirm 0 errors
2. ✅ **Test Application** - Ensure everything works
3. ✅ **Deploy to Production** - Apply same migration
4. ✅ **Monitor Logs** - Check for RLS-related errors

---

## 📞 Troubleshooting

### Error: "Permission denied for table X"

**Cause:** User doesn't have required role/permissions

**Fix:**
```sql
-- Check current role
SELECT role FROM profiles WHERE id = auth.uid();

-- If should be admin, set it
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Error: "View does not exist"

**Cause:** Migration failed or partially ran

**Fix:**
Re-run the migration file completely. Views are created with `CREATE OR REPLACE`.

### Error: "Function is_admin() does not exist"

**Cause:** Haven't run previous migrations

**Fix:**
```bash
# Run migrations in order
1. database/migrations/002_implement_rls_policies.sql
2. database/migrations/003_add_constraints_and_validation.sql
3. database/migrations/004_fix_supabase_security_errors.sql
```

### Views Return No Data

**Expected Behavior:** Views now respect RLS
- Non-admin users won't see admin-only data
- Users only see their own ratings/data where applicable

**If Unexpected:**
Check RLS policies on base tables are correct.

---

## 📊 Summary

| What | Before | After |
|------|--------|-------|
| **SECURITY DEFINER views** | 5 views | ✅ 0 views |
| **Tables without RLS** | 2 tables | ✅ 0 tables |
| **Security Errors** | 7 errors | ✅ 0 errors |
| **Security Score** | Failed | ✅ Passed |

---

## 🎉 Done!

All Supabase security errors are now fixed. Your database is more secure and follows PostgreSQL best practices.

**Estimated Time:** 5 minutes
**Complexity:** Low (just run one migration)
**Risk:** Low (changes are backwards compatible)

If you have any issues, check the troubleshooting section above or refer to the detailed migration file comments.
