# 🔍 Diagnosing OG Image Generation Issues

You created 25 posts but no OG images appeared in the bucket. Here's how to diagnose the issue:

## Step 1: Check Browser Console

When you create posts, open your browser's Developer Console (F12) and look for these messages:

### ✅ Success Path:
```
🔍 OG Image Generation Check: { postId: "...", hasTeams: true, ... }
✅ Calling generateOGImageForPost for post: ...
🎨 Calling OG image generation for post: ...
✅ OG image generated: https://...
```

### ❌ Problem Paths:

**If posts don't have teams/players:**
```
🔍 OG Image Generation Check: { hasTeams: false, hasPlayers: false, ... }
⏭️ Skipping OG image generation - no teams or players
```

**If Edge Function fails:**
```
✅ Calling generateOGImageForPost for post: ...
❌ Failed to generate OG image: [error details]
```

## Step 2: Check Your Post Data

Run this SQL query in Supabase SQL Editor to check if your posts have the required data:

```sql
SELECT 
  id,
  title,
  team_tricodes,
  array_length(team_tricodes, 1) as team_count,
  player_ids,
  array_length(player_ids, 1) as player_count,
  share_image_url,
  created_at
FROM feed_posts
ORDER BY created_at DESC
LIMIT 25;
```

**Look for:**
- `team_count >= 2` OR `player_count >= 1` (posts need this to generate OG images)
- Posts with `NULL` or empty arrays won't generate images

## Step 3: Why Posts Might Be Missing Data

The `team_tricodes` comes from:
```javascript
const teams = [
  uploadedGameData.gameMetadata?.homeTeam?.abbreviation,
  uploadedGameData.gameMetadata?.awayTeam?.abbreviation
].filter(Boolean)
```

If `uploadedGameData.gameMetadata` is missing `homeTeam` or `awayTeam`, the `teams` array will be empty.

The `player_ids` comes from slide metadata:
```javascript
const playerIds = Array.from(new Set(
  slides.map(s => s.metadata?.personId).filter(Boolean)
)).map(id => parseInt(id))
```

If slides don't have `metadata.personId`, the `player_ids` array will be empty.

## Step 4: Manual Regeneration

If your posts DO have the data but images weren't generated, you can regenerate them:

### Option A: Use the Diagnostic HTML Tool

1. Open `scripts/diagnose_og_image_issue.html` in your browser
2. Click "Check Recent Posts" to see which posts are eligible
3. Click "Regenerate OG Images" to regenerate them

### Option B: Manual SQL + Edge Function Call

1. Find eligible posts:
```sql
SELECT id, team_tricodes, player_ids, metadata, game_date, title
FROM feed_posts
WHERE (
  (team_tricodes IS NOT NULL AND array_length(team_tricodes, 1) >= 2)
  OR
  (player_ids IS NOT NULL AND array_length(player_ids, 1) >= 1)
)
AND share_image_url IS NULL
ORDER BY created_at DESC;
```

2. Call the Edge Function for each post (replace `YOUR_POST_ID`):
```bash
curl -X POST 'https://rxdmjqwhvlozvcwpwajx.supabase.co/functions/v1/generate-og-image' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "post_id": "YOUR_POST_ID",
    "team_tricodes": ["LAL", "BOS"],
    "player_ids": [123],
    "metadata": {},
    "game_date": "2024-01-01",
    "title": "Test Post"
  }'
```

## Step 5: Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions → `generate-og-image`
2. Check the logs for:
   - `📝 Request received:` - confirms function was called
   - `🎨 Generating OG image for post:` - confirms it's processing
   - `✅ OG image generated:` - confirms success
   - `❌ Error:` - shows what went wrong

## Most Likely Issue

Based on the code, **your posts probably don't have `team_tricodes` (with 2+ items) OR `player_ids` (with 1+ items)**.

Check the console logs when creating posts - you should see either:
- `✅ Calling generateOGImageForPost` (good)
- `⏭️ Skipping OG image generation` (bad - means data is missing)

If you see the skip message, the issue is that:
1. `uploadedGameData.gameMetadata?.homeTeam?.abbreviation` or `awayTeam?.abbreviation` is missing/undefined
2. OR slides don't have `metadata.personId`

Fix this by ensuring your game data includes team abbreviations and your slides include player metadata.
