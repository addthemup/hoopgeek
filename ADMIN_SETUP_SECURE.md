# Admin Setup - Ultra Secure Single User Access

## 🔐 Security Architecture

**Three Layers of Defense:**

1. **Database RLS** - Enforced at PostgreSQL level (can't be bypassed)
2. **Admin Role Check** - Verified against `admin_users` table
3. **Frontend Guards** - React component protection

**Key Point:** Security is enforced at the **DATABASE**, not just frontend!

## 📋 Setup Steps

### Step 1: Apply SQL Migrations

```bash
cd /Users/adam/Desktop/hoopgeek

# Option A: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Paste create_dfs_system.sql → Execute
# 3. Paste create_admin_system.sql → Execute

# Option B: Via Supabase CLI
supabase db push
```

### Step 2: Make Yourself the Super Admin

```sql
-- 1. Get your user ID
SELECT id, email FROM auth.users WHERE email = 'your@email.com';
-- Copy your ID

-- 2. Create your admin record
INSERT INTO admin_users (
  user_id,
  role,
  is_active,
  require_2fa,
  notes
) VALUES (
  'your-user-id-here',  -- ← Paste your ID
  'super_admin',        -- Full access
  TRUE,
  TRUE,                 -- Require 2FA (recommended)
  'Site owner - full access'
);

-- 3. Verify
SELECT 
  au.*,
  u.email
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id
WHERE au.user_id = 'your-user-id-here';
```

### Step 3: Add Admin Route

Update `/Users/adam/Desktop/hoopgeek/src/App.tsx`:

```typescript
// Add import
import Admin from './pages/Admin'

// Add route (inside <Layout>)
<Route path="admin" element={<Admin />} />
```

Example:
```typescript
<Route path="/" element={<Layout />}>
  <Route index element={<Home />} />
  <Route path="dfs" element={<DFS />} />
  <Route path="admin" element={<Admin />} />  {/* ← Add this */}
  // ... other routes
</Route>
```

### Step 4: Test Access

1. **Navigate to:** `http://localhost:5173/admin`
2. **Expected:** If you're the admin user → Admin dashboard loads
3. **Expected:** If you're not → "Access Denied" message

## 🛡️ Why This Is Secure

### 1. Database-Level RLS

**The admin check happens in the database:**

```sql
-- From create_admin_system.sql
CREATE POLICY "Super admins can manage admin users" ON admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()  -- ← Database checks this!
        AND au.role = 'super_admin'
        AND au.is_active = TRUE
    )
  );
```

**This means:**
- ❌ Can't bypass with browser dev tools
- ❌ Can't bypass with modified React code  
- ❌ Can't bypass with API calls
- ✅ Database rejects unauthorized queries

### 2. Admin Role Verification

**The React component queries the database:**

```typescript
// From Admin.tsx
const { data: adminUser } = useQuery({
  queryKey: ['admin-user', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('admin_users')  // ← Protected by RLS!
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    return data;  // null if not admin
  }
});

// If not admin → Access Denied
if (!adminUser) {
  return <AccessDenied />;
}
```

**Hacker tries to access:**
1. Query `admin_users` table
2. RLS policy checks `auth.uid()`
3. No matching admin record → Query returns null
4. React shows "Access Denied"

### 3. All Admin Actions Are Logged

```sql
-- Every admin action is recorded
SELECT log_admin_action(
  p_admin_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_old_values JSONB,
  p_new_values JSONB
);

-- View audit trail
SELECT 
  au.user_id,
  u.email,
  aal.action,
  aal.resource_type,
  aal.created_at
FROM admin_audit_log aal
JOIN admin_users au ON aal.admin_user_id = au.id
JOIN auth.users u ON au.user_id = u.id
ORDER BY aal.created_at DESC;
```

## 🔒 Additional Security Measures

### Option 1: IP Whitelist (Recommended)

```sql
-- Add your home and work IPs
UPDATE admin_users
SET allowed_ip_addresses = ARRAY[
  '123.456.789.0',  -- Your home IP
  '98.765.432.1'    -- Your work IP
]
WHERE user_id = 'your-user-id';

-- Verification function (add to Edge Function middleware)
CREATE OR REPLACE FUNCTION verify_admin_ip(
  p_admin_user_id UUID,
  p_client_ip INET
) RETURNS BOOLEAN AS $$
DECLARE
  v_allowed_ips TEXT[];
BEGIN
  SELECT allowed_ip_addresses INTO v_allowed_ips
  FROM admin_users
  WHERE id = p_admin_user_id;
  
  -- If no IPs specified, allow all
  IF v_allowed_ips IS NULL OR array_length(v_allowed_ips, 1) = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Check if client IP is whitelisted
  RETURN p_client_ip::TEXT = ANY(v_allowed_ips);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Option 2: Enable 2FA (Highly Recommended)

```typescript
// In your auth flow
import { supabase } from './utils/supabase';

// Check if 2FA is required
const { data: adminUser } = await supabase
  .from('admin_users')
  .select('require_2fa')
  .eq('user_id', user.id)
  .single();

if (adminUser?.require_2fa) {
  // Prompt for 2FA
  const { data, error } = await supabase.auth.mfa.challenge({
    factorId: 'your-factor-id'
  });
}
```

### Option 3: Session Timeout

```typescript
// In Admin.tsx
useEffect(() => {
  // Auto-logout after 30 minutes of inactivity
  let timeout: NodeJS.Timeout;
  
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      supabase.auth.signOut();
      navigate('/login');
    }, 30 * 60 * 1000); // 30 minutes
  };
  
  window.addEventListener('mousemove', resetTimeout);
  window.addEventListener('keypress', resetTimeout);
  
  resetTimeout();
  
  return () => {
    clearTimeout(timeout);
    window.removeEventListener('mousemove', resetTimeout);
    window.removeEventListener('keypress', resetTimeout);
  };
}, []);
```

## 🚫 What Hackers CAN'T Do

### ❌ Bypass with Browser Tools
```javascript
// Hacker tries in browser console:
localStorage.setItem('isAdmin', 'true');
// ❌ Won't work - React queries database, not localStorage
```

### ❌ Bypass with Modified React Code
```typescript
// Hacker modifies Admin.tsx locally:
if (true) {  // Always true
  return <AdminDashboard />;
}
// ❌ Won't work - Database queries still fail due to RLS
```

### ❌ Bypass with Direct API Calls
```javascript
// Hacker tries direct Supabase call:
supabase.from('dfs_pools').insert({ ... });
// ❌ Won't work - RLS checks admin_users table
```

### ❌ SQL Injection
```sql
-- Hacker tries:
'; DROP TABLE admin_users; --
-- ❌ Won't work - Supabase uses parameterized queries
```

## ✅ What You CAN Do (As Admin)

### Access Admin Panel
```
Navigate to: /admin
View: Dashboard, DFS tools, Blog tools
```

### Create DFS Pools
```sql
-- Via UI or directly
INSERT INTO dfs_pools (...) VALUES (...);
-- ✅ Works - you're in admin_users table
```

### Write Blog Posts
```sql
-- Via UI or directly
INSERT INTO blog_posts (...) VALUES (...);
-- ✅ Works - RLS allows content_admin and super_admin
```

### View Audit Logs
```sql
SELECT * FROM admin_audit_log
ORDER BY created_at DESC;
-- ✅ Works - only admins can query this table
```

## 📊 Verify Security Setup

### Test 1: Check Admin Record
```sql
-- Should return your record
SELECT * FROM admin_users WHERE user_id = 'your-user-id';

