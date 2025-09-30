-- Reorganize database schema to separate NBA teams from fantasy teams
-- This migration creates proper separation between NBA data and fantasy league data

-- 1. Create NBA teams table for actual NBA teams
CREATE TABLE IF NOT EXISTS nba_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nba_team_id INTEGER UNIQUE NOT NULL,
    team_name TEXT NOT NULL,
    team_abbreviation TEXT NOT NULL,
    team_city TEXT,
    team_code TEXT,
    conference TEXT,
    division TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Rename existing teams table to fantasy_teams for clarity
ALTER TABLE teams RENAME TO fantasy_teams;

-- 3. Update players table to reference nba_teams instead of team_id
-- First, add new columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS nba_team_id INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS nba_team_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS nba_team_abbreviation TEXT;

-- 4. Update player_season_stats to reference nba_teams
ALTER TABLE player_season_stats ADD COLUMN IF NOT EXISTS nba_team_id INTEGER;
ALTER TABLE player_season_stats ADD COLUMN IF NOT EXISTS nba_team_name TEXT;
ALTER TABLE player_season_stats ADD COLUMN IF NOT EXISTS nba_team_abbreviation TEXT;

-- 5. Update player_game_logs to reference nba_teams
ALTER TABLE player_game_logs ADD COLUMN IF NOT EXISTS nba_team_id INTEGER;
ALTER TABLE player_game_logs ADD COLUMN IF NOT EXISTS nba_team_name TEXT;
ALTER TABLE player_game_logs ADD COLUMN IF NOT EXISTS nba_team_abbreviation TEXT;

-- 6. Update player_career_stats to reference nba_teams
ALTER TABLE player_career_stats ADD COLUMN IF NOT EXISTS nba_team_id INTEGER;
ALTER TABLE player_career_stats ADD COLUMN IF NOT EXISTS nba_team_name TEXT;
ALTER TABLE player_career_stats ADD COLUMN IF NOT EXISTS nba_team_abbreviation TEXT;

