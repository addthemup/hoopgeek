-- ============================================================================
-- TODAY PAGE MODULE VISIBILITY
-- ============================================================================
-- This table stores visibility settings for modules on the /today page
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.today_module_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL UNIQUE,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_module_name CHECK (module_name IN (
    'games_carousel',
    'prop_predictions',
    'standings',
    'favorite_players',
    'team_of_night',
    'leaders',
    'team_of_week'
  ))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_today_module_visibility_module_name ON public.today_module_visibility(module_name);
CREATE INDEX IF NOT EXISTS idx_today_module_visibility_display_order ON public.today_module_visibility(display_order);

-- Enable RLS
ALTER TABLE public.today_module_visibility ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read (for Today page to check visibility)
-- This must come first and be permissive
CREATE POLICY "Public can read module visibility"
  ON public.today_module_visibility
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert
CREATE POLICY "Admins can insert module visibility"
  ON public.today_module_visibility
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Policy: Only admins can update
CREATE POLICY "Admins can update module visibility"
  ON public.today_module_visibility
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_today_module_visibility_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_today_module_visibility_timestamp
  BEFORE UPDATE ON public.today_module_visibility
  FOR EACH ROW
  EXECUTE FUNCTION update_today_module_visibility_updated_at();

-- Insert default values (all modules visible)
INSERT INTO public.today_module_visibility (module_name, is_visible, display_order)
VALUES
  ('games_carousel', true, 0),
  ('prop_predictions', true, 1),
  ('standings', true, 2),
  ('favorite_players', true, 3),
  ('team_of_night', true, 4),
  ('leaders', true, 5),
  ('team_of_week', true, 6)
ON CONFLICT (module_name) DO NOTHING;

