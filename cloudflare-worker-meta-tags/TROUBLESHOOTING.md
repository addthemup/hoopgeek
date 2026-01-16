# Troubleshooting Feed Post Share Links

If your feed post links aren't showing rich previews in iMessage or other platforms, follow these steps:

## Issue: Generic Preview Showing

If you see "Fantasy Basketball" and "hoop-geek.com" instead of the post-specific preview, the worker isn't intercepting the request.

### Step 1: Verify Worker is Deployed

```bash
cd cloudflare-worker-meta-tags
npx wrangler deployments list
```

You should see recent deployments. If not, deploy:

```bash
npm run deploy
```

### Step 2: Check Environment Variables

Make sure your Supabase credentials are set:

```bash
npx wrangler secret list
```

You should see:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

If missing, set them:

```bash
npx wrangler secret put SUPABASE_URL
# Paste your Supabase URL when prompted

npx wrangler secret put SUPABASE_ANON_KEY
# Paste your Supabase anon key when prompted
```

### Step 3: Test the Worker Directly

Test with a bot user agent to see if meta tags are being injected:

```bash
# Replace YOUR_POST_UUID with an actual feed post UUID
curl -A "AppleBot" https://hoopgeek.app/YOUR_POST_UUID | grep -i "og:title"
```

You should see the custom title. If you see the default "HoopGeek - Fantasy Basketball", the worker isn't working.

### Step 4: Check Route Configuration

The `wrangler.toml` should have:

```toml
[env.production]
routes = [
  { pattern = "hoopgeek.app/dfs/join/*", zone_name = "hoopgeek.app" },
  { pattern = "hoopgeek.app/*", zone_name = "hoopgeek.app" }
]
```

**Note:** The catch-all route `hoopgeek.app/*` will intercept all requests, but the worker code only processes:
- Bots (AppleBot, FacebookExternalHit, etc.)
- URLs matching UUID pattern or DFS join pattern
- All other requests pass through normally

### Step 5: Check Worker Logs

View real-time logs to see if the worker is being triggered:

```bash
npm run tail
```

Then try sharing a link. You should see logs like:
```
Bot detected (AppleBot) requesting feed post: [uuid]
```

### Step 6: Verify URL Format

Make sure the share URL is in the correct format:
- ✅ `https://hoopgeek.app/4a5f412a-457b-4c82-aa47-a1f030a03274`
- ❌ `https://hoopgeek.app/?postId=4a5f412a-457b-4c82-aa47-a1f030a03274`

The worker only matches UUIDs at the root path, not query parameters.

### Step 7: Clear Cache

Social media platforms cache link previews. To force a refresh:

**iMessage:**
- The cache usually clears after 24 hours
- Or try sharing from a different device

**Facebook Debugger:**
- Visit: https://developers.facebook.com/tools/debug/
- Enter your URL and click "Scrape Again"

**Twitter Card Validator:**
- Visit: https://cards-dev.twitter.com/validator
- Enter your URL to test and refresh

### Step 8: Verify Feed Post Data

Make sure your feed post has:
- `status = 'published'`
- `team_tricodes` array (for team matchup)
- `metadata` with game info (for scores)
- `thumbnail_url` or `share_image_url` (for image)

Test the API directly:

```bash
# Replace with your Supabase URL and anon key
curl "https://YOUR_PROJECT.supabase.co/rest/v1/feed_posts?id=eq.YOUR_POST_UUID&status=eq.published&select=*" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Common Issues

### Issue: "Could not find head tag"
- The HTML structure might be different
- Check that your site serves HTML (not just a SPA loading via JS)
- The worker fetches from origin - make sure the origin is accessible

### Issue: Worker matches but shows wrong data
- Check that the feed post exists and is published
- Verify `team_tricodes` and `metadata` are populated
- Check worker logs for errors

### Issue: Route not matching
- Verify UUID format is correct (8-4-4-4-12 hex digits)
- Check that the route pattern in wrangler.toml matches your domain
- Make sure zone_name matches your Cloudflare zone

### Issue: Still showing default preview after fixing
- Clear platform cache (see Step 7)
- Try sharing to a different platform to verify
- Wait 24 hours for cache to expire

## Testing Checklist

- [ ] Worker is deployed
- [ ] Environment variables are set
- [ ] Route patterns are correct in wrangler.toml
- [ ] Bot user agent test returns custom meta tags
- [ ] Feed post exists and is published
- [ ] Feed post has team_tricodes and metadata
- [ ] URL format is `/{uuid}` not `/?postId={uuid}`
- [ ] Platform cache has been cleared

## Need More Help?

1. Check Cloudflare Workers dashboard for errors
2. View worker logs: `npm run tail`
3. Test with different bot user agents
4. Verify Supabase API is accessible
5. Check that the origin site is serving HTML correctly

