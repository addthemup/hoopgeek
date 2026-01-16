# OG Image Generation Improvements

## Overview

This document outlines the improvements made to OG image generation for DFS pools and feed posts. These changes ensure reliable, automatic OG image generation when content is created.

## Changes Made

### 1. Database Schema Update

**Migration**: `supabase/migrations/add_og_image_url_to_dfs_pools.sql`

- Added `og_image_url` field to `dfs_pools` table
- This field stores the URL of the generated OG image for social sharing
- Similar to how `feed_posts` uses `share_image_url`

### 2. Edge Function Updates

**File**: `supabase/functions/generate-og-image/index.ts`

**DFS Pool OG Image Generation**:
- Now saves the generated OG image URL to the `dfs_pools.og_image_url` field
- Includes UUID validation before updating the database
- Proper error handling that doesn't fail the entire operation if database update fails

**Feed Post OG Image Generation**:
- Already had proper database updates (no changes needed)
- Continues to update `feed_posts.share_image_url` field

### 3. Client-Side Improvements

**Files**:
- `src/hooks/useCreateDFSPool.ts`
- `src/components/Admin/FeedContentManager.tsx`

**Improvements**:
- Added retry logic with exponential backoff (3 attempts by default)
- Better error logging with attempt numbers
- Non-blocking: OG image generation failures don't prevent content creation
- Improved console logging for debugging

## How It Works

### DFS Pool Creation Flow

1. User creates a DFS pool via `useCreateDFSPool` hook
2. Pool is created in database via RPC function
3. Pool ID is extracted from the result
4. `generateOGImageForPool()` is called asynchronously (non-blocking)
5. Edge Function `generate-og-image` is invoked with `pool_id`
6. Edge Function:
   - Fetches pool data and games
   - Generates SVG OG image
   - Uploads to Supabase Storage (`og-images/dfs-pools/{poolId}.svg`)
   - Updates `dfs_pools.og_image_url` with the public URL
   - Returns the URL to the client
7. Client logs success/failure (with retries if needed)

### Feed Post Creation Flow

1. User creates a feed post via `FeedContentManager`
2. Post is inserted into `feed_posts` table
3. If post has teams or players, `generateOGImageForPost()` is called asynchronously
4. Edge Function `generate-og-image` is invoked with `post_id` and metadata
5. Edge Function:
   - Fetches post data (game_id, slides, post_type)
   - Generates SVG/PNG OG image
   - Uploads to Supabase Storage (`og-images/feed-posts/{postId}.{svg|png}`)
   - Updates `feed_posts.share_image_url` with the public URL
   - Returns the URL to the client
6. Client logs success/failure (with retries if needed)

## Retry Logic

Both OG image generation functions now include:
- **3 retry attempts** by default
- **Exponential backoff**: 1s, 2s, 3s delays between retries
- **Detailed logging**: Each attempt is logged with attempt number
- **Graceful failure**: If all retries fail, operation completes without throwing

## Error Handling

- **Non-blocking**: OG image generation failures don't prevent content creation
- **UUID validation**: Database updates only happen if IDs are valid UUIDs
- **Storage errors**: If upload fails, error is logged but doesn't crash the function
- **Database errors**: If database update fails, error is logged but image upload still succeeds

## Testing

To verify OG image generation is working:

1. **Create a DFS Pool**:
   - Check console for: `🎨 Calling OG image generation for pool`
   - Check database: `dfs_pools.og_image_url` should be populated
   - Check storage: `og-images/dfs-pools/{poolId}.svg` should exist

2. **Create a Feed Post**:
   - Check console for: `🎨 Calling OG image generation for post`
   - Check database: `feed_posts.share_image_url` should be populated
   - Check storage: `og-images/feed-posts/{postId}.{svg|png}` should exist

3. **Check Cloudflare Worker**:
   - The worker uses on-demand generation via `/og-image/:postId` and `/dfs-og-image/:poolId` routes
   - These routes generate images on-the-fly if they don't exist in storage

## Future Improvements

- Consider adding a background job queue for OG image generation
- Add monitoring/alerting for failed OG image generations
- Consider caching generated images more aggressively
- Add support for regenerating OG images on content updates

