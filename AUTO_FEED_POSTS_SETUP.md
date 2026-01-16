# Automatic Feed Post Creation - Complete Setup Guide

This guide explains how to set up automatic feed post creation from your scraped game JSON files.

## Overview

The system consists of:
1. **Python scraping script** - Scrapes games and uploads JSON to Supabase Storage
2. **Edge function** - Processes JSON files and creates feed posts automatically
3. **Cron job** - Runs the edge function nightly

## Step 1: Create Storage Bucket

In Supabase Dashboard → Storage, create a bucket named `game-data`:

```sql
-- Or via SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-data', 'game-data', false);
```

## Step 2: Set Up Admin User ID

The edge function needs a user ID to create posts. Set it as a Supabase secret:

1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add a new secret:
   - Key: `ADMIN_USER_ID`
   - Value: Your user ID (UUID from `auth.users` table)

Or find your user ID:
```sql
SELECT id FROM auth.users LIMIT 1;
```

## Step 3: Deploy Edge Function

```bash
npx supabase functions deploy auto-create-feed-posts --no-verify-jwt
```

## Step 4: Set Up Cron Job

Run the migration to schedule the function:

```bash
# Apply the migration
npx supabase migration up

# Or run the SQL directly in Supabase SQL Editor:
# supabase/migrations/20250130000000_setup_auto_feed_posts_cron.sql
```

The cron job runs daily at 2:00 AM UTC. Adjust the schedule in the migration file if needed.

## Step 5: Modify Your Python Script

Update `scripts/feed/scrape_games_date_range.py` to upload JSON files to Storage:

### Option A: Use the helper script

1. Copy `scripts/feed/upload_to_storage.py` to your project
2. Import it in your scraping script:

```python
from upload_to_storage import setup_supabase_storage, upload_game_to_storage

# At the start of your script:
supabase_storage = setup_supabase_storage()

# In get_complete_game_data, after saving locally:
if supabase_storage:
    upload_game_to_storage(supabase_storage, game_data, game_id)
```

### Option B: Add directly to your script

Add this to your `scrape_games_date_range.py`:

```python
from supabase import create_client
import os

# At the top, after other imports:
SUPABASE_URL = os.getenv('SUPABASE_URL') or 'https://qbznyaimnrpibmahisue.supabase.co'
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# In get_complete_game_data, after saving JSON file:
def save_to_storage(game_data, game_id):
    try:
        json_str = json.dumps(game_data, indent=2)
        file_path = f"{game_id}.json"
        supabase.storage.from_('game-data').upload(
            file_path,
            json_str.encode('utf-8'),
            file_options={"content-type": "application/json", "upsert": "true"}
        )
        print(f"  ✅ Uploaded to storage: {file_path}")
    except Exception as e:
        print(f"  ⚠️  Error uploading: {e}")

# Call after saving locally:
save_to_storage(game_data, game_id)
```

## Step 6: Test the System

### Test 1: Upload a JSON file manually

```python
# In Python
from supabase import create_client
import json

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
with open('0022500001.json', 'r') as f:
    game_data = json.load(f)

supabase.storage.from_('game-data').upload(
    '0022500001.json',
    json.dumps(game_data).encode('utf-8'),
    file_options={"content-type": "application/json", "upsert": "true"}
)
```

### Test 2: Run the edge function manually

```bash
curl -X POST "https://qbznyaimnrpibmahisue.supabase.co/functions/v1/auto-create-feed-posts" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual_test"}'
```

### Test 3: Check the results

```sql
-- Check created posts
SELECT id, title, post_type, game_id, created_at 
FROM feed_posts 
ORDER BY created_at DESC 
LIMIT 10;
```

## How It Works

1. **Your Python script** runs (manually or via cron) and:
   - Scrapes game data
   - Saves JSON locally (optional)
   - Uploads JSON to Supabase Storage (`game-data` bucket)

2. **The edge function** runs nightly (via cron) and:
   - Lists all JSON files in the `game-data` bucket
   - Downloads each file
   - Checks if posts already exist for that game
   - Detects posts algorithmically (same logic as frontend):
     - Fun Score posts (high fun score games)
     - Player Highlight posts (players with 5+ actions)
   - Creates posts automatically with status `published`

3. **Posts are created** with:
   - Video slides from exciting plays
   - Chart slides from story advantages
   - Proper metadata (teams, players, game info)
   - Player props integration (if available)

## Monitoring

### Check function logs:
- Supabase Dashboard → Edge Functions → auto-create-feed-posts → Logs

### Check cron job status:
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-create-feed-posts-cron';
```

### Check recent runs:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname = 'auto-create-feed-posts-cron' 
ORDER BY start_time DESC 
LIMIT 10;
```

## Troubleshooting

### "ADMIN_USER_ID not set"
- Set the secret in Supabase Dashboard → Edge Functions → Secrets
- Or modify the function to use a different method to get user ID

### "No files to process"
- Check that files are being uploaded to Storage
- Verify bucket name is `game-data`
- Check file permissions

### "Posts not being created"
- Check function logs for errors
- Verify JSON structure matches expected format
- Check that `feed_posts` table exists and has correct schema

### "Function timeout"
- The function processes files sequentially
- If you have many files, consider batching or increasing timeout
- Or process files in smaller batches

## Customization

### Change detection logic
- Edit `detectFeedPosts()` in `supabase/functions/auto-create-feed-posts/index.ts`
- Add more post types or detection criteria

### Change slide generation
- Edit `createPostFromDetected()` in the edge function
- Add more slide types or enhance existing ones

### Change schedule
- Edit the cron schedule in the migration file
- Format: `'minute hour day month weekday'`
- Example: `'0 2 * * *'` = 2 AM UTC daily

## Next Steps

1. ✅ Deploy the edge function
2. ✅ Set up the cron job
3. ✅ Modify your Python script to upload to Storage
4. ✅ Test with a few games
5. ✅ Monitor the first few automated runs
6. ✅ Adjust detection logic if needed

## Notes

- The function skips games that already have posts
- Posts are automatically published (status: `published`)
- **JSON files are automatically deleted from Storage after successful processing** to save space
- Files are only kept if there were errors creating posts (for retry on next run)
- The function uses simplified slide generation - you may want to enhance it
- Consider adding error notifications (email, Slack, etc.) for failed runs

## File Deletion Behavior

The function automatically deletes JSON files from Storage in these cases:
- ✅ All posts were created successfully
- ✅ Posts already exist for the game  
- ✅ No posts were detected (empty game data)

Files are **kept** if:
- ⚠️ Some posts failed to create (for retry on next run)