-- 7. Update games table to reference nba_teams
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_team_nba_id INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_team_nba_id INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_team_name TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_team_name TEXT;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nba_teams_nba_team_id ON nba_teams(nba_team_id);
CREATE INDEX IF NOT EXISTS idx_nba_teams_abbreviation ON nba_teams(team_abbreviation);
CREATE INDEX IF NOT EXISTS idx_players_nba_team_id ON players(nba_team_id);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_nba_team_id ON player_season_stats(nba_team_id);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_nba_team_id ON player_game_logs(nba_team_id);
CREATE INDEX IF NOT EXISTS idx_games_home_team_nba_id ON games(home_team_nba_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team_nba_id ON games(away_team_nba_id);

-- 9. Create RLS policies for nba_teams (public read access)
ALTER TABLE nba_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "NBA teams are publicly readable" ON nba_teams
    FOR SELECT USING (true);

-- 10. Update RLS policies for fantasy_teams (renamed from teams)
DROP POLICY IF EXISTS "Users can view teams in their leagues" ON fantasy_teams;
DROP POLICY IF EXISTS "Users can create teams in their leagues" ON fantasy_teams;
DROP POLICY IF EXISTS "Users can update their own teams" ON fantasy_teams;
DROP POLICY IF EXISTS "Users can delete their own teams" ON fantasy_teams;

CREATE POLICY "Users can view fantasy teams in their leagues" ON fantasy_teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM league_members lm
            WHERE lm.league_id = fantasy_teams.league_id
            AND lm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create fantasy teams in their leagues" ON fantasy_teams
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM league_members lm
            WHERE lm.league_id = fantasy_teams.league_id
            AND lm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own fantasy teams" ON fantasy_teams
    FOR UPDATE USING (
        owner_id = auth.uid()
    );

CREATE POLICY "Users can delete their own fantasy teams" ON fantasy_teams
    FOR DELETE USING (
        owner_id = auth.uid()
    );

-- 11. Create function to populate NBA teams (we'll run this separately)
CREATE OR REPLACE FUNCTION populate_nba_teams()
RETURNS void AS $$
BEGIN
    -- Insert NBA teams data
    INSERT INTO nba_teams (nba_team_id, team_name, team_abbreviation, team_city, team_code, conference, division) VALUES
    (1610612737, 'Atlanta Hawks', 'ATL', 'Atlanta', 'hawks', 'Eastern', 'Southeast'),
    (1610612738, 'Boston Celtics', 'BOS', 'Boston', 'celtics', 'Eastern', 'Atlantic'),
    (1610612739, 'Cleveland Cavaliers', 'CLE', 'Cleveland', 'cavaliers', 'Eastern', 'Central'),
    (1610612740, 'New Orleans Pelicans', 'NOP', 'New Orleans', 'pelicans', 'Western', 'Southwest'),
    (1610612741, 'Chicago Bulls', 'CHI', 'Chicago', 'bulls', 'Eastern', 'Central'),
    (1610612742, 'Dallas Mavericks', 'DAL', 'Dallas', 'mavericks', 'Western', 'Southwest'),
    (1610612743, 'Denver Nuggets', 'DEN', 'Denver', 'nuggets', 'Western', 'Northwest'),
    (1610612744, 'Golden State Warriors', 'GSW', 'San Francisco', 'warriors', 'Western', 'Pacific'),
    (1610612745, 'Houston Rockets', 'HOU', 'Houston', 'rockets', 'Western', 'Southwest'),
    (1610612746, 'LA Clippers', 'LAC', 'Los Angeles', 'clippers', 'Western', 'Pacific'),
    (1610612747, 'Los Angeles Lakers', 'LAL', 'Los Angeles', 'lakers', 'Western', 'Pacific'),
    (1610612748, 'Miami Heat', 'MIA', 'Miami', 'heat', 'Eastern', 'Southeast'),
    (1610612749, 'Milwaukee Bucks', 'MIL', 'Milwaukee', 'bucks', 'Eastern', 'Central'),
    (1610612750, 'Minnesota Timberwolves', 'MIN', 'Minneapolis', 'timberwolves', 'Western', 'Northwest'),
    (1610612751, 'Brooklyn Nets', 'BKN', 'Brooklyn', 'nets', 'Eastern', 'Atlantic'),
    (1610612752, 'New York Knicks', 'NYK', 'New York', 'knicks', 'Eastern', 'Atlantic'),
    (1610612753, 'Orlando Magic', 'ORL', 'Orlando', 'magic', 'Eastern', 'Southeast'),
    (1610612754, 'Indiana Pacers', 'IND', 'Indianapolis', 'pacers', 'Eastern', 'Central'),
    (1610612755, 'Philadelphia 76ers', 'PHI', 'Philadelphia', 'sixers', 'Eastern', 'Atlantic'),
    (1610612756, 'Phoenix Suns', 'PHX', 'Phoenix', 'suns', 'Western', 'Pacific'),
    (1610612757, 'Portland Trail Blazers', 'POR', 'Portland', 'blazers', 'Western', 'Northwest'),
    (1610612758, 'Sacramento Kings', 'SAC', 'Sacramento', 'kings', 'Western', 'Pacific'),
    (1610612759, 'San Antonio Spurs', 'SAS', 'San Antonio', 'spurs', 'Western', 'Southwest'),
    (1610612760, 'Oklahoma City Thunder', 'OKC', 'Oklahoma City', 'thunder', 'Western', 'Northwest'),
    (1610612761, 'Toronto Raptors', 'TOR', 'Toronto', 'raptors', 'Eastern', 'Atlantic'),
    (1610612762, 'Utah Jazz', 'UTA', 'Salt Lake City', 'jazz', 'Western', 'Northwest'),
    (1610612763, 'Memphis Grizzlies', 'MEM', 'Memphis', 'grizzlies', 'Western', 'Southwest'),
    (1610612764, 'Washington Wizards', 'WAS', 'Washington', 'wizards', 'Eastern', 'Southeast'),
    (1610612765, 'Detroit Pistons', 'DET', 'Detroit', 'pistons', 'Eastern', 'Central'),
    (1610612766, 'Charlotte Hornets', 'CHA', 'Charlotte', 'hornets', 'Eastern', 'Southeast')
    ON CONFLICT (nba_team_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 12. Create function to update player team references
CREATE OR REPLACE FUNCTION update_player_team_references()
RETURNS void AS $$
BEGIN
    -- Update players table with NBA team info
    UPDATE players 
    SET 
        nba_team_id = team_id,
        nba_team_name = team_name,
        nba_team_abbreviation = team_abbreviation
    WHERE team_id IS NOT NULL AND team_id > 0;
    
    -- Update player_season_stats table
    UPDATE player_season_stats 
    SET 
        nba_team_id = team_id,
        nba_team_name = team_name,
        nba_team_abbreviation = team_abbreviation
    WHERE team_id IS NOT NULL AND team_id > 0;
    
    -- Update player_game_logs table
    UPDATE player_game_logs 
    SET 
        nba_team_id = team_id,
        nba_team_name = team_name,
        nba_team_abbreviation = team_abbreviation
    WHERE team_id IS NOT NULL AND team_id > 0;
    
    -- Update player_career_stats table
    UPDATE player_career_stats 
    SET 
        nba_team_id = team_id,
        nba_team_name = team_name,
        nba_team_abbreviation = team_abbreviation
    WHERE team_id IS NOT NULL AND team_id > 0;
END;
$$ LANGUAGE plpgsql;

-- 13. Add comments for clarity
COMMENT ON TABLE nba_teams IS 'Official NBA teams data';
COMMENT ON TABLE fantasy_teams IS 'Fantasy league teams created by users';
COMMENT ON COLUMN players.nba_team_id IS 'Reference to nba_teams table';
COMMENT ON COLUMN players.team_id IS 'Legacy field - use nba_team_id instead';
COMMENT ON COLUMN fantasy_teams.league_id IS 'Reference to the fantasy league this team belongs to';
