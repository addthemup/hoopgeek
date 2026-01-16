# OG Image Generation for Feed Posts

This system automatically generates Open Graph (OG) images for feed posts that mirror the avatar bar visual design, creating Instagram/YouTube-style rich previews when shared.

## Overview

When a feed post is created:
1. Post is inserted into database
2. OG image generation is triggered asynchronously
3. Python script generates 1200x630px image with avatar bar design
4. Image is uploaded to Supabase Storage
5. Post's `share_image_url` is updated with the image URL
6. When shared, Cloudflare Worker uses this image in meta tags

## Files

- `generate_og_image.py` - Core image generation script (mirrors avatar bar logic)
- `generate_and_upload_og.py` - Wrapper that generates and uploads to Supabase
- `add_og_image_generation.sql` - Database triggers/functions

## Setup

### 1. Install Dependencies

```bash
cd scripts/feed
pip install Pillow requests supabase
```

### 2. Set Up Supabase Storage Bucket

Create a storage bucket named `og-images` in Supabase:
- Go to Storage in Supabase dashboard
- Create bucket: `og-images`
- Set to public (or configure RLS appropriately)

### 3. Choose Integration Method

#### Option A: Supabase Edge Function (Recommended)

Create a Supabase Edge Function that calls the Python script:

```typescript
// supabase/functions/generate-og-image/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Call Python script via HTTP or Deno subprocess
  // Upload result to Supabase Storage
  // Return image URL
})
```

#### Option B: Cloudflare Worker

Create a worker that:
1. Receives post data via webhook
2. Generates image (using Canvas API or calls external service)
3. Uploads to Supabase Storage
4. Updates post

#### Option C: Backend API Endpoint

Create a simple API endpoint (Node.js/Python) that:
1. Receives POST with post data
2. Calls `generate_and_upload_og.py`
3. Returns image URL

#### Option D: Direct Python Script (Development)

For testing, you can run directly:

```bash
python3 scripts/feed/generate_and_upload_og.py \
  <post_id> \
  <supabase_url> \
  <supabase_service_role_key> \
  '{"team_tricodes":["LAL","BOS"],"metadata":{...}}'
```

### 4. Update Frontend to Call Endpoint

In `FeedContentManager.tsx`, uncomment and configure the API call in `generateOGImageForPost`:

```typescript
const response = await fetch('/api/generate-og-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    post_id: postId,
    team_tricodes: postData.team_tricodes,
    player_ids: postData.player_ids,
    metadata: postData.metadata,
    game_date: postData.game_date,
    title: postData.title
  })
})
```

Or call your Supabase Edge Function:

```typescript
const { data, error } = await supabase.functions.invoke('generate-og-image', {
  body: { post_id: postId, ...postData }
})
```

## Image Design

The generated images mirror the avatar bar component:

### Game Posts (with teams)
- Split background: Team colors (left/right halves)
- Team logos: Centered in each half
- Score badge: Yellow (#FFC72C) badge at bottom with score
- Date badge: Top center with M/D format
- Vertical divider: Center line separating teams

### Player Posts
- Player avatar: Large circular image centered
- Fantasy points badge: Yellow badge at bottom with "XX.X FP"
- Team color border: Player's team primary color

### Dimensions
- Size: 1200x630px (optimal OG image ratio)
- Format: PNG with transparency support
- Quality: High (for crisp social media previews)

## Testing

1. Create a test post via FeedContentManager
2. Check Supabase Storage bucket `og-images/feed-posts/{post_id}.png`
3. Verify the image shows team logos/player avatar correctly
4. Share the post link in iMessage to see rich preview

## Troubleshooting

### Images not generating
- Check Python dependencies are installed
- Verify Supabase credentials are correct
- Check storage bucket exists and is accessible
- Review console logs for errors

### Images look wrong
- Verify team tricodes are correct
- Check player IDs are valid NBA player IDs
- Ensure metadata contains scores/fantasy points

### Images not updating in preview
- Social media platforms cache previews (24+ hours)
- Use platform debug tools to force refresh:
  - Facebook: https://developers.facebook.com/tools/debug/
  - Twitter: https://cards-dev.twitter.com/validator

## Next Steps

1. Set up your chosen integration method (Edge Function/Worker/API)
2. Test with a sample post
3. Monitor generation times and optimize if needed
4. Consider caching generated images
5. Add retry logic for failed generations

