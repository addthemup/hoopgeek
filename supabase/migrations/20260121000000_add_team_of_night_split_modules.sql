-- ============================================================================
-- ADD TEAM OF NIGHT SPLIT MODULES
-- ============================================================================
-- Adds 'team_of_night_live' and 'team_of_night_past' to the valid module names constraint
-- These replace the single 'team_of_night' module for better control
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE public.today_module_visibility
DROP CONSTRAINT IF EXISTS valid_module_name;

-- Recreate the constraint with the new module names included
ALTER TABLE public.today_module_visibility
ADD CONSTRAINT valid_module_name CHECK (module_name IN (
  'games_carousel',
  'prop_predictions',     -- For present/today dates
  'prop_performance',     -- New: For past dates
  'standings',
  'favorite_players',
  'team_of_night',        -- Keep for backward compatibility
  'team_of_night_live',   -- New: Live team of the night
  'team_of_night_past',   -- New: Past team of the night
  'leaders',
  'team_of_week',
  'injuries'
));

-- Insert default values for new modules if they don't exist
INSERT INTO public.today_module_visibility (module_name, is_visible, display_order, grid_size)
VALUES 
  ('prop_performance', true, 2, 8),     -- 2/3 width by default for past dates
  ('team_of_night_live', true, 5, 4),   -- 1/3 width by default
  ('team_of_night_past', true, 6, 12)   -- Full width by default
ON CONFLICT (module_name) DO NOTHING;

-- Update display_order for other modules to accommodate new ones
UPDATE public.today_module_visibility
SET display_order = 3
WHERE module_name = 'standings';

UPDATE public.today_module_visibility
SET display_order = 4
WHERE module_name = 'favorite_players';

UPDATE public.today_module_visibility
SET display_order = 7
WHERE module_name = 'leaders';

UPDATE public.today_module_visibility
SET display_order = 8
WHERE module_name = 'team_of_week';

UPDATE public.today_module_visibility
SET display_order = 9
WHERE module_name = 'injuries';
