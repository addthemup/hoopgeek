# Admin Panel - 5 Minute Setup

## ✅ Checklist

### Step 1: Run SQL Migrations (2 minutes)

```bash
# Navigate to your project
cd /Users/adam/Desktop/hoopgeek

# Go to Supabase Dashboard → SQL Editor
# Execute these two files in order:
```

**File 1:** `supabase/migrations/create_dfs_system.sql`
- Click "New Query"
- Paste entire contents
- Click "Run"
- ✅ Should see "Success"

**File 2:** `supabase/migrations/create_admin_system.sql`  
- Click "New Query"
- Paste entire contents
- Click "Run"
- ✅ Should see "Success"

### Step 2: Make Yourself Admin (1 minute)

```sql
-- In Supabase SQL Editor, run:

-- 1. Find your user ID
SELECT id, email FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';

-- 2. Copy the ID, then run:
INSERT INTO admin_users (user_id, role, is_active)
VALUES ('PASTE_YOUR_ID_HERE', 'super_admin', TRUE);

-- 3. Verify
SELECT * FROM admin_users WHERE user_id = 'YOUR_ID_HERE';
```

### Step 3: Add Route (1 minute)

Edit `src/App.tsx`:

```typescript
// Add at top with other imports:
import Admin from './pages/Admin'

// Add inside <Route path="/" element={<Layout />}>:
<Route path="admin" element={<Admin />} />
```

**Example location:**
```typescript
<Route path="/" element={<Layout />}>
  <Route index element={<Home />} />
  <Route path="login" element={<Login />} />
  <Route path="dfs" element={<DFS />} />
  <Route path="admin" element={<Admin />} />  {/* ← ADD THIS */}
  // ... rest of routes
</Route>
```

### Step 4: Test (1 minute)

```bash
# Start dev server
npm run dev

# Navigate to:
http://localhost:5173/admin

# Expected:
✅ If you're the admin → See admin dashboard
❌ If not logged in → See "Access Denied"
```

## 🎯 You're Done!

Visit `/admin` to access:
- **Dashboard** - Stats overview
- **DFS Management** - Create/manage pools
- **Content Management** - Write blog posts

## 🔐 Security Features (Already Active)

✅ **Database RLS** - Only your user can access admin tables  
✅ **Role Check** - Verified against admin_users table  
✅ **Audit Logging** - All actions tracked  
✅ **Access Denied UI** - Non-admins see rejection message

## 🚀 Next Steps

### Create Your First DFS Pool
1. Go to `/admin` → DFS tab
2. Click "Detect Slates" (once built)
3. Click "Create Pool"
4. Select template → Done!

### Write Your First Blog Post
1. Go to `/admin` → Blog tab
2. Click "Create Post"
3. Write content → Publish!

## 📖 Full Documentation

- **Complete Security Guide:** `ADMIN_SETUP_SECURE.md`
- **Admin System Guide:** `ADMIN_SYSTEM_GUIDE.md`
- **DFS System Docs:** `supabase/migrations/DFS_SYSTEM_README.md`

---

**Ready to go in 5 minutes! 🚀**

