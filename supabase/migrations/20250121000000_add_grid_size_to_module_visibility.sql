-- ============================================================================
-- ADD GRID SIZE TO MODULE VISIBILITY
-- ============================================================================
-- Add grid_size column to allow custom grid layouts
-- Grid sizes: 4 (1/3 width), 8 (2/3 width), 12 (full width)
-- ============================================================================

ALTER TABLE public.today_module_visibility 
ADD COLUMN IF NOT EXISTS grid_size INTEGER NOT NULL DEFAULT 4;

-- Update existing modules with default grid sizes based on current layout
UPDATE public.today_module_visibility
SET grid_size = CASE
  WHEN module_name = 'games_carousel' THEN 12  -- Full width (in header)
  WHEN module_name = 'prop_predictions' THEN 8  -- 2/3 width
  WHEN module_name = 'standings' THEN 4        -- 1/3 width
  WHEN module_name = 'favorite_players' THEN 4 -- 1/3 width
  WHEN module_name = 'team_of_night' THEN 8    -- 2/3 width (past) or 4 (live)
  WHEN module_name = 'leaders' THEN 4           -- 1/3 width
  WHEN module_name = 'team_of_week' THEN 8    -- 2/3 width
  ELSE 4
END
WHERE grid_size = 4; -- Only update if still at default

-- Add constraint to ensure valid grid sizes
ALTER TABLE public.today_module_visibility
ADD CONSTRAINT valid_grid_size CHECK (grid_size IN (4, 8, 12));

