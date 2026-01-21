-- ============================================================================
-- ADD PER-TAB VISIBILITY TO TODAY_MODULE_VISIBILITY
-- ============================================================================
-- Adds a JSON field to store visibility settings for each tab (past, present, future, weekly)
-- Also adds 'best_games' to the valid_module_name constraint for weekly modules
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE public.today_module_visibility
DROP CONSTRAINT IF EXISTS valid_module_name;

-- Recreate the constraint with all modules including weekly ones
ALTER TABLE public.today_module_visibility
ADD CONSTRAINT valid_module_name CHECK (module_name IN (
  'games_carousel',
  'prop_predictions',     -- For present/today dates
  'prop_performance',     -- For past dates
  'standings',
  'favorite_players',
  'team_of_night',        -- Keep for backward compatibility
  'team_of_night_live',   -- Live team of the night
  'team_of_night_past',   -- Past team of the night
  'leaders',
  'team_of_week',         -- Weekly module
  'best_games',           -- Weekly module
  'injuries'
));

-- Add visibility_by_tab JSONB column to store per-tab visibility
ALTER TABLE public.today_module_visibility
ADD COLUMN IF NOT EXISTS visibility_by_tab JSONB DEFAULT '{"past": true, "present": true, "future": true, "weekly": true}'::jsonb;

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_today_module_visibility_visibility_by_tab 
ON public.today_module_visibility USING GIN (visibility_by_tab);

-- Migrate existing is_visible values to visibility_by_tab
-- Set all tabs to the current is_visible value
UPDATE public.today_module_visibility
SET visibility_by_tab = jsonb_build_object(
  'past', is_visible,
  'present', is_visible,
  'future', is_visible,
  'weekly', is_visible
)
WHERE visibility_by_tab IS NULL OR visibility_by_tab = '{"past": true, "present": true, "future": true, "weekly": true}'::jsonb;
