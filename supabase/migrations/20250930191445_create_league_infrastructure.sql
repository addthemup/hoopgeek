-- HoopGeek Fantasy Basketball League Infrastructure
-- Complete league system with modern features

-- Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  commissioner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  max_teams INTEGER NOT NULL DEFAULT 10 CHECK (max_teams >= 4 AND max_teams <= 20),
  scoring_type TEXT NOT NULL DEFAULT 'H2H_Points' CHECK (scoring_type IN (
    'Roto', 'H2H_Points', 'H2H_Category', 'H2H_Most_Categories', 'Season_Points'
  )),
  draft_type TEXT NOT NULL DEFAULT 'snake' CHECK (draft_type IN ('snake', 'linear')),
  draft_date TIMESTAMP WITH TIME ZONE,
  draft_status TEXT NOT NULL DEFAULT 'scheduled' CHECK (draft_status IN (
    'scheduled', 'in_progress', 'completed', 'cancelled'
  )),
  salary_cap BIGINT DEFAULT 100000000, -- $100M default salary cap
  is_public BOOLEAN DEFAULT false,
  invite_code TEXT UNIQUE,
  season_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create league_members table
CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  draft_order INTEGER,
  is_commissioner BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, user_id),
  UNIQUE(league_id, team_name)
);

-- Create teams table (user rosters)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  salary_cap_used BIGINT DEFAULT 0,
  salary_cap_max BIGINT DEFAULT 100000000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

-- Create team_players table (roster composition)
CREATE TABLE IF NOT EXISTS team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL')),
  is_starter BOOLEAN DEFAULT false,
  is_injured BOOLEAN DEFAULT false,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, player_id)
);

-- Create draft_picks table
CREATE TABLE IF NOT EXISTS draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL,
  round INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, pick_number)
);

-- Create league_invitations table
CREATE TABLE IF NOT EXISTS league_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Create weekly_matchups table
CREATE TABLE IF NOT EXISTS weekly_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  team1_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  team2_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  team1_score DECIMAL(10,2) DEFAULT 0,
  team2_score DECIMAL(10,2) DEFAULT 0,
  winner_id UUID REFERENCES teams(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, team1_id, team2_id, week_number, season_year)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leagues_commissioner ON leagues(commissioner_id);
CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON leagues(invite_code);
CREATE INDEX IF NOT EXISTS idx_leagues_public ON leagues(is_public);
CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_league ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_teams_user ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_team_players_team ON team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_team_players_player ON team_players(player_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_league ON draft_picks(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_team ON draft_picks(team_id);
CREATE INDEX IF NOT EXISTS idx_league_invitations_league ON league_invitations(league_id);
CREATE INDEX IF NOT EXISTS idx_league_invitations_token ON league_invitations(token);
CREATE INDEX IF NOT EXISTS idx_weekly_matchups_league ON weekly_matchups(league_id);
CREATE INDEX IF NOT EXISTS idx_weekly_matchups_week ON weekly_matchups(week_number, season_year);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_leagues_updated_at 
    BEFORE UPDATE ON leagues 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at 
    BEFORE UPDATE ON teams 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_matchups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for leagues
CREATE POLICY "Allow all users to read public leagues" ON leagues
  FOR SELECT USING (is_public = true);

CREATE POLICY "Allow league members to read their leagues" ON leagues
  FOR SELECT USING (
    id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow authenticated users to create leagues" ON leagues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow commissioners to update their leagues" ON leagues
  FOR UPDATE USING (commissioner_id = auth.uid());

-- Create RLS policies for league_members
CREATE POLICY "Allow league members to read league members" ON league_members
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to join leagues" ON league_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users to leave leagues" ON league_members
  FOR DELETE USING (user_id = auth.uid());

-- Create RLS policies for teams
CREATE POLICY "Allow team owners to manage their teams" ON teams
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Allow league members to read teams in their leagues" ON teams
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for team_players
CREATE POLICY "Allow team owners to manage their players" ON team_players
  FOR ALL USING (
    team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to read team players" ON team_players
  FOR SELECT USING (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON t.league_id = lm.league_id
      WHERE lm.user_id = auth.uid()
    )
  );

-- Create RLS policies for draft_picks
CREATE POLICY "Allow league members to read draft picks" ON draft_picks
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to manage draft picks" ON draft_picks
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues WHERE commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for league_invitations
CREATE POLICY "Allow commissioners to manage invitations" ON league_invitations
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to read their invitations" ON league_invitations
  FOR SELECT USING (email = auth.jwt() ->> 'email');

-- Create RLS policies for weekly_matchups
CREATE POLICY "Allow league members to read matchups" ON weekly_matchups
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

-- Create function to generate invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
BEGIN
  RETURN upper(substring(md5(random()::text) from 1 for 8));
END;
$$ LANGUAGE plpgsql;

-- Create function to create league with commissioner
CREATE OR REPLACE FUNCTION create_league_with_commissioner(
  league_name TEXT,
  league_description TEXT DEFAULT NULL,
  max_teams_count INTEGER DEFAULT 10,
  scoring_type_val TEXT DEFAULT 'H2H_Points',
  team_name_val TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_league_id UUID;
  new_team_id UUID;
  invite_code_val TEXT;
BEGIN
  -- Generate unique invite code
  LOOP
    invite_code_val := generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM leagues WHERE invite_code = invite_code_val);
  END LOOP;

  -- Create league
  INSERT INTO leagues (name, description, commissioner_id, max_teams, scoring_type, invite_code)
  VALUES (league_name, league_description, auth.uid(), max_teams_count, scoring_type_val, invite_code_val)
  RETURNING id INTO new_league_id;

  -- Add commissioner as league member
  INSERT INTO league_members (league_id, user_id, team_name, is_commissioner)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'), true);

  -- Create team for commissioner
  INSERT INTO teams (league_id, user_id, name)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'))
  RETURNING id INTO new_team_id;

  RETURN new_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
