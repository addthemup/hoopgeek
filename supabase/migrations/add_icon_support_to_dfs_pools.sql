-- ============================================================================
-- Add Icon Support to DFS Pools
-- ============================================================================
-- This migration adds support for React Icons in DFS pools:
-- - icon_name: Name of the React Icon (e.g., "FaBasketballBall", "MdSportsBasketball")
-- - html_color_primary: Primary color for the icon (hex code)
-- - html_color_secondary: Secondary color for the icon (hex code)

ALTER TABLE public.dfs_pools
  ADD COLUMN IF NOT EXISTS icon_name TEXT,
  ADD COLUMN IF NOT EXISTS html_color_primary TEXT DEFAULT '#FFC72C',
  ADD COLUMN IF NOT EXISTS html_color_secondary TEXT DEFAULT '#000000';

-- Add comment for documentation
COMMENT ON COLUMN public.dfs_pools.icon_name IS 'React Icon name from react-icons library (e.g., FaBasketballBall, MdSportsBasketball)';
COMMENT ON COLUMN public.dfs_pools.html_color_primary IS 'Primary color for the icon in hex format (e.g., #FFC72C)';
COMMENT ON COLUMN public.dfs_pools.html_color_secondary IS 'Secondary color for the icon in hex format (e.g., #000000)';

