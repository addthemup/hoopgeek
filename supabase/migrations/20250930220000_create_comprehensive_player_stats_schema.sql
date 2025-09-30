-- Comprehensive NBA Player Stats Schema
-- This migration creates tables for storing detailed player statistics

-- Player Game Logs Table
CREATE TABLE IF NOT EXISTS player_game_logs (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    game_id VARCHAR(50) NOT NULL,
    game_date DATE NOT NULL,
    matchup VARCHAR(20) NOT NULL, -- e.g., "LAL @ GSW"
    wl CHAR(1), -- W or L
    min INTEGER, -- Minutes played
    fgm INTEGER, -- Field goals made
    fga INTEGER, -- Field goals attempted
    fg_pct DECIMAL(5,3), -- Field goal percentage
    fg3m INTEGER, -- 3-pointers made
    fg3a INTEGER, -- 3-pointers attempted
    fg3_pct DECIMAL(5,3), -- 3-point percentage
    ftm INTEGER, -- Free throws made
    fta INTEGER, -- Free throws attempted
    ft_pct DECIMAL(5,3), -- Free throw percentage
    oreb INTEGER, -- Offensive rebounds
    dreb INTEGER, -- Defensive rebounds
    reb INTEGER, -- Total rebounds
    ast INTEGER, -- Assists
    stl INTEGER, -- Steals
    blk INTEGER, -- Blocks
    tov INTEGER, -- Turnovers
    pf INTEGER, -- Personal fouls
    pts INTEGER, -- Points
    plus_minus INTEGER, -- Plus/minus
    fantasy_pts DECIMAL(6,2), -- Fantasy points (calculated)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, game_id)
);

-- Player Season Stats Table
CREATE TABLE IF NOT EXISTS player_season_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    season VARCHAR(10) NOT NULL, -- e.g., "2023-24"
    team_id BIGINT,
    team_name VARCHAR(50),
    team_abbreviation VARCHAR(10),
    age INTEGER,
    gp INTEGER, -- Games played
    gs INTEGER, -- Games started
    min_per_game DECIMAL(5,2), -- Minutes per game
    fgm_per_game DECIMAL(5,2),
    fga_per_game DECIMAL(5,2),
    fg_pct DECIMAL(5,3),
    fg3m_per_game DECIMAL(5,2),
    fg3a_per_game DECIMAL(5,2),
    fg3_pct DECIMAL(5,3),
    ftm_per_game DECIMAL(5,2),
    fta_per_game DECIMAL(5,2),
    ft_pct DECIMAL(5,3),
    oreb_per_game DECIMAL(5,2),
    dreb_per_game DECIMAL(5,2),
    reb_per_game DECIMAL(5,2),
    ast_per_game DECIMAL(5,2),
    stl_per_game DECIMAL(5,2),
    blk_per_game DECIMAL(5,2),
    tov_per_game DECIMAL(5,2),
    pf_per_game DECIMAL(5,2),
    pts_per_game DECIMAL(5,2),
    plus_minus_per_game DECIMAL(5,2),
    fantasy_pts_per_game DECIMAL(6,2),
    -- Totals
    total_min INTEGER,
    total_fgm INTEGER,
    total_fga INTEGER,
    total_fg3m INTEGER,
    total_fg3a INTEGER,
    total_ftm INTEGER,
    total_fta INTEGER,
    total_oreb INTEGER,
    total_dreb INTEGER,
    total_reb INTEGER,
    total_ast INTEGER,
    total_stl INTEGER,
    total_blk INTEGER,
    total_tov INTEGER,
    total_pf INTEGER,
    total_pts INTEGER,
    total_fantasy_pts DECIMAL(8,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season)
);

-- Player Career Stats Table
CREATE TABLE IF NOT EXISTS player_career_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    seasons_played INTEGER,
    total_gp INTEGER,
    total_gs INTEGER,
    total_min INTEGER,
    total_fgm INTEGER,
    total_fga INTEGER,
    career_fg_pct DECIMAL(5,3),
    total_fg3m INTEGER,
    total_fg3a INTEGER,
    career_fg3_pct DECIMAL(5,3),
    total_ftm INTEGER,
    total_fta INTEGER,
    career_ft_pct DECIMAL(5,3),
    total_oreb INTEGER,
    total_dreb INTEGER,
    total_reb INTEGER,
    total_ast INTEGER,
    total_stl INTEGER,
    total_blk INTEGER,
    total_tov INTEGER,
    total_pf INTEGER,
    total_pts INTEGER,
    total_fantasy_pts DECIMAL(10,2),
    -- Career averages
    career_min_per_game DECIMAL(5,2),
    career_fgm_per_game DECIMAL(5,2),
    career_fga_per_game DECIMAL(5,2),
    career_fg3m_per_game DECIMAL(5,2),
    career_fg3a_per_game DECIMAL(5,2),
    career_ftm_per_game DECIMAL(5,2),
    career_fta_per_game DECIMAL(5,2),
    career_oreb_per_game DECIMAL(5,2),
    career_dreb_per_game DECIMAL(5,2),
    career_reb_per_game DECIMAL(5,2),
    career_ast_per_game DECIMAL(5,2),
    career_stl_per_game DECIMAL(5,2),
    career_blk_per_game DECIMAL(5,2),
    career_tov_per_game DECIMAL(5,2),
    career_pf_per_game DECIMAL(5,2),
    career_pts_per_game DECIMAL(5,2),
    career_fantasy_pts_per_game DECIMAL(6,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id)
);

-- Games Table (for reference)
CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,
    game_id VARCHAR(50) UNIQUE NOT NULL,
    game_date DATE NOT NULL,
    season VARCHAR(10) NOT NULL,
    season_type VARCHAR(20) NOT NULL, -- Regular Season, Playoffs, etc.
    home_team_id BIGINT,
    home_team_name VARCHAR(50),
    home_team_abbreviation VARCHAR(10),
    away_team_id BIGINT,
    away_team_name VARCHAR(50),
    away_team_abbreviation VARCHAR(10),
    home_score INTEGER,
    away_score INTEGER,
    status VARCHAR(20), -- Final, In Progress, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_game_logs_player_id ON player_game_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_game_date ON player_game_logs(game_date);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_season ON player_game_logs(game_date);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_player_season ON player_season_stats(player_id, season);
CREATE INDEX IF NOT EXISTS idx_player_career_stats_player_id ON player_career_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_games_game_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_season ON games(season);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_player_game_logs_updated_at BEFORE UPDATE ON player_game_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_season_stats_updated_at BEFORE UPDATE ON player_season_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_career_stats_updated_at BEFORE UPDATE ON player_career_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE player_game_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_career_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all stats data
CREATE POLICY "Allow authenticated users to read player stats" ON player_game_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read season stats" ON player_season_stats
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read career stats" ON player_career_stats
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read games" ON games
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage all stats data
CREATE POLICY "Allow service role to manage player stats" ON player_game_logs
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow service role to manage season stats" ON player_season_stats
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow service role to manage career stats" ON player_career_stats
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow service role to manage games" ON games
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
