# Admin System - Complete Guide

## 🎯 Overview

A **production-ready admin system** for managing:
- ✅ **DFS Pools** - Create/manage contests
- ✅ **Blog Content** - Homepage news & articles
- ✅ **User Management** - Admin roles & permissions
- ✅ **Audit Logging** - Track all admin actions

## 🏗️ How DraftKings Creates Pools (The Truth)

### They DO Use Algorithms! 

**The Reality:**
1. **Automated Slate Detection** - Scans schedule, groups games
2. **Template System** - Pre-built contest types (GPP, H2H, Double-Up)
3. **Auto-Generation** - Creates pools based on templates + slates
4. **Manual Oversight** - Admins approve/edit before publishing

**Why It Works:**
- Games have patterns (Main Slate, Early, Late)
- Contest types are repetitive (same prize structures)
- Entry limits based on historical data
- Prize pools calculated automatically

**What's Manual:**
- Featured contests
- Special promotions
- Adjusting caps for playoff games
- Marketing-driven unique contests

## 🛡️ Security Strategy

### ❌ NOT Localhost Only

**Why NOT localhost:**
- Can't manage from phone/other locations
- Hard to collaborate with team
- Not scalable
- Still need auth even on localhost

### ✅ BETTER: Role-Based Access Control (RBAC)

**Our Approach:**
1. **Admin Roles** - Different permission levels
2. **RLS Policies** - Database-level security
3. **Audit Logging** - Track every action
4. **Optional IP Whitelist** - For extra security
5. **2FA Required** - For sensitive roles

## 📊 Admin Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| **super_admin** | Full access | You, CTO |
| **dfs_admin** | Create/edit pools | DFS manager |
| **content_admin** | Blog posts | Content writer |
| **support_admin** | View user data | Customer support |
| **readonly_admin** | View only | Analysts, interns |

## 🚀 Quick Start

### 1. Apply Migration

```bash
# Copy SQL to Supabase SQL Editor
# Or via CLI:
supabase db push
```

### 2. Make Yourself Super Admin

```sql
-- Get your user ID
SELECT id, email FROM auth.users WHERE email = 'your@email.com';

-- Create admin user
INSERT INTO admin_users (user_id, role, is_active)
VALUES ('your-user-id', 'super_admin', TRUE);
```

### 3. Verify Access

```sql
-- Check your admin status
SELECT 
  au.*,
  u.email
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id
WHERE au.user_id = auth.uid();
```

## 📝 Creating Blog Posts

### Method 1: SQL (Quick & Direct)

```sql
-- Create a blog post
INSERT INTO blog_posts (
  title,
  slug,
  excerpt,
  content,
  author_id,
  author_name,
  status,
  published_at,
  is_featured,
  is_breaking_news
) VALUES (
  'Lakers Dominate Warriors in Season Opener',
  'lakers-dominate-warriors-season-opener',
  'LeBron James scores 35 points as Lakers cruise to victory in NBA season opener.',
  '# Lakers Dominate Warriors

LeBron James turned back the clock with a vintage performance...

## Key Stats
- LeBron: 35 points, 8 rebounds, 7 assists
- AD: 28 points, 12 rebounds
- Lakers shot 52% from the field

The Lakers look like championship contenders...',
  auth.uid(), -- Your user ID
  'HoopGeek Staff',
  'published',
  now(),
  TRUE, -- Featured on homepage
  TRUE  -- Breaking news banner
);
```

### Method 2: Admin UI (Recommended)

You'll build admin components that call these:

```typescript
// hooks/useCreateBlogPost.ts
export function useCreateBlogPost() {
  return useMutation({
    mutationFn: async (post: BlogPostInput) => {
      const { data, error } = await supabase
        .from('blog_posts')
        .insert({
          title: post.title,
          slug: generateSlug(post.title),
          excerpt: post.excerpt,
          content: post.content,
          author_id: user.id,
          author_name: user.email,
          status: 'draft',
          category_id: post.categoryId,
          tags: post.tags
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_admin_user_id: adminUser.id,
        p_action: 'create_blog_post',
        p_resource_type: 'blog_post',
        p_resource_id: data.id,
        p_new_values: data
      });
      
      return data;
    }
  });
}
```

## 🎮 Creating DFS Pools

