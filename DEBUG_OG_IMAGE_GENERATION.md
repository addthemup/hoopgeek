# 🔍 Debug OG Image Generation

I've added comprehensive logging to help diagnose why OG images aren't being generated. Here's what to do:

## Step 1: Refresh Your Browser

**IMPORTANT**: The changes I made won't take effect until you:
1. **Refresh your browser** (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Or restart your dev server if you're running one

The console logs I added use emoji prefixes so they're easy to spot:
- 🚀 `handleBulkCreatePosts called` - Function was called
- 📋 `Selected posts: X` - Number of posts selected
- 🔄 `Starting bulk post creation` - Loop starting
- 🔄 `Processing post: [title]` - Processing each post
- 📝 `About to create post` - Right before database insert
- 📝 `Post insert result` - After database insert
- 🔍 `Checking if OG image generation needed` - Checking conditions
- 🔍 `OG Image Generation Check` - Detailed check results
- ✅ `Calling generateOGImageForPost` - Actually calling the function
- ⏭️ `Skipping OG image generation` - Skipped (no teams/players)
- 🎨 `Calling OG image generation for post` - Edge Function called
- ✅ `OG image generated` - Success!

## Step 2: Create Posts and Watch Console

1. Open Developer Console (F12)
2. Make sure console filters are set to show **all** messages (not filtering out Info/Log)
3. Create posts using bulk create
4. Look for the emoji-prefixed logs above

## Step 3: What to Look For

### If you DON'T see any logs:
- The code isn't running (maybe old build?)
- Try hard refresh (Cmd+Shift+R)
- Check if you're using the right function to create posts

### If you see `⏭️ Skipping OG image generation`:
- Posts don't have `team_tricodes` (need 2+) OR `player_ids` (need 1+)
- Check the log output - it shows what data the post has
- This means posts are missing required data

### If you see `✅ Calling generateOGImageForPost` but no Edge Function logs:
- Frontend is calling the function correctly
- Edge Function might be failing silently
- Check Supabase Edge Function logs in dashboard

### If you see `📝 Post insert result` with `success: false`:
- Database insert is failing
- Check the error message in the log

## Step 4: Check Edge Function Logs

Even if frontend logs look good, check Supabase:
1. Go to Supabase Dashboard
2. Edge Functions → `generate-og-image`
3. Check Logs tab
4. Look for requests matching your post IDs

## Most Likely Issue

Based on the pattern, I suspect:
1. **Posts don't have team_tricodes or player_ids** - The check is failing silently
2. **Code isn't running** - Old build or different code path

The new logs will tell us exactly what's happening. After you refresh and try again, share the console output and we can fix it!

