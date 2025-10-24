# 🏀 Waiver System Implementation Guide

This directory contains SQL files to implement a comprehensive waiver system for your fantasy basketball leagues.

---

## 📋 **Files Overview**

| File | Purpose | Must Run? |
|------|---------|-----------|
| `create_waiver_system.sql` | Creates tables, indexes, RLS policies | ✅ **Required** |
| `waiver_system_functions.sql` | Creates database functions for waiver operations | ✅ **Required** |
| `waiver_system_verification.sql` | Verification queries & testing utilities | ⚠️ **Optional** (but recommended) |

---

## 🚀 **Installation Steps**

### **Step 1: Review the SQL Files**

Before running anything, open each SQL file and review:
- ✅ Check that table names don't conflict with existing tables
- ✅ Verify column additions won't break existing queries
- ✅ Understand what each function does

### **Step 2: Run `create_waiver_system.sql`**

This creates the foundation of the waiver system:

```sql
-- In Supabase SQL Editor or psql:
\i /path/to/create_waiver_system.sql
```

**What it does:**
1. Adds 7 new columns to `fantasy_league_seasons` table
2. Creates 3 new tables:
   - `fantasy_waiver_order` (tracks priority/budget per team)
   - `fantasy_waiver_claims` (tracks all waiver claims)
   - `fantasy_players_on_waivers` (tracks dropped players)
3. Creates indexes for performance
4. Sets up Row Level Security (RLS) policies
5. Creates triggers for `updated_at` timestamps

**⚠️ Important:** This modifies the `fantasy_league_seasons` table!

### **Step 3: Run `waiver_system_functions.sql`**

This creates the database functions you'll call from your app:

```sql
\i /path/to/waiver_system_functions.sql
```

**What it does:**
Creates 6 PostgreSQL functions:
1. `initialize_waiver_order()` - Sets up waiver priorities for a season
2. `drop_player()` - Drops a player and puts them on waivers
3. `submit_waiver_claim()` - Submits a waiver claim for a player
4. `get_available_players_for_league()` - Gets all claimable players
5. `get_team_pending_claims()` - Gets a team's pending claims
6. `cancel_waiver_claim()` - Cancels a pending claim

### **Step 4: Verify Installation** (Optional but Recommended)

Run the verification queries from `waiver_system_verification.sql`:

```sql
-- Check if columns were added
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'fantasy_league_seasons'
AND column_name LIKE 'waiver%';

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables
WHERE table_name IN ('fantasy_waiver_order', 'fantasy_waiver_claims', 'fantasy_players_on_waivers');

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines
WHERE routine_name LIKE '%waiver%';
```

Expected output: You should see 7 columns, 3 tables, and 6 functions.

---

## 🎯 **Waiver Types Supported**

### **1. No Waivers (Free Agents)**
- **How it works:** Dropped players immediately become free agents
- **Best for:** Casual leagues, fast-paced leagues
- **Settings:**
  ```json
  {
    "waiver_type": "none",
    "waiver_period_hours": 0
  }
  ```

### **2. Rolling Waivers** (Most Common)
- **How it works:** Priority based on inverse standings; resets after each claim
- **Best for:** Most standard leagues
- **Settings:**
  ```json
  {
    "waiver_type": "rolling",
    "waiver_period_hours": 48,
    "waiver_priority_reset": "after_claim",
    "waiver_claim_days": ["Tuesday", "Thursday", "Saturday"]
  }
  ```

### **3. FAAB (Free Agent Acquisition Budget)** (Competitive)
- **How it works:** Each team gets a budget ($100-$1000); blind bidding on players
- **Best for:** Competitive leagues, experienced players
- **Settings:**
  ```json
  {
    "waiver_type": "faab",
    "waiver_period_hours": 48,
    "waiver_budget_amount": 100,
    "waiver_min_bid": 0,
    "waiver_claim_days": ["Wednesday", "Sunday"]
  }
  ```

### **4. Continuous Waivers** (Classic)
- **How it works:** Fixed priority (draft order or inverse standings); doesn't reset
- **Best for:** Traditional leagues, keeper leagues
- **Settings:**
  ```json
  {
    "waiver_type": "continuous",
    "waiver_period_hours": 48,
    "waiver_priority_reset": "never",
    "waiver_claim_days": ["Tuesday", "Thursday", "Saturday"]
  }
  ```

---

## 💾 **Database Schema Changes**

### **New Columns in `fantasy_league_seasons`:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `waiver_type` | TEXT | 'rolling' | Type of waiver system (none, rolling, faab, continuous) |
| `waiver_period_hours` | INTEGER | 48 | Hours a player stays on waivers |
| `waiver_process_time` | TIME | '03:00:00' | Daily time waivers process |
| `waiver_budget_amount` | INTEGER | 100 | Total FAAB budget per team |
| `waiver_min_bid` | INTEGER | 0 | Minimum FAAB bid |
| `waiver_priority_reset` | TEXT | 'weekly' | How often priority resets |
| `waiver_claim_days` | TEXT[] | ['Tue','Thu','Sat'] | Days waivers process |