### Method 1: Auto-Detect Slates (Recommended)

```sql
-- Run slate detection for tomorrow
SELECT * FROM detect_daily_slates('2025-10-27');

-- Results show:
-- Main Slate: 8 games, 7:00 PM - 10:30 PM
-- Early Slate: 3 games, 1:00 PM - 4:00 PM  
-- Late Slate: 5 games, 9:00 PM - 11:30 PM

-- Save detected slates for approval
INSERT INTO dfs_detected_slates (slate_date, slate_name, game_count, game_ids, start_time, end_time)
SELECT 
  '2025-10-27',
  slate_name,
  game_count,
  game_ids,
  start_time,
  end_time
FROM detect_daily_slates('2025-10-27');
```

### Method 2: Use Templates

```sql
-- View available templates
SELECT * FROM dfs_pool_templates WHERE is_active = TRUE;

-- Create pool from template
SELECT create_pool_from_template(
  'template-id',           -- Template to use
  '2025-10-27',           -- Slate date
  'Main Slate',           -- Slate name
  'your-admin-user-id',   -- Your admin ID
  NULL                    -- Custom name (optional)
);

-- Returns the new pool ID
-- Pool is created in 'draft' status for review
```

### Method 3: Manual Creation (Full Control)

```sql
-- Create custom pool
INSERT INTO dfs_pools (
  name,
  description,
  slate_name,
  slate_date,
  start_time,
  lock_time,
  entry_fee,
  max_entries,
  max_entries_per_user,
  prize_pool,
  is_guaranteed,
  salary_cap,
  difficulty_tier,
  status,
  created_by
) VALUES (
  'Sunday Night Special - $100K Guaranteed',
  'Huge GPP for Sunday primetime games',
  'Main Slate',
  '2025-10-27',
  '2025-10-27 19:00:00+00',
  '2025-10-27 19:00:00+00',
  25.00,        -- $25 entry
  5000,         -- Max 5000 entries
  150,          -- Max 150 per user
  100000.00,    -- $100K guaranteed
  TRUE,
  207800000,    -- Standard difficulty
  'standard',
  'draft',      -- Review before publishing
  auth.uid()
) RETURNING id;
```

### Add Games to Pool

```sql
-- Add all games from detected slate
INSERT INTO dfs_pool_games (pool_id, game_id, game_date, home_team, away_team)
SELECT 
  'your-pool-id',
  game_id,
  game_date,
  home_team_tricode,
  away_team_tricode
FROM nba_games
WHERE game_id = ANY(
  SELECT unnest(game_ids) 
  FROM dfs_detected_slates 
  WHERE slate_date = '2025-10-27' AND slate_name = 'Main Slate'
);
```

### Set Player Salaries

```sql
-- Generate salaries based on projections
-- (You'll refine this algorithm over time)
INSERT INTO dfs_player_salaries (
  pool_id,
  player_id,
  nba_player_id,
  player_name,
  player_team,
  player_position,
  salary,
  projected_points
)
SELECT 
  'your-pool-id',
  p.id,
  p.nba_player_id,
  p.name,
  p.team_abbreviation,
  p.position,
  -- Simple salary algorithm (refine this!)
  CASE 
    -- Stars (35+ FP avg)
    WHEN p.name IN ('LeBron James', 'Stephen Curry', 'Giannis Antetokounmpo', 'Nikola Jokic')
      THEN 11500000
    -- All-Stars (25-35 FP avg)
    WHEN p.name IN ('Jayson Tatum', 'Anthony Davis', 'Luka Doncic')
      THEN 9500000
    -- Starters (18-25 FP avg)
    WHEN p.position IN ('Guard', 'Forward', 'Center')
      THEN 7000000
    -- Role players (12-18 FP avg)
    ELSE 5000000
  END as salary,
  -- You'll calculate real projections from historical data
  30.0 as projected_points
FROM nba_players p
WHERE p.team_abbreviation IN (
  SELECT DISTINCT unnest(ARRAY[home_team, away_team])
  FROM dfs_pool_games
  WHERE pool_id = 'your-pool-id'
)
  AND p.is_active = TRUE;
```

### Publish Pool