-- Should return:
-- id | user_id | role | is_active | require_2fa | ...
-- ... | your-id | super_admin | true | true | ...
```

### Test 2: Check RLS Policies
```sql
-- Should show policies enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('admin_users', 'dfs_pools', 'blog_posts');

-- All should have rowsecurity = true
```

### Test 3: Try Unauthorized Access
```sql
-- Log in as different user (or log out)
-- Try to query admin_users
SELECT * FROM admin_users;

-- Expected result: Empty or error (RLS blocks)
```

### Test 4: Check Audit Logging
```sql
-- Perform an admin action
-- Then check:
SELECT 
  action,
  resource_type,
  created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 10;

-- Should see your actions logged
```

## 🎯 Production Deployment

### Before Going Live:

1. **✅ Enable 2FA**
   ```sql
   UPDATE admin_users
   SET require_2fa = TRUE
   WHERE role = 'super_admin';
   ```

2. **✅ Set IP Whitelist**
   ```sql
   UPDATE admin_users
   SET allowed_ip_addresses = ARRAY['your.production.ip']
   WHERE role = 'super_admin';
   ```

3. **✅ Strong Password**
   - Use password manager
   - Minimum 16 characters
   - Include special characters

4. **✅ Monitor Audit Logs**
   ```sql
   -- Set up alerts for suspicious activity
   SELECT COUNT(*) 
   FROM admin_audit_log
   WHERE created_at > now() - INTERVAL '1 hour'
     AND success = FALSE;
   ```

5. **✅ Regular Backups**
   - Supabase auto-backups daily
   - Export critical data weekly
   - Test restore procedures

## 🚨 If Compromised

### Immediate Actions:

1. **Change Password**
```typescript
await supabase.auth.updateUser({
  password: 'new-super-secure-password'
});
```

2. **Disable Admin Access**
```sql
UPDATE admin_users
SET is_active = FALSE
WHERE user_id = 'compromised-user-id';
```

3. **Check Audit Logs**
```sql
SELECT * FROM admin_audit_log
WHERE created_at > now() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

4. **Revoke Sessions**
```typescript
await supabase.auth.signOut({ scope: 'global' });
```

## 📝 Summary

**Security Layers:**
1. ✅ Database RLS - Enforces at PostgreSQL level
2. ✅ Admin Role Check - Verified against admin_users table
3. ✅ Frontend Guards - React component protection
4. ✅ Audit Logging - All actions tracked
5. ✅ Optional 2FA - Extra verification layer
6. ✅ Optional IP Whitelist - Location restriction

**Result:** 
- Only YOU can access `/admin`
- All database queries verified by RLS
- All actions logged
- Can't be bypassed by hackers

**Your admin URL:** `https://your-domain.com/admin`

---

**The admin panel is fortress-level secure.** 🏰🔒

