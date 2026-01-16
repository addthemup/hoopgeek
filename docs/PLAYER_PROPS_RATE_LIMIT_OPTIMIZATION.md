# Player Props Rate Limit Optimization

## Problem
The player props import edge function was experiencing rate limiting issues with the SportsGameOdds API, even though the function only makes 1 API call per run.

## Root Causes Identified
1. **No rate limiting logic**: The edge function didn't track or limit API requests
2. **No caching**: The function always made API calls even when recent data existed
3. **Concurrent runs**: Multiple cron jobs could run simultaneously, multiplying API calls
4. **No rate limit monitoring**: No visibility into current API usage

## Solutions Implemented

### 1. Rate Limiting Logic
- Added `waitForRateLimit()` function that tracks request times
- Enforces maximum 50 requests per minute (well below the 1000 limit)
- Ensures minimum 1.2 seconds between requests
- Automatically waits when approaching limits

### 2. Recent Data Check
- Added `hasRecentPropsData()` function that checks if props data exists from the last 2 hours
- Skips API calls if recent data is available
- Reduces unnecessary API calls by ~75% (if running 4x daily, only first run makes API call)

### 3. Rate Limit Monitoring
- Added `checkRateLimitUsage()` function that queries the `/account/usage` endpoint
- Logs current usage percentage before making API calls
- Warns if usage exceeds 80%

### 4. Processing Delays
- Added 100ms delay between processing events
- Prevents overwhelming the database with rapid inserts

## Diagnostic Tool

A diagnostic script has been created to check rate limit usage:

```bash
python3 scripts/diagnose_sgo_rate_limit.py
```

This script:
- Checks current rate limit status for all intervals (per-second, per-minute, per-hour, per-day, per-month)
- Shows usage percentages and warnings
- Helps identify if rate limits are being hit

## Expected Behavior

### Before Optimization
- **4 API calls per day** (one per cron job)
- No rate limiting
- No caching
- Potential for concurrent runs

### After Optimization
- **~1 API call per day** (only if no recent data exists)
- Rate limiting enforced (max 50 req/min)
- Recent data caching (2-hour window)
- Rate limit monitoring
- Processing delays to prevent overload

## Configuration

Key constants in `supabase/functions/import-player-props/index.ts`:

```typescript
const MAX_REQUESTS_PER_MINUTE = 50 // Conservative limit
const MIN_DELAY_BETWEEN_REQUESTS = 1200 // 1.2 seconds
const RECENT_DATA_THRESHOLD_HOURS = 2 // Skip if data exists from last 2 hours
```

## Monitoring

To monitor rate limit usage:

1. **Check logs**: Look for rate limit warnings in edge function logs
2. **Run diagnostic**: Use `scripts/diagnose_sgo_rate_limit.py` to check current status
3. **Check Supabase logs**: Monitor edge function execution times and errors

## Testing

To test the optimization:

1. Run the diagnostic script to see current rate limit status
2. Manually trigger the edge function and check logs for:
   - Rate limit checks
   - Recent data checks
   - Skipped API calls (when recent data exists)
3. Monitor for 429 errors (should be eliminated)

## Future Improvements

1. **Distributed Locking**: Implement proper distributed lock to prevent concurrent runs
2. **Adaptive Rate Limiting**: Adjust rate limits based on API response headers
3. **Caching Layer**: Add Redis or similar for more sophisticated caching
4. **Metrics Dashboard**: Create a dashboard to visualize API usage over time

