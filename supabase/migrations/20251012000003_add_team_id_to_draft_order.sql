-- Add team_id column to draft_order to support pick trading
-- This allows picks to be traded between teams

-- Add the column (nullable initially to allow existing data)
ALTER TABLE draft_order ADD COLUMN IF NOT EXISTS fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE;

-- Populate fantasy_team_id for existing draft orders
-- This matches team_position to the team's order in fantasy_teams
UPDATE draft_order
SET fantasy_team_id = (
  SELECT ft.id
  FROM fantasy_teams ft
  WHERE ft.league_id = draft_order.league_id
  ORDER BY ft.id
  LIMIT 1 OFFSET (draft_order.team_position - 1)
)
WHERE fantasy_team_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_draft_order_fantasy_team_id ON draft_order(fantasy_team_id);

-- Add comment
COMMENT ON COLUMN draft_order.fantasy_team_id IS 'The team that owns this pick (can change via trades)';

