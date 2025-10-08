-- Migration to add weekly lineup support
-- This adds the necessary fields to track lineups per week

-- Add week and season tracking to fantasy_team_players
ALTER TABLE fantasy_team_players 
ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS season_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
ADD COLUMN IF NOT EXISTS is_active_lineup BOOLEAN DEFAULT true;

-- Create a new table specifically for weekly lineups
CREATE TABLE IF NOT EXISTS weekly_lineups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  lineup_data JSONB NOT NULL, -- Store the complete lineup configuration
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(fantasy_team_id, week_number, season_year)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_week ON fantasy_team_players(fantasy_team_id, week_number, season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_active ON fantasy_team_players(is_active_lineup);
CREATE INDEX IF NOT EXISTS idx_weekly_lineups_team_week ON weekly_lineups(fantasy_team_id, week_number, season_year);
CREATE INDEX IF NOT EXISTS idx_weekly_lineups_week ON weekly_lineups(week_number, season_year);

-- Enable RLS for weekly_lineups
ALTER TABLE weekly_lineups ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly_lineups
CREATE POLICY "Allow fantasy team owners to manage their weekly lineups" ON weekly_lineups
  FOR ALL USING (
    fantasy_team_id IN (
      SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to read weekly lineups" ON weekly_lineups
  FOR SELECT USING (
    fantasy_team_id IN (
      SELECT ft.id FROM fantasy_teams ft
      JOIN leagues l ON ft.league_id = l.id
      WHERE l.commissioner_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_weekly_lineups_updated_at 
    BEFORE UPDATE ON weekly_lineups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to save weekly lineup
CREATE OR REPLACE FUNCTION save_weekly_lineup(
  team_id_param UUID,
  week_num INTEGER,
  season_year_param INTEGER,
  lineup_data_param JSONB
)
RETURNS UUID AS $$
DECLARE
  lineup_id UUID;
BEGIN
  INSERT INTO weekly_lineups (
    fantasy_team_id,
    week_number,
    season_year,
    lineup_data
  ) VALUES (
    team_id_param,
    week_num,
    season_year_param,
    lineup_data_param
  )
  ON CONFLICT (fantasy_team_id, week_number, season_year)
  DO UPDATE SET
    lineup_data = EXCLUDED.lineup_data,
    updated_at = NOW()
  RETURNING id INTO lineup_id;
  
  RETURN lineup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get weekly lineup
CREATE OR REPLACE FUNCTION get_weekly_lineup(
  team_id_param UUID,
  week_num INTEGER,
  season_year_param INTEGER
)
RETURNS JSONB AS $$
DECLARE
  lineup_data JSONB;
BEGIN
  SELECT lineup_data INTO lineup_data
  FROM weekly_lineups
  WHERE fantasy_team_id = team_id_param
    AND week_number = week_num
    AND season_year = season_year_param;
  
  RETURN COALESCE(lineup_data, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION save_weekly_lineup TO authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_lineup TO authenticated;
