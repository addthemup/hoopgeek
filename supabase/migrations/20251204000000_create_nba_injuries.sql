-- ============================================================================
-- NBA INJURIES TABLE
-- ============================================================================
-- This table stores NBA player injury information from free sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nba_injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Player Reference
  nba_player_id INTEGER NOT NULL REFERENCES nba_players(nba_player_id) ON DELETE CASCADE,
  player_id UUID REFERENCES nba_players(id) ON DELETE CASCADE,
  
  -- Injury Information
  injury_type TEXT, -- e.g., "Ankle", "Knee", "Shoulder"
  injury_description TEXT, -- Full description of the injury
  injury_status TEXT NOT NULL, -- "Out", "Questionable", "Probable", "Day-to-Day", "Healthy"
  date_injured DATE, -- When the injury occurred
  date_updated TIMESTAMPTZ DEFAULT now(), -- Last update time
  
  -- Game Impact
  games_missed INTEGER DEFAULT 0, -- Number of games missed
  expected_return_date DATE, -- Expected return date if available
  
  -- Source Information
  source TEXT DEFAULT 'nba_api', -- Source of the data: 'nba_api', 'balldontlie', 'scraped'
  source_url TEXT, -- URL where the injury was found
  raw_data JSONB, -- Store raw API response for reference
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Note: We allow multiple injury records per player (one per update)
-- Use date_updated for tracking when injury status changed
-- Query latest status using: SELECT DISTINCT ON (nba_player_id) ... ORDER BY date_updated DESC

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nba_injuries_nba_player ON nba_injuries(nba_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_injuries_player_id ON nba_injuries(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nba_injuries_status ON nba_injuries(injury_status);
CREATE INDEX IF NOT EXISTS idx_nba_injuries_date_updated ON nba_injuries(date_updated DESC);
CREATE INDEX IF NOT EXISTS idx_nba_injuries_active ON nba_injuries(nba_player_id, date_updated DESC) 
  WHERE injury_status IN ('Out', 'Questionable', 'Day-to-Day');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_nba_injuries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_nba_injuries_updated_at
  BEFORE UPDATE ON nba_injuries
  FOR EACH ROW
  EXECUTE FUNCTION update_nba_injuries_updated_at();

-- ============================================================================
-- VIEW: Active Injuries
-- ============================================================================
-- View to easily query currently injured players
CREATE OR REPLACE VIEW active_injuries AS
SELECT DISTINCT ON (nba_player_id)
  i.*,
  p.name as player_name,
  p.position,
  p.team_abbreviation,
  p.team_name
FROM nba_injuries i
JOIN nba_players p ON i.nba_player_id = p.nba_player_id
WHERE i.injury_status IN ('Out', 'Questionable', 'Day-to-Day')
ORDER BY i.nba_player_id, i.date_updated DESC;