```sql
-- Review pool, then publish
UPDATE dfs_pools
SET 
  status = 'scheduled',
  updated_at = now()
WHERE id = 'your-pool-id';

-- Log action
SELECT log_admin_action(
  'your-admin-user-id',
  'publish_pool',
  'dfs_pool',
  'your-pool-id'
);
```

## 🤖 Automation Strategy

### Daily Routine (Can be automated)

**Every Morning at 9 AM ET:**

```sql
-- 1. Detect tomorrow's slates
INSERT INTO dfs_detected_slates (...)
SELECT * FROM detect_daily_slates(CURRENT_DATE + 1);

-- 2. Auto-create pools from templates for approved slates
WITH approved_slates AS (
  SELECT * FROM dfs_detected_slates
  WHERE is_approved = TRUE 
    AND pools_created = FALSE
    AND slate_date = CURRENT_DATE + 1
)
INSERT INTO dfs_pools (...)
SELECT create_pool_from_template(
  (SELECT id FROM dfs_pool_templates WHERE template_type = 'daily_standard' LIMIT 1),
  slate_date,
  slate_name,
  (SELECT id FROM admin_users WHERE role = 'super_admin' LIMIT 1)
) FROM approved_slates;

-- 3. Generate player salaries
-- (Run salary calculation algorithm)

-- 4. Send notification for admin review
```

### What You Manually Review:

1. **Slate Detection Results** - Approve/reject detected slates
2. **Generated Pools** - Check entry fees, prize pools
3. **Player Salaries** - Spot check for outliers
4. **Featured Contests** - Manually create special promotions

### Edge Function for Automation

```typescript
// supabase/functions/daily-dfs-setup/index.ts
export default async function handler(req: Request) {
  // Verify admin auth
  const adminUser = await verifyAdminAuth(req);
  
  // 1. Detect slates
  const slates = await detectSlates(tomorrow);
  
  // 2. Create pools from templates
  const pools = await createPoolsFromSlates(slates);
  
  // 3. Generate salaries
  await generatePlayerSalaries(pools);
  
  // 4. Send admin review notification
  await notifyAdmins(pools);
  
  return new Response(JSON.stringify({
    slates: slates.length,
    pools: pools.length,
    status: 'pending_review'
  }));
}
```

## 🎨 Admin UI Structure

### Recommended Pages

```
/admin
  /dashboard          - Overview, stats
  /dfs
    /slates          - Review detected slates
    /pools           - Manage pools
      /create        - Create new pool
      /[id]          - Edit pool
    /templates       - Manage templates
    /salaries        - Review/adjust salaries
  /content
    /posts           - Blog posts list
      /create        - Write new post
      /[id]/edit     - Edit post
    /categories      - Manage categories
  /users
    /admins          - Manage admin users
    /audit           - View audit log
  /settings          - System settings
```

### Example Admin Component

```typescript
// pages/admin/dfs/CreatePool.tsx
export default function CreatePool() {
  const { data: templates } = useQuery({
    queryKey: ['dfs-templates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dfs_pool_templates')
        .select('*')
        .eq('is_active', true);
      return data;
    }
  });
  
  const { data: slates } = useQuery({
    queryKey: ['detected-slates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dfs_detected_slates')
        .select('*')
        .eq('is_approved', true)
        .eq('pools_created', false)
        .gte('slate_date', new Date().toISOString().split('T')[0]);
      return data;
    }
  });
  
  const createPool = useMutation({
    mutationFn: async ({ templateId, slateId }) => {
      const slate = slates.find(s => s.id === slateId);
      
      const { data } = await supabase.rpc('create_pool_from_template', {
        p_template_id: templateId,
        p_slate_date: slate.slate_date,
        p_slate_name: slate.slate_name,
        p_admin_user_id: adminUser.id
      });
      
      return data;
    }
  });
  
  return (
    <Box>
      <Typography level="h2">Create DFS Pool</Typography>
      
      {/* Step 1: Select Slate */}
      <Card>
        <Typography level="h4">1. Select Slate</Typography>
        {slates?.map(slate => (
          <Button key={slate.id} onClick={() => setSelectedSlate(slate)}>
            {slate.slate_name} - {slate.game_count} games
          </Button>
        ))}
      </Card>
      
      {/* Step 2: Select Template */}
      <Card>
        <Typography level="h4">2. Select Contest Type</Typography>
        {templates?.map(template => (
          <Button key={template.id} onClick={() => setSelectedTemplate(template)}>
            {template.name} - ${template.default_entry_fee}
          </Button>
        ))}
      </Card>
      
      {/* Step 3: Review & Create */}
      <Card>
        <Typography level="h4">3. Review & Create</Typography>
        <Button onClick={() => createPool.mutate({
          templateId: selectedTemplate.id,
          slateId: selectedSlate.id
        })}>
          Create Pool
        </Button>
      </Card>
    </Box>
  );
}
```

