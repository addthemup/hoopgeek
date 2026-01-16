-- ============================================================================
-- Add OG Image URL to DFS Pools
-- ============================================================================
-- This migration adds support for storing OG image URLs in DFS pools.
-- The OG image is generated when a pool is created and used for social sharing.
-- ============================================================================

ALTER TABLE public.dfs_pools
  ADD COLUMN IF NOT EXISTS og_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.dfs_pools.og_image_url IS 'URL of the Open Graph image for social sharing. Generated automatically when pool is created.';

