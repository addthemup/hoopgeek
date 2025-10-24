# 🏀 Waiver Processing Edge Function

This Edge Function automatically processes waiver claims for all fantasy leagues based on their configured waiver settings.

## 📋 Features

- **Automatic Processing**: Runs on a schedule to process all pending waiver claims
- **Multiple Waiver Types**: Supports 4 waiver types:
  - **None**: Dropped players immediately become free agents (no processing needed)
  - **Rolling**: Priority-based, moves claiming team to back of order
  - **FAAB**: Blind bidding system with budget management
  - **Continuous**: Fixed priority order that never changes
- **Smart Claiming**: Handles multiple claims on same player
- **Roster Management**: Validates roster spots and processes drops automatically
- **Transaction Logging**: Records all claims and outcomes
- **Error Handling**: Gracefully handles failures and logs errors

## 🚀 Deployment

### 1. Deploy the Function

```bash
cd /Users/adam/Desktop/hoopgeek
npx supabase functions deploy process-waivers --no-verify-jwt
```

### 2. Set Up Environment Variables

The function needs these environment variables (already set by Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Schedule the Function

You can run the function:

#### Option A: Via Supabase CLI (Recommended)

Create a database cron job:

```sql
-- Run daily at 3:00 AM EST (8:00 AM UTC)
SELECT cron.schedule(
  'process-waivers-nightly',
  '0 8 * * *', -- 8 AM UTC = 3 AM EST
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-waivers',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object()
    );
  $$
);
```

#### Option B: Via External Cron (cron-job.org, GitHub Actions, etc.)

Make a POST request to:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-waivers
```

With headers:
```json
{
  "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY",
  "Content-Type": "application/json"
}
```

## 📞 Usage

### Process All Leagues (Scheduled)

```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-waivers \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Process Specific League (Manual Trigger)

```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-waivers \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leagueId": "uuid-here",
    "seasonId": "uuid-here",
    "manualTrigger": true
  }'
```

## 🔄 How It Works

### 1. Fetches Active Leagues
- Gets all active `fantasy_league_seasons`
- Skips leagues with `waiver_type = 'none'`

### 2. Gathers Pending Claims
- Fetches all `pending` claims for each league
- Orders by priority (for rolling/continuous) or bid amount (for FAAB)

### 3. Processes Claims by Type

#### Rolling Waivers
1. Sort claims by current waiver priority
2. Process highest priority team first
3. If claim successful, move team to back of waiver order
4. Continue to next claim

#### FAAB Waivers
1. Group claims by player
2. For each player, sort claims by bid amount (highest first)
3. Use waiver priority as tiebreaker
4. Award to highest valid bidder
5. Deduct bid amount from team's FAAB budget
6. Mark losing bids as failed

#### Continuous Waivers
1. Sort claims by fixed priority order
2. Process in order (priority never changes)
3. First valid claim wins

### 4. Updates Roster
- Drops specified player (if any)
- Adds claimed player to empty roster spot
- Removes player from `fantasy_players_on_waivers`

### 5. Logs Transaction
- Creates `fantasy_transaction` record
- Updates claim status to `successful` or `failed`

### 6. Expires Old Waivers
- Moves players from `on_waivers` to `free_agent` after waiver period

## 📊 Response Format

```json
{
  "success": true,
  "message": "Processed 3 leagues",
  "results": [
    {
      "league_id": "uuid",
      "season_id": "uuid",
      "success": true,
      "message": "Processed 2 claims",
      "processed": 2,
      "waiver_type": "rolling"
    }
  ]
}
```

## 🐛 Debugging

Check function logs:
```bash
npx supabase functions logs process-waivers
```

Common issues:
- **"No pending claims"**: Normal, means no claims to process
- **"No roster spots available"**: Team's roster is full and no drop specified
- **"Insufficient FAAB budget"**: Bid exceeds remaining budget
- **"Player already claimed"**: Multiple claims on same player, only first wins

## 🔧 Testing

Test manually before scheduling:

```bash
# Test with specific league
curl -X POST http://localhost:54321/functions/v1/process-waivers \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leagueId": "your-league-id",
    "seasonId": "your-season-id",
    "manualTrigger": true
  }'
```

## 📝 Notes

- Function runs with `service_role` permissions (bypasses RLS)
- Claims are processed in a single transaction per league
- Failed claims are marked as `failed` with reason in `notes`
- Successful claims are marked as `successful`
- The function is idempotent (safe to run multiple times)

## 🔐 Security

- Only accessible with `service_role` key (not exposed to frontend)
- Validates all roster operations
- Checks FAAB budgets and minimum bids
- Handles race conditions gracefully

## 💡 Future Enhancements

Potential additions:
- Email/push notifications for successful/failed claims
- Detailed claim history reporting
- Commissioner override options
- Custom processing times per league
- Multi-league batch optimization