## 🔐 Security Best Practices

### 1. IP Whitelist (Optional)

```sql
-- Add your IP addresses
UPDATE admin_users
SET allowed_ip_addresses = ARRAY['your.home.ip', 'your.office.ip']
WHERE user_id = auth.uid();

-- Verify IP in middleware
CREATE OR REPLACE FUNCTION verify_admin_ip()
RETURNS BOOLEAN AS $$
DECLARE
  v_allowed_ips TEXT[];
  v_client_ip TEXT;
BEGIN
  SELECT allowed_ip_addresses INTO v_allowed_ips
  FROM admin_users
  WHERE user_id = auth.uid() AND is_active = TRUE;
  
  -- If no IPs specified, allow all
  IF v_allowed_ips IS NULL OR array_length(v_allowed_ips, 1) = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Get client IP (you'd pass this as parameter)
  -- v_client_ip := current_setting('request.headers')::json->>'x-real-ip';
  
  -- Check if IP is in whitelist
  RETURN v_client_ip = ANY(v_allowed_ips);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Require 2FA

```typescript
// middleware/adminAuth.ts
export async function requireAdmin(req: Request) {
  const session = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single();
  
  if (!adminUser) throw new Error('Not an admin');
  
  // Check 2FA if required
  if (adminUser.require_2fa && !session.factors?.length) {
    throw new Error('2FA required');
  }
  
  // Log login
  await supabase
    .from('admin_users')
    .update({
      last_login_at: new Date().toISOString(),
      login_count: adminUser.login_count + 1
    })
    .eq('id', adminUser.id);
  
  return adminUser;
}
```

### 3. Audit Everything

```typescript
// Every admin action should be logged
async function updatePool(poolId: string, updates: any) {
  const oldPool = await getPool(poolId);
  
  await supabase.from('dfs_pools').update(updates).eq('id', poolId);
  
  // Log the change
  await supabase.rpc('log_admin_action', {
    p_admin_user_id: adminUser.id,
    p_action: 'update_pool',
    p_resource_type: 'dfs_pool',
    p_resource_id: poolId,
    p_old_values: oldPool,
    p_new_values: updates,
    p_ip_address: req.headers.get('x-real-ip')
  });
}
```

## 📊 Monitoring & Analytics

```sql
-- Admin activity dashboard
SELECT 
  au.user_id,
  u.email,
  au.role,
  COUNT(aal.id) as actions_today,
  au.last_login_at
FROM admin_users au
LEFT JOIN auth.users u ON au.user_id = u.id
LEFT JOIN admin_audit_log aal ON aal.admin_user_id = au.id 
  AND aal.created_at::date = CURRENT_DATE
WHERE au.is_active = TRUE
GROUP BY au.id, u.email;

-- Pool creation stats
SELECT 
  DATE(created_at) as date,
  COUNT(*) as pools_created,
  SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as published,
  SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts
FROM dfs_pools
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## ✅ Summary

**Your Admin Workflow:**
1. ☕ **Morning** - Review auto-detected slates
2. 🎯 **Create** - Use templates to generate pools in seconds
3. 💰 **Review** - Check salaries, adjust if needed
4. 🚀 **Publish** - Push live to users
5. 📊 **Monitor** - Track entries, adjust caps
6. ✍️ **Content** - Write blog posts as news happens

**Security:**
- ✅ Role-based access
- ✅ RLS policies
- ✅ Audit logging
- ✅ 2FA support
- ✅ Optional IP whitelist

**Automation:**
- ✅ Slate detection
- ✅ Template-based creation
- ✅ Salary generation framework
- ✅ Edge function ready

**And YES - I fixed all the foreign keys!** ✅

---

**You're ready to run a professional DFS operation!** 🚀

