-- Add team color columns to fantasy_teams table
-- This allows teams to customize their avatar appearance in matchup displays

ALTER TABLE fantasy_teams 
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#1E40AF';

-- Add comment explaining the columns
COMMENT ON COLUMN fantasy_teams.primary_color IS 'Primary team color for avatar displays (hex color code)';
COMMENT ON COLUMN fantasy_teams.secondary_color IS 'Secondary team color for avatar displays (hex color code)';

-- Update existing teams to have default colors if null
UPDATE fantasy_teams 
SET primary_color = '#3B82F6' 
WHERE primary_color IS NULL;

UPDATE fantasy_teams 
SET secondary_color = '#1E40AF' 
WHERE secondary_color IS NULL;

