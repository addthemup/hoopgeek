-- Create league system tables
-- This migration creates all the tables needed for the league initialization system

-- Core leagues table (update existing if needed)
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  commissioner_id UUID REFERENCES auth.users(id),
  max_teams INTEGER NOT NULL,
  draft_date TIMESTAMP,
  draft_status TEXT CHECK (draft_status IN ('scheduled', 'in_progress', 'completed')) DEFAULT 'scheduled',
  scoring_type TEXT DEFAULT 'head_to_head',
  lineup_frequency TEXT DEFAULT 'daily',
  salary_cap_enabled BOOLEAN DEFAULT FALSE,
  salary_cap_amount INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Detailed league settings
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

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  team_name TEXT NOT NULL,
  team_abbreviation TEXT,
  draft_position INTEGER,
  is_commissioner BOOLEAN DEFAULT FALSE,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ties INTEGER DEFAULT 0,
  points_for DECIMAL(10,2) DEFAULT 0,
  points_against DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Draft order table
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

-- League state tracking
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

-- League invitations (if not exists)
CREATE TABLE IF NOT EXISTS league_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  team_name TEXT,
  message TEXT
);

-- League members (if not exists)
CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  team_name TEXT NOT NULL,
  is_commissioner BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leagues_commissioner_id ON leagues(commissioner_id);
CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_draft_order_league_id ON draft_order(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_order_round_pick ON draft_order(league_id, round, pick_number);
CREATE INDEX IF NOT EXISTS idx_league_settings_league_id ON league_settings(league_id);
CREATE INDEX IF NOT EXISTS idx_league_states_league_id ON league_states(league_id);
CREATE INDEX IF NOT EXISTS idx_league_invitations_league_id ON league_invitations(league_id);
CREATE INDEX IF NOT EXISTS idx_league_invitations_email ON league_invitations(email);
CREATE INDEX IF NOT EXISTS idx_league_members_league_id ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user_id ON league_members(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Leagues: Users can read leagues they're members of, commissioners can manage their leagues
CREATE POLICY "Users can view leagues they're members of" ON leagues
  FOR SELECT USING (
    id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow commissioners to create leagues (this is needed for the initial creation)
CREATE POLICY "Commissioners can create leagues" ON leagues
  FOR INSERT WITH CHECK (commissioner_id = auth.uid());

-- Allow commissioners to update their leagues
CREATE POLICY "Commissioners can update their leagues" ON leagues
  FOR UPDATE USING (commissioner_id = auth.uid());

-- Allow commissioners to delete their leagues
CREATE POLICY "Commissioners can delete their leagues" ON leagues
  FOR DELETE USING (commissioner_id = auth.uid());

-- League settings: Same as leagues
CREATE POLICY "Users can view league settings for their leagues" ON league_settings
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow commissioners to create league settings
CREATE POLICY "Commissioners can create league settings" ON league_settings
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to update league settings
CREATE POLICY "Commissioners can update league settings" ON league_settings
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to delete league settings
CREATE POLICY "Commissioners can delete league settings" ON league_settings
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Teams: Users can view teams in their leagues, manage their own team
CREATE POLICY "Users can view teams in their leagues" ON teams
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow commissioners to create teams in their leagues
CREATE POLICY "Commissioners can create teams in their leagues" ON teams
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow users to update their own team
CREATE POLICY "Users can update their own team" ON teams
  FOR UPDATE USING (user_id = auth.uid());

-- Allow commissioners to update all teams in their leagues
CREATE POLICY "Commissioners can update all teams in their leagues" ON teams
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to delete teams in their leagues
CREATE POLICY "Commissioners can delete teams in their leagues" ON teams
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Draft order: Users can view draft order for their leagues
CREATE POLICY "Users can view draft order for their leagues" ON draft_order
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow commissioners to create draft order
CREATE POLICY "Commissioners can create draft order" ON draft_order
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to update draft order
CREATE POLICY "Commissioners can update draft order" ON draft_order
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to delete draft order
CREATE POLICY "Commissioners can delete draft order" ON draft_order
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- League states: Users can view league state for their leagues
CREATE POLICY "Users can view league state for their leagues" ON league_states
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow commissioners to create league state
CREATE POLICY "Commissioners can create league state" ON league_states
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to update league state
CREATE POLICY "Commissioners can update league state" ON league_states
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to delete league state
CREATE POLICY "Commissioners can delete league state" ON league_states
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- League invitations: Users can view invitations for their leagues, commissioners can manage
CREATE POLICY "Users can view invitations for their leagues" ON league_invitations
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow commissioners to create invitations
CREATE POLICY "Commissioners can create invitations" ON league_invitations
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to update invitations
CREATE POLICY "Commissioners can update invitations" ON league_invitations
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to delete invitations
CREATE POLICY "Commissioners can delete invitations" ON league_invitations
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- League members: Users can view members of their leagues, commissioners can manage
CREATE POLICY "Users can view league members" ON league_members
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow commissioners to create league members
CREATE POLICY "Commissioners can create league members" ON league_members
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to update league members
CREATE POLICY "Commissioners can update league members" ON league_members
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Allow commissioners to delete league members
CREATE POLICY "Commissioners can delete league members" ON league_members
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON leagues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_states_updated_at BEFORE UPDATE ON league_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