### **New Tables:**

#### `fantasy_waiver_order`
Tracks each team's waiver priority or remaining FAAB budget.

#### `fantasy_waiver_claims`
Tracks all waiver claims (pending, successful, failed).

#### `fantasy_players_on_waivers`
Tracks which players are currently on waivers.

---

## 🔧 **How to Use in Your App**

### **1. When Creating a League:**

Add waiver settings to your league creation form:

```typescript
const defaultWaiverSettings = {
  waiver_type: 'rolling',
  waiver_period_hours: 48,
  waiver_process_time: '03:00:00',
  waiver_budget_amount: 100,
  waiver_min_bid: 0,
  waiver_priority_reset: 'after_claim',
  waiver_claim_days: ['Tuesday', 'Thursday', 'Saturday']
};
```

### **2. After Draft Completes:**

Initialize waiver order:

```typescript
const { data, error } = await supabase.rpc('initialize_waiver_order', {
  league_id_param: leagueId,
  season_id_param: seasonId
});
```

### **3. When Dropping a Player:**

```typescript
const { data, error } = await supabase.rpc('drop_player', {
  league_id_param: leagueId,
  season_id_param: seasonId,
  fantasy_team_id_param: teamId,
  player_id_param: playerId,
  user_id_param: userId,
  notes_param: 'User dropped player'
});
```

### **4. When Claiming a Player:**

```typescript
const { data, error } = await supabase.rpc('submit_waiver_claim', {
  league_id_param: leagueId,
  season_id_param: seasonId,
  fantasy_team_id_param: teamId,
  player_id_param: playerId,
  drop_player_id_param: dropPlayerId, // Optional
  bid_amount_param: bidAmount // Required for FAAB
});
```

### **5. Get Available Players:**

```typescript
const { data, error } = await supabase.rpc('get_available_players_for_league', {
  league_id_param: leagueId,
  season_id_param: seasonId
});
```

---

## 🧪 **Testing the System**

Use the sample test scenario in `waiver_system_verification.sql`:

1. Create a test league
2. Initialize waiver order
3. Drop a player
4. Submit a waiver claim
5. View pending claims
6. Cancel a claim (optional)

---

## 🔄 **Rollback Instructions**

If something goes wrong, you can rollback using the queries at the bottom of `waiver_system_verification.sql`:

```sql
-- ⚠️ WARNING: This will delete all waiver data!

DROP TABLE IF EXISTS fantasy_waiver_claims CASCADE;
DROP TABLE IF EXISTS fantasy_players_on_waivers CASCADE;
DROP TABLE IF EXISTS fantasy_waiver_order CASCADE;

DROP FUNCTION IF EXISTS initialize_waiver_order(UUID, UUID);
DROP FUNCTION IF EXISTS drop_player(UUID, UUID, UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS submit_waiver_claim(UUID, UUID, UUID, UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS get_available_players_for_league(UUID, UUID);
DROP FUNCTION IF EXISTS get_team_pending_claims(UUID);
DROP FUNCTION IF EXISTS cancel_waiver_claim(UUID, UUID);

ALTER TABLE fantasy_league_seasons
DROP COLUMN IF EXISTS waiver_type,
DROP COLUMN IF EXISTS waiver_period_hours,
DROP COLUMN IF EXISTS waiver_process_time,
DROP COLUMN IF EXISTS waiver_budget_amount,
DROP COLUMN IF EXISTS waiver_min_bid,
DROP COLUMN IF EXISTS waiver_priority_reset,
DROP COLUMN IF EXISTS waiver_claim_days;
```

---

## 📝 **Next Steps After SQL Installation**

Once the SQL is applied, you'll need to create:

1. **TypeScript Interfaces** - Update `src/types/leagueSettings.ts`
2. **React Components** - Drop player modal, waiver claims UI
3. **Hooks** - `useDropPlayer`, `useWaiverClaims`, `useWaiverOrder`
4. **Update League Creation** - Add waiver settings to form
5. **Update Commissioner Tools** - Add waiver management
6. **Waiver Processing** - Edge Function to process claims daily

Would you like me to create those files next?

---

## 🆘 **Troubleshooting**

### **Column already exists error:**
```sql
-- Check if columns already exist first:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'fantasy_league_seasons' AND column_name = 'waiver_type';
```

### **Function already exists error:**
```sql
-- Drop existing functions first:
DROP FUNCTION IF EXISTS initialize_waiver_order(UUID, UUID);
-- Then rerun the function creation
```

### **RLS policy conflicts:**
```sql
-- Check existing policies:
SELECT policyname FROM pg_policies WHERE tablename = 'fantasy_waiver_order';
-- Drop conflicting policies if needed
```

---

## 📞 **Support**

If you encounter issues:
1. Check the verification queries
2. Review the Supabase logs
3. Check RLS policies are not blocking your queries
4. Verify your user has proper permissions

---

**Created:** October 20, 2025  
**Version:** 1.0.0  
**Compatibility:** PostgreSQL 14+, Supabase


