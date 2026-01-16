# Generate OG Image Edge Function

Generates Open Graph images for feed posts that mirror the avatar bar visual design. Creates rich preview cards for sharing in iMessage, WhatsApp, Twitter, etc.

## Features

- 🎨 Generates 1200x630px images (optimal OG image size)
- 🏀 Mirrors avatar bar design:
  - Split team colors for game posts
  - Team logos positioned like avatar bar
  - Scores and dates
  - Player avatars with fantasy points
- ☁️ Uploads to Supabase Storage
- 🔄 Updates post's `share_image_url` automatically

## Deployment

### 1. Ensure Storage Bucket Exists

Create a bucket named `og-images` in Supabase:
- Go to Storage → Create bucket
- Name: `og-images`
- Public: Yes (or configure RLS)

### 2. Deploy the Function

```bash
cd /Users/adam/Desktop/hoopgeek
npx supabase functions deploy generate-og-image
```

### 3. Verify Deployment

```bash
npx supabase functions list
```

You should see `generate-og-image` in the list.

## Usage

The function is automatically called from `FeedContentManager.tsx` after post creation.

You can also call it manually:

```typescript
const { data, error } = await supabase.functions.invoke('generate-og-image', {
  body: {
    post_id: 'post-uuid',
    team_tricodes: ['LAL', 'BOS'],
    player_ids: [2544],
    metadata: {
      story_data: { awayScore: 120, homeScore: 115 },
      fun_score: 95.2,
      fantasyPoints: 46.2
    },
    game_date: '2025-11-03T00:00:00Z',
    title: 'Lakers vs Celtics'
  }
})
```

## Response

```json
{
  "success": true,
  "og_image_url": "https://...supabase.co/storage/v1/object/public/og-images/feed-posts/{post_id}.svg",
  "post_id": "post-uuid"
}
```

## Image Format

Currently generates **SVG** images (works for most platforms). If PNG is required:
- Option 1: Use Cloudinary to convert SVG → PNG
- Option 2: Add PNG conversion service
- Option 3: Use HTML/CSS rendering with image library

Most social platforms accept SVG for `og:image`.

## Troubleshooting

### Function not found
- Make sure it's deployed: `npx supabase functions deploy generate-og-image`
- Check you're calling the correct function name

### Storage upload fails
- Verify `og-images` bucket exists
- Check bucket is public or RLS allows access
- Verify service role key has storage permissions

### Images not showing in preview
- Check the image URL is accessible
- Verify `share_image_url` is updated in database
- Clear platform cache (24+ hour cache on iMessage/WhatsApp)

