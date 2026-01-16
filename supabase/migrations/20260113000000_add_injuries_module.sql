-- ============================================================================
-- ADD INJURIES MODULE TO TODAY_MODULE_VISIBILITY
-- ============================================================================
-- Adds 'injuries' module to the valid module names constraint
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE public.today_module_visibility
DROP CONSTRAINT IF EXISTS valid_module_name;

-- Recreate the constraint with 'injuries' included
ALTER TABLE public.today_module_visibility
ADD CONSTRAINT valid_module_name CHECK (module_name IN (
  'games_carousel',
  'prop_predictions',
  'standings',
  'favorite_players',
  'team_of_night',
  'leaders',
  'team_of_week',
  'injuries'
));

-- Insert default value for injuries module if it doesn't exist
INSERT INTO public.today_module_visibility (module_name, is_visible, display_order)
VALUES ('injuries', true, 6)
ON CONFLICT (module_name) DO NOTHING;

-- Update display_order for team_of_week to be after injuries
UPDATE public.today_module_visibility
SET display_order = 7
WHERE module_name = 'team_of_week';
