# 🔍 How to Check Function Results

## What `{"result": 6151}` Means

The number `6151` is a **request ID**, not the actual function response. The `net.http_post` function returns immediately with a request ID, and the HTTP request continues in the background.

## How to Get the Actual Response

### Option 1: Wait and Query the Response (Recommended)

Wait a few seconds (the function may take 1-5 minutes to complete all tasks), then run:

```sql
-- Replace 6151 with your actual request ID
SELECT 
    request_id,
    status_code,
    content::jsonb AS response,
    created
FROM net.http_response_queue
WHERE request_id = 6151
ORDER BY created DESC
LIMIT 1;
```

### Option 2: Check All Recent Responses

```sql
-- See all recent HTTP responses
SELECT 
    request_id,
    status_code,
    content::jsonb AS response,
    created
FROM net.http_response_queue
ORDER BY created DESC
LIMIT 10;
```

### Option 3: Check Function Logs (Easiest)

1. Go to **Supabase Dashboard** → **Edge Functions** → **daily-maintenance**
2. Click **"Logs"** tab
3. You'll see detailed logs showing:
   - Each task being executed
   - Success/failure for each task
   - Final summary

## Expected Response Format

When the function completes, you should see something like:

```json
{
  "success": true,
  "totalTasks": 5,
  "successful": 5,
  "failed": 0,
  "duration": "45234ms",
  "timestamp": "2025-01-20T12:00:00.000Z",
  "results": [
    {
      "name": "Import Daily Boxscores",
      "success": true,
      "duration": 12345,
      "message": "Imported 10 box scores"
    },
    {
      "name": "Import Player Props",
      "success": true,
      "duration": 8901,
      "message": "Imported 50 games and 500 player props"
    },
    // ... more tasks
  ],
  "failedTasks": []
}
```

## Quick Status Check

To see if your request is still processing:

```sql
-- Check if request is still pending
SELECT 
    request_id,
    status_code,
    CASE 
        WHEN status_code IS NULL THEN 'Still processing...'
        WHEN status_code = 200 THEN 'Success'
        ELSE 'Error: ' || status_code::text
    END AS status,
    created
FROM net.http_response_queue
WHERE request_id = 6151;
```







