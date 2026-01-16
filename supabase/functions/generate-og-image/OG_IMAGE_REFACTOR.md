# OG Image Generator Refactor

## Overview

The OG image generation system has been refactored to:
1. **Isolate shared utilities** - Extract common functionality into a reusable module
2. **Support multiple content types** - Feed posts and DFS pools (with extensibility for future types)

## Architecture

### File Structure

```
supabase/functions/generate-og-image/
├── index.ts                    # Main Edge Function handler
├── og-image-utils.ts           # Shared utilities (team colors, logos, image fetching, etc.)
├── dfs-pool-generator.ts       # DFS pool OG image generator
└── README.md                   # Original documentation
```

### Shared Utilities (`og-image-utils.ts`)

Contains reusable functions used across all OG image generators:
- Team colors and IDs
- Logo and avatar URL generation
- Image fetching and base64 conversion
- HTML/XML escaping
- Date formatting
- Fantasy points calculation
- Standard OG image dimensions (1200x630)

### Feed Post Generator

The existing feed post OG image generation logic remains in `index.ts` but now uses shared utilities:
- Game posts (team vs team)
- Player posts (player highlights)
- Fun score posts (with top 5 fantasy scorers)

### DFS Pool Generator (`dfs-pool-generator.ts`)

New generator for DFS pool join links:
- Displays pool name, entry fee, prize pool
- Shows current entries / max entries
- Displays difficulty tier with color coding
- Shows lock time
- Includes team logos from games in the pool
- Professional card-style design

## API Usage

### Feed Posts (Existing)

```typescript
POST /functions/v1/generate-og-image
{
  "post_id": "uuid",
  "team_tricodes": ["LAL", "BOS"],
  "player_ids": [123],
  "metadata": {...},
  "game_date": "2025-01-15",
  "title": "Post Title"
}
```

### DFS Pools (New)

```typescript
POST /functions/v1/generate-og-image
{
  "pool_id": "uuid"
}
```

The function will:
1. Fetch pool data from `dfs_pools` table
2. Fetch pool games from `dfs_pool_games` table
3. Generate SVG OG image
4. Upload to `og-images/dfs-pools/{poolId}.svg`
5. Return public URL

## Storage Structure

```
og-images/
├── feed-posts/
│   └── {post_id}.svg
└── dfs-pools/
    └── {pool_id}.svg
```

## Cloudflare Worker Integration

The Cloudflare Worker (`cloudflare-worker-meta-tags/meta-injector.js`) has been updated to:
1. Call the Edge Function to generate OG images for DFS pools on-demand
2. Use the generated image URL in meta tags
3. Fall back to a default image if generation fails

## Benefits

1. **Code Reusability** - Shared utilities eliminate duplication
2. **Maintainability** - Changes to team colors/logos only need to be made once
3. **Extensibility** - Easy to add new OG image generators (e.g., player profiles, game pages)
4. **Consistency** - All OG images use the same base utilities and dimensions
5. **Performance** - Images are cached in Supabase Storage

## Future Enhancements

Potential additions:
- Player profile OG images
- Game page OG images
- League/team page OG images
- PNG conversion for better compatibility
- Image optimization/caching strategies

