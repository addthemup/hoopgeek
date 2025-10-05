-- Create missing tables for the league system
-- Run this in your Supabase SQL editor

-- Create draft_order table if it doesn't exist
CREATE TABLE IF NOT EXISTS draft_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  team_position INTEGER NOT NULL,
  player_id INTEGER REFERENCES players(id),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create league_states table if it doesn't exist
CREATE TABLE IF NOT EXISTS league_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  current_phase TEXT CHECK (current_phase IN ('setup', 'draft', 'regular_season', 'playoffs', 'completed')) DEFAULT 'setup',
  current_week INTEGER DEFAULT 0,
  current_season INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create league_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS league_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  draft_type TEXT CHECK (draft_type IN ('snake', 'linear', 'auction')) DEFAULT 'snake',
  draft_rounds INTEGER DEFAULT 15,
  roster_positions JSONB DEFAULT '{
    "PG": 1,
    "SG": 1,
    "SF": 1,
    "PF": 1,
    "C": 1,
    "G": 1,
    "F": 1,
    "UTIL": 1,
    "BENCH": 3
  }',
  scoring_categories JSONB DEFAULT '{
    "points": 1,
    "rebounds": 1,
    "assists": 1,
    "steals": 1,
    "blocks": 1,
    "turnovers": -1,
    "field_goal_percentage": 0,
    "free_throw_percentage": 0,
    "three_point_percentage": 0,
    "three_pointers_made": 1,
    "double_doubles": 2,
    "triple_doubles": 5
  }',
  waiver_wire BOOLEAN DEFAULT TRUE,
  waiver_period_days INTEGER DEFAULT 2,
  max_trades_per_team INTEGER DEFAULT 10,
  max_adds_per_team INTEGER DEFAULT 50,
  playoff_teams INTEGER DEFAULT 6,
  playoff_weeks INTEGER DEFAULT 3,
  playoff_start_week INTEGER DEFAULT 20,
  keeper_league BOOLEAN DEFAULT FALSE,
  max_keepers INTEGER DEFAULT 0,
  public_league BOOLEAN DEFAULT FALSE,
  allow_duplicate_players BOOLEAN DEFAULT FALSE,
  lineup_deadline TEXT DEFAULT 'daily',
  lineup_lock_time TEXT DEFAULT '00:00',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on the new tables
ALTER TABLE draft_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_draft_order_league_id ON draft_order(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_order_round_pick ON draft_order(league_id, round, pick_number);
CREATE INDEX IF NOT EXISTS idx_league_states_league_id ON league_states(league_id);
CREATE INDEX IF NOT EXISTS idx_league_settings_league_id ON league_settings(league_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to league_states
CREATE TRIGGER update_league_states_updated_at BEFORE UPDATE ON league_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
