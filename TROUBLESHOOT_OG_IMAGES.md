# Troubleshooting OG Image Generation

## Problem: Images not generating when creating posts

### Step 1: Check Browser Console

Open browser DevTools (F12) → Console tab

When you create a post, you should see:
```
🎨 Calling OG image generation for post: [post-id]
```

If you see:
- `❌ Failed to generate OG image:` → Check the error message
- `⚠️ OG image function returned no URL:` → Function ran but didn't return URL
- Nothing at all → Function not being called

### Step 2: Check Supabase Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/qbznyaimnrpibmahisue/functions
2. Click on `generate-og-image`
3. Click "Logs" tab
4. Look for recent invocations when you created posts

You should see logs like:
```
📝 Request received: { method: "POST", hasAuth: true, ... }
📦 Request body: { post_id: "...", has_team_tricodes: true, ... }
🎨 Generating OG image for post: ...
✅ OG image generated: ...
```

If you see errors, note them down.

### Step 3: Verify Post Data

The function only generates images if:
- `team_tricodes` has at least 2 teams (for game posts), OR
- `player_ids` has at least 1 player (for player posts)

Check if your posts have this data:
```sql
SELECT 
  id, 
  title,
  team_tricodes,
  player_ids,
  share_image_url
FROM feed_posts
ORDER BY created_at DESC
LIMIT 25;
```

### Step 4: Manual Test

Test the function directly:

```bash
curl -X POST "https://qbznyaimnrpibmahisue.supabase.co/functions/v1/generate-og-image" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "test-post-123",
    "team_tricodes": ["LAL", "BOS"],
    "metadata": {
      "story_data": {
        "awayScore": 120,
        "homeScore": 115
      }
    },
    "game_date": "2025-11-03T00:00:00Z",
    "title": "Test Post"
  }'
```

If this works, check one of your actual post IDs:

```bash
# Replace [POST_ID] with one of your 25 post IDs
curl -X POST "https://qbznyaimnrpibmahisue.supabase.co/functions/v1/generate-og-image" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "[POST_ID]",
    "team_tricodes": ["LAL", "BOS"],
    "metadata": {},
    "game_date": null,
    "title": "Test"
  }'
```

### Step 5: Re-generate for Existing Posts

If posts were created without OG images, you can regenerate them:

```sql
-- Get post IDs that need OG images
SELECT id, title, team_tricodes, player_ids, share_image_url
FROM feed_posts
WHERE share_image_url IS NULL
AND (array_length(team_tricodes, 1) >= 2 OR array_length(player_ids, 1) > 0)
ORDER BY created_at DESC;
```

Then manually call the function for each post ID via the frontend or curl.

### Common Issues

**1. Function not being called**
- Check browser console for errors
- Verify `supabase.functions.invoke()` is working
- Check network tab for failed requests

**2. "Bucket not found" error**
- Verify `og-images` bucket exists and is public
- Check Storage → Buckets in Supabase Dashboard

**3. "Missing post_id" error**
- Check that `insertedPost.id` exists after insert
- Verify `.select().single()` returns data

**4. Function returns but no image**
- Check storage bucket permissions
- Verify service role key has storage write access
- Check Edge Function logs for upload errors

### Quick Fix: Generate for Existing Posts

If you want to generate OG images for the 25 posts you already created:

1. Open browser console
2. Run this JavaScript in the console (replace with your actual Supabase client):

```javascript
// Get all posts without OG images
const { data: posts } = await supabase
  .from('feed_posts')
  .select('id, team_tricodes, player_ids, metadata, game_date, title')
  .is('share_image_url', null)
  .not('team_tricodes', 'is', null)
  .limit(25)

// Generate OG images for each
for (const post of posts || []) {
  if (post.team_tricodes?.length >= 2 || post.player_ids?.length > 0) {
    const { data, error } = await supabase.functions.invoke('generate-og-image', {
      body: {
        post_id: post.id,
        team_tricodes: post.team_tricodes || null,
        player_ids: post.player_ids || null,
        metadata: post.metadata || null,
        game_date: post.game_date || null,
        title: post.title || null
      }
    })
    console.log(post.id, error || data?.og_image_url)
    await new Promise(resolve => setTimeout(resolve, 1000)) // Rate limit
  }
}
```

