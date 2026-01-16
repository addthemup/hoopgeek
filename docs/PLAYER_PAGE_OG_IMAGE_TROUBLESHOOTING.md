# Player Page OG Image Troubleshooting

## Expected Folder Structure

The OG images should be stored in:
```
og-images/
├── feed-posts/
│   └── {post_id}.svg
├── dfs-pools/
│   └── {pool_id}.svg
└── player-pages/          <-- This folder should exist
    └── {player_id}.svg
```

## Current Status

**Folder Path**: `player-pages/` (correct)
**Expected Location**: `og-images/player-pages/{player_id}.svg`

## Why the Folder Might Not Exist

The `player-pages/` folder should be created **automatically** when the first player OG image is uploaded. If it doesn't exist, it means:

1. **The edge function hasn't been called successfully yet**
2. **The upload is failing silently**
3. **There's a permissions issue with the storage bucket**

## How to Test

### Option 1: Test via Script

```bash
# Test with a player ID
node scripts/test_player_og_image.js 0c2d9a2f-fff6-4ee5-89cd-31f18991c5af
```

### Option 2: Test via Browser Console

Open browser console on a player page and run:

```javascript
const { data, error } = await supabase.functions.invoke('generate-og-image', {
  body: {
    player_id: '0c2d9a2f-fff6-4ee5-89cd-31f18991c5af' // Replace with actual player ID
  }
});

console.log('Result:', data, error);
```

### Option 3: Check Edge Function Logs

1. Go to Supabase Dashboard
2. Navigate to Edge Functions → `generate-og-image`
3. Check the logs for:
   - `🎨 Generating OG image for player page: {player_id}`
   - `✅ Player page OG image generated: {url}`
   - Any error messages

## Common Issues

### Issue 1: Function Not Being Called

**Symptoms**: No logs in edge function, no folder created

**Solution**: 
- Check if the share button is actually calling the function
- Check browser console for errors
- Verify the function is deployed: `npx supabase functions list`

### Issue 2: Upload Permission Error

**Symptoms**: Error in logs like "Permission denied" or "Bucket not found"

**Solution**:
- Verify `og-images` bucket exists in Supabase Storage
- Check bucket is set to **public**
- Verify RLS policies allow uploads

### Issue 3: Player Not Found

**Symptoms**: Error "Player not found" in logs

**Solution**:
- Verify the `player_id` is a valid UUID from `nba_players.id`
- Check the player exists in the database

### Issue 4: Stats Query Failing

**Symptoms**: Image generated but with no stats

**Solution**:
- Check if `nba_boxscores` table has data for the player
- Verify `player_id` (UUID) matches `nba_players.id` in boxscores

## Manual Folder Creation (Not Recommended)

Supabase Storage should create folders automatically. However, if needed, you can:

1. Go to Supabase Dashboard → Storage → `og-images` bucket
2. Click "New folder"
3. Name: `player-pages`
4. Click "Create"

**Note**: This shouldn't be necessary - the folder will be created automatically on first upload.

## Verification Steps

1. **Check if function is deployed**:
   ```bash
   npx supabase functions list
   ```

2. **Test the function**:
   ```bash
   node scripts/test_player_og_image.js <player_id>
   ```

3. **Check storage bucket**:
   - Go to Supabase Dashboard → Storage → `og-images`
   - Look for `player-pages/` folder
   - Check if any `.svg` files exist inside

4. **Check edge function logs**:
   - Look for errors or success messages
   - Check if the function is being called

## Expected Behavior

When you click the share button on a player page:

1. `handleShare()` in `PlayerPage.tsx` is called
2. It calls `supabase.functions.invoke('generate-og-image', { player_id })`
3. Edge function:
   - Fetches player data from `nba_players`
   - Fetches season stats from `nba_boxscores`
   - Generates SVG image
   - Uploads to `og-images/player-pages/{player_id}.svg`
   - Returns public URL
4. Folder `player-pages/` is created automatically on first upload
5. Image is accessible at: `https://qbznyaimnrpibmahisue.supabase.co/storage/v1/object/public/og-images/player-pages/{player_id}.svg`

## Next Steps

1. Run the test script to see if the function works
2. Check edge function logs for errors
3. Verify the `og-images` bucket exists and is public
4. Check if the share button is actually calling the function

