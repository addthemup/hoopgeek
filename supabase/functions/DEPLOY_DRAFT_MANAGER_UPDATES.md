# Deploy Draft Manager Updates

## Changes Made

The `draft-manager` Edge Function has been updated to **ignore salary cap for the first 20% of the draft**.

### How It Works:

1. **First 20% of Draft** (e.g., picks 1-30 in a 150-pick draft):
   - ✅ Picks **solely based on projected fantasy points**
   - ❌ **Ignores salary cap completely**
   - 🎯 Ensures teams get the best players available regardless of cost
   - 📊 Uses ESPN projections to calculate fantasy points

2. **Remaining 80% of Draft** (picks 31-150):
   - ✅ Uses **existing salary cap logic**
   - 💰 Balances fantasy points with cap management
   - 🧠 Dynamic strategy based on remaining cap and picks

### Example Scenarios:

- **10-team league, 15 rounds** = 150 total picks
  - First 20% = picks 1-30 (ignore salary cap)
  - Remaining 80% = picks 31-150 (use salary cap logic)

- **8-team league, 13 rounds** = 104 total picks
  - First 20% = picks 1-21 (ignore salary cap)
  - Remaining 80% = picks 22-104 (use salary cap logic)

---

## Deployment Instructions

### Option 1: Deploy via Supabase CLI (Recommended)

1. **Ensure you're in the project root:**
   ```bash
   cd /Users/adam/Desktop/hoopgeek
   ```

2. **Deploy the function:**
   ```bash
   supabase functions deploy draft-manager
   ```

3. **Verify deployment:**
   ```bash
   supabase functions list
   ```

### Option 2: Deploy via Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** in the sidebar
4. Click on **draft-manager** function
5. Click **"Edit Function"**
6. Copy the entire contents of `supabase/functions/draft-manager/index.ts`
7. Paste into the editor
8. Click **"Deploy"**

---

## Testing the Update

### 1. Start a Test Draft:
   - Create a new league or use an existing one
   - Set a draft date/time
   - Start the draft

### 2. Monitor Console Logs:
   The draft-manager will log:
   ```
   🎯 Draft Analytics:
      Total Picks in Draft: 150
      First 20% Threshold: 30 picks
      Current Pick: 5
      🚀 IN FIRST 20% - IGNORING SALARY CAP
   ```

   Or for later picks:
   ```
   🎯 Draft Analytics:
      Total Picks in Draft: 150
      First 20% Threshold: 30 picks
      Current Pick: 45
      💰 Past 20% - Using salary cap logic
   ```

### 3. Expected Behavior:
   - **Picks 1-30**: Teams draft the absolute best players by fantasy points (Jokic, Curry, Giannis, etc.) regardless of salary
   - **Picks 31+**: Draft manager considers salary cap and uses dynamic budgeting strategy

---

## Rollback Instructions (If Needed)

If you need to revert to the old salary cap logic:

1. Find the section starting with:
   ```typescript
   // ===== CHECK IF WE'RE IN FIRST 20% OF DRAFT =====
   ```

2. Change the condition:
   ```typescript
   const isInFirstTwentyPercent = false; // Always use salary cap logic
   ```

3. Redeploy the function

---

## Benefits of This Approach

✅ **Better Draft Quality**: Top-tier players get drafted early regardless of cost
✅ **More Realistic**: Mirrors real NBA drafts where teams prioritize talent over contracts early
✅ **Cap Management Still Matters**: Teams still need to manage cap for 80% of the draft
✅ **Prevents Cap Lockouts**: Teams won't run out of cap space after just 2-3 picks
✅ **Balanced Rosters**: Teams get star players early, then fill out rosters strategically

---

## Questions or Issues?

If the draft behaves unexpectedly:
1. Check Supabase Edge Functions logs
2. Look for the `🎯 Draft Analytics` log entries
3. Verify the 20% threshold calculation is correct
4. Ensure ESPN projections are loaded in the database

---

**Last Updated**: October 20, 2025

