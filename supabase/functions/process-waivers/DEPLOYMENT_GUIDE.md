# 🚀 Waiver System Deployment Guide

Complete guide to deploying the automated waiver processing system for HoopGeek.

## 📋 Prerequisites

- ✅ Database migrations applied (`create_waiver_system.sql`, `waiver_system_functions.sql`)
- ✅ Frontend waiver UI deployed
- ✅ Supabase CLI installed (`npm install -g supabase`)
- ✅ Supabase project linked (`npx supabase link`)

## 🔧 Step 1: Deploy the Edge Function

```bash
cd /Users/adam/Desktop/hoopgeek

# Deploy the process-waivers function
npx supabase functions deploy process-waivers --no-verify-jwt

# Verify deployment
npx supabase functions list
```

Expected output:
```
┌──────────────────┬──────────┬─────────────────────────┐
│ NAME             │ VERSION  │ CREATED AT              │
├──────────────────┼──────────┼─────────────────────────┤
│ process-waivers  │ v1       │ 2025-10-20 12:00:00     │
└──────────────────┴──────────┴─────────────────────────┘
```

## 🧪 Step 2: Test the Function

### Test with a specific league (recommended first):

```bash
# Replace with your actual league and season IDs
curl -X POST https://qbznyaimnrpibmahisue.supabase.co/functions/v1/process-waivers \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leagueId": "your-league-id",
    "seasonId": "your-season-id",
    "manualTrigger": true
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Processed 1 leagues",
  "results": [
    {
      "league_id": "...",
      "season_id": "...",
      "success": true,
      "message": "Processed 0 claims",
      "processed": 0,
      "waiver_type": "rolling"
    }
  ]
}
```

### Test with all leagues:

```bash
curl -X POST https://qbznyaimnrpibmahisue.supabase.co/functions/v1/process-waivers \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## ⏰ Step 3: Set Up Automated Scheduling

You have **three options** for scheduling:

### Option A: Supabase pg_cron (Recommended if available)

1. Check if `pg_cron` extension is enabled:
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';
   ```

2. If not enabled, contact Supabase support or enable via dashboard

3. Run the setup SQL:
   ```bash
   # From Supabase SQL Editor or via CLI
   cat supabase/functions/process-waivers/setup_waiver_cron.sql | npx supabase db execute
   ```

4. Verify the cron job:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-waivers-nightly';
   ```

### Option B: GitHub Actions (Free, Reliable)

Create `.github/workflows/process-waivers.yml`:

```yaml
name: Process Waivers Nightly

on:
  schedule:
    # Runs at 3:00 AM EST (8:00 AM UTC) every day
    - cron: '0 8 * * *'
  workflow_dispatch: # Allow manual triggers

jobs:
  process-waivers:
    runs-on: ubuntu-latest
    steps:
      - name: Call Waiver Processing Function
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/process-waivers \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

Add secrets in GitHub repo settings:
- `SUPABASE_URL`: `https://qbznyaimnrpibmahisue.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

### Option C: External Cron Service (cron-job.org)

1. Go to https://cron-job.org
2. Create a new cron job:
   - **URL**: `https://qbznyaimnrpibmahisue.supabase.co/functions/v1/process-waivers`
   - **Method**: POST
   - **Headers**: 
     - `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
     - `Content-Type: application/json`
   - **Body**: `{}`
   - **Schedule**: `0 8 * * *` (daily at 3 AM EST)
3. Enable notifications for failures

## 📊 Step 4: Monitor & Verify

### Check Function Logs

```bash
# View recent logs
npx supabase functions logs process-waivers

# Follow logs in real-time
npx supabase functions logs process-waivers --follow
```

### Check Cron Job History (if using pg_cron)

```sql
SELECT 
  jobname,
  status,
  return_message,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
WHERE jobname = 'process-waivers-nightly'
ORDER BY start_time DESC
LIMIT 10;
```

### Verify Processed Claims

```sql
-- Check recent processed claims
SELECT 
  wc.id,
  wc.status,
  wc.processed_at,
  wc.notes,
  ft.team_name,
  np.name as player_name,
  wc.bid_amount
FROM fantasy_waiver_claims wc
JOIN fantasy_teams ft ON wc.fantasy_team_id = ft.id
JOIN nba_players np ON wc.player_id = np.id
WHERE wc.processed_at > NOW() - INTERVAL '24 hours'
ORDER BY wc.processed_at DESC;
```

## 🔍 Troubleshooting

### Issue: "No pending claims"
- **Cause**: No teams have submitted waiver claims
- **Solution**: Normal behavior, nothing to fix

### Issue: "Failed to fetch claims"
- **Cause**: Database connection issue
- **Solution**: Check Supabase service status, verify service role key

### Issue: "No roster spots available"
- **Cause**: Team's roster is full and no drop was specified
- **Solution**: Teams must specify a player to drop when submitting claims

### Issue: "Insufficient FAAB budget"
- **Cause**: Bid exceeds team's remaining budget
- **Solution**: Claim is correctly rejected, team needs to bid less

### Issue: Function times out
- **Cause**: Too many leagues/claims to process
- **Solution**: Consider splitting into smaller batches or increasing function timeout

### Issue: Cron job not running
- **Cause**: 
  - `pg_cron` not enabled
  - Wrong timezone/schedule
  - Service role key not configured
- **Solution**: 
  - Verify cron job is scheduled: `SELECT * FROM cron.job;`
  - Check timezone settings
  - Use GitHub Actions or external cron as fallback

## 🎯 Best Practices

1. **Test First**: Always test manually before scheduling
2. **Monitor Initially**: Check logs daily for first week
3. **Set Alerts**: Configure alerts for function failures
4. **Document Schedule**: Let commissioners know processing time
5. **Have Backups**: Use GitHub Actions as backup if pg_cron fails

## 📱 Commissioner Tools

### Manual Trigger (for commissioners)

Create a UI button that calls:

```typescript
async function manualProcessWaivers(leagueId: string, seasonId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/process-waivers`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leagueId,
        seasonId,
        manualTrigger: true
      })
    }
  );
  
  return response.json();
}
```

⚠️ **Security**: Don't expose service role key to frontend! 
Create a separate Edge Function for commissioner-triggered processing that validates the user is a commissioner first.

## 🔐 Security Checklist

- ✅ Service role key stored securely (GitHub secrets, env vars)
- ✅ Function only accessible via service role key
- ✅ All RLS policies properly configured
- ✅ Cron job using secure credentials
- ✅ No sensitive keys in frontend code
- ✅ Function logs don't expose sensitive data

## 📈 Performance Notes

- Typical processing time: **< 1 second** per league with < 10 claims
- Max concurrent processing: **10 leagues** (adjust if needed)
- Function timeout: **60 seconds** default (increase if needed)
- Estimated cost: **Free** for < 1000 invocations/month

## 🎉 Success Criteria

You'll know it's working when:
1. ✅ Function deploys without errors
2. ✅ Manual test returns `{ "success": true }`
3. ✅ Cron job shows in `cron.job` table (if using pg_cron)
4. ✅ Claims are processed at scheduled time
5. ✅ Players appear on teams after processing
6. ✅ Waiver order updates correctly
7. ✅ Transaction logs are created

## 📞 Support

If you run into issues:
1. Check function logs: `npx supabase functions logs process-waivers`
2. Check database logs in Supabase dashboard
3. Verify RLS policies are correct
4. Test with a single league first
5. Check GitHub issues or Discord for known problems

---

**Last Updated**: October 20, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅

