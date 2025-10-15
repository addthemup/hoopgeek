-- NBA Box Scores Table
-- This table stores individual player game statistics (box scores) for NBA games

-- Create nba_boxscores table
CREATE TABLE IF NOT EXISTS nba_boxscores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Player Information
    player_id UUID, -- Foreign key to nba_players table
    nba_player_id INTEGER NOT NULL, -- NBA API player ID
    player_name VARCHAR(200) NOT NULL,
    
    -- Game Information
    game_id VARCHAR(50) NOT NULL, -- Foreign key to nba_games table
    game_date DATE NOT NULL,
    season_year VARCHAR(10) NOT NULL, -- e.g., '2025-26'
    matchup VARCHAR(100), -- e.g., "LAL @ GSW"
    
    -- Player Game Details
    jersey_num INTEGER,
    "position" VARCHAR(10), -- PG, SG, SF, PF, C, etc.
    
    -- Team Information
    team_id INTEGER NOT NULL, -- NBA API team ID
    team_abbreviation VARCHAR(10),
    team_name VARCHAR(100),
    team_city VARCHAR(100),
    team_tricode VARCHAR(10),
    
    -- Playing Time
    min DECIMAL(5,2), -- Minutes played (can be decimal for partial minutes)
    
    -- Field Goals
    fgm INTEGER DEFAULT 0, -- Field Goals Made
    fga INTEGER DEFAULT 0, -- Field Goals Attempted
    fg_pct DECIMAL(5,3), -- Field Goal Percentage
    
    -- Three Pointers
    fg3m INTEGER DEFAULT 0, -- Three Pointers Made
    fg3a INTEGER DEFAULT 0, -- Three Pointers Attempted
    fg3_pct DECIMAL(5,3), -- Three Point Percentage
    
    -- Free Throws
    ftm INTEGER DEFAULT 0, -- Free Throws Made
    fta INTEGER DEFAULT 0, -- Free Throws Attempted
    ft_pct DECIMAL(5,3), -- Free Throw Percentage
    
    -- Rebounds
    oreb INTEGER DEFAULT 0, -- Offensive Rebounds
    dreb INTEGER DEFAULT 0, -- Defensive Rebounds
    reb INTEGER DEFAULT 0, -- Total Rebounds
    
    -- Other Statistics
    ast INTEGER DEFAULT 0, -- Assists
    stl INTEGER DEFAULT 0, -- Steals
    blk INTEGER DEFAULT 0, -- Blocks
    tov INTEGER DEFAULT 0, -- Turnovers
    fouls_personal INTEGER DEFAULT 0, -- Personal Fouls
    pts INTEGER DEFAULT 0, -- Points
    plus_minus_points INTEGER DEFAULT 0, -- Plus/Minus
    
    -- Advanced Statistics (for future use)
    true_shooting_pct DECIMAL(5,3), -- True Shooting Percentage
    effective_fg_pct DECIMAL(5,3), -- Effective Field Goal Percentage
    usage_rate DECIMAL(5,3), -- Usage Rate
    player_efficiency_rating DECIMAL(5,2), -- PER
    game_score DECIMAL(5,2), -- Game Score
    
    -- Game Context
    is_starter BOOLEAN DEFAULT FALSE, -- Did player start the game
    is_home_game BOOLEAN, -- Is this a home game for the player's team
    game_type VARCHAR(20) DEFAULT 'Regular Season', -- Regular Season, Playoffs, Preseason
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_player_id ON nba_boxscores(player_id);
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_nba_player_id ON nba_boxscores(nba_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_game_id ON nba_boxscores(game_id);
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_game_date ON nba_boxscores(game_date);
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_season_year ON nba_boxscores(season_year);
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_team_id ON nba_boxscores(team_id);
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_player_game ON nba_boxscores(nba_player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_team_game ON nba_boxscores(team_id, game_id);
CREATE INDEX IF NOT EXISTS idx_nba_boxscores_date_range ON nba_boxscores(game_date, nba_player_id);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_nba_boxscores_unique_player_game 
ON nba_boxscores(nba_player_id, game_id);

-- Function to upsert NBA box score
CREATE OR REPLACE FUNCTION upsert_nba_boxscore(
    p_nba_player_id INTEGER,
    p_player_name VARCHAR(200),
    p_game_id VARCHAR(50),
    p_game_date DATE,
    p_season_year VARCHAR(10),
    p_matchup VARCHAR(100),
    p_team_id INTEGER,
    p_team_tricode VARCHAR(10),
    p_min DECIMAL(5,2) DEFAULT NULL,
    p_fgm INTEGER DEFAULT 0,
    p_fga INTEGER DEFAULT 0,
    p_fg_pct DECIMAL(5,3) DEFAULT NULL,
    p_fg3m INTEGER DEFAULT 0,
    p_fg3a INTEGER DEFAULT 0,
    p_fg3_pct DECIMAL(5,3) DEFAULT NULL,
    p_ftm INTEGER DEFAULT 0,
    p_fta INTEGER DEFAULT 0,
    p_ft_pct DECIMAL(5,3) DEFAULT NULL,
    p_oreb INTEGER DEFAULT 0,
    p_dreb INTEGER DEFAULT 0,
    p_reb INTEGER DEFAULT 0,
    p_ast INTEGER DEFAULT 0,
    p_stl INTEGER DEFAULT 0,
    p_blk INTEGER DEFAULT 0,
    p_tov INTEGER DEFAULT 0,
    p_fouls_personal INTEGER DEFAULT 0,
    p_pts INTEGER DEFAULT 0,
    p_plus_minus_points INTEGER DEFAULT 0,
    p_jersey_num INTEGER DEFAULT NULL,
    p_position VARCHAR(10) DEFAULT NULL,
    p_team_abbreviation VARCHAR(10) DEFAULT NULL,
    p_team_name VARCHAR(100) DEFAULT NULL,
    p_team_city VARCHAR(100) DEFAULT NULL,
    p_is_starter BOOLEAN DEFAULT FALSE,
    p_is_home_game BOOLEAN DEFAULT NULL,
    p_game_type VARCHAR(20) DEFAULT 'Regular Season'
) RETURNS UUID AS $$
DECLARE
    boxscore_uuid UUID;
    player_uuid UUID;
BEGIN
    -- Try to find existing player by nba_player_id
    SELECT id INTO player_uuid FROM nba_players WHERE nba_player_id = p_nba_player_id LIMIT 1;
    
    -- If player not found, we'll leave player_id as NULL for now
    -- The script can handle this by creating the player separately
    
    INSERT INTO nba_boxscores (
        player_id, nba_player_id, player_name, game_id, game_date, season_year, matchup,
        team_id, team_tricode, min, fgm, fga, fg_pct, fg3m, fg3a, fg3_pct,
        ftm, fta, ft_pct, oreb, dreb, reb, ast, stl, blk, tov, fouls_personal,
        pts, plus_minus_points, jersey_num, "position", team_abbreviation, team_name,
        team_city, is_starter, is_home_game, game_type, updated_at
    ) VALUES (
        player_uuid, p_nba_player_id, p_player_name, p_game_id, p_game_date, p_season_year, p_matchup,
        p_team_id, p_team_tricode, p_min, p_fgm, p_fga, p_fg_pct, p_fg3m, p_fg3a, p_fg3_pct,
        p_ftm, p_fta, p_ft_pct, p_oreb, p_dreb, p_reb, p_ast, p_stl, p_blk, p_tov, p_fouls_personal,
        p_pts, p_plus_minus_points, p_jersey_num, p_position, p_team_abbreviation, p_team_name,
        p_team_city, p_is_starter, p_is_home_game, p_game_type, NOW()
    )
    ON CONFLICT (nba_player_id, game_id) DO UPDATE SET
        player_id = EXCLUDED.player_id,
        player_name = EXCLUDED.player_name,
        game_date = EXCLUDED.game_date,
        season_year = EXCLUDED.season_year,
        matchup = EXCLUDED.matchup,
        team_id = EXCLUDED.team_id,
        team_tricode = EXCLUDED.team_tricode,
        min = EXCLUDED.min,
        fgm = EXCLUDED.fgm,
        fga = EXCLUDED.fga,
        fg_pct = EXCLUDED.fg_pct,
        fg3m = EXCLUDED.fg3m,
        fg3a = EXCLUDED.fg3a,
        fg3_pct = EXCLUDED.fg3_pct,
        ftm = EXCLUDED.ftm,
        fta = EXCLUDED.fta,
        ft_pct = EXCLUDED.ft_pct,
        oreb = EXCLUDED.oreb,
        dreb = EXCLUDED.dreb,
        reb = EXCLUDED.reb,
        ast = EXCLUDED.ast,
        stl = EXCLUDED.stl,
        blk = EXCLUDED.blk,
        tov = EXCLUDED.tov,
        fouls_personal = EXCLUDED.fouls_personal,
        pts = EXCLUDED.pts,
        plus_minus_points = EXCLUDED.plus_minus_points,
        jersey_num = EXCLUDED.jersey_num,
        "position" = EXCLUDED."position",
        team_abbreviation = EXCLUDED.team_abbreviation,
        team_name = EXCLUDED.team_name,
        team_city = EXCLUDED.team_city,
        is_starter = EXCLUDED.is_starter,
        is_home_game = EXCLUDED.is_home_game,
        game_type = EXCLUDED.game_type,
        updated_at = NOW()
    RETURNING id INTO boxscore_uuid;
    
    RETURN boxscore_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get player game logs
CREATE OR REPLACE FUNCTION get_player_game_logs(
    p_nba_player_id INTEGER,
    p_season_year VARCHAR(10) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    game_id VARCHAR(50),
    game_date DATE,
    matchup VARCHAR(100),
    team_tricode VARCHAR(10),
    is_home_game BOOLEAN,
    min DECIMAL(5,2),
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pts INTEGER,
    plus_minus_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.game_id,
        b.game_date,
        b.matchup,
        b.team_tricode,
        b.is_home_game,
        b.min,
        b.fgm,
        b.fga,
        b.fg_pct,
        b.fg3m,
        b.fg3a,
        b.fg3_pct,
        b.ftm,
        b.fta,
        b.ft_pct,
        b.reb,
        b.ast,
        b.stl,
        b.blk,
        b.tov,
        b.pts,
        b.plus_minus_points
    FROM nba_boxscores b
    WHERE b.nba_player_id = p_nba_player_id
    AND (p_season_year IS NULL OR b.season_year = p_season_year)
    ORDER BY b.game_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get team game stats
CREATE OR REPLACE FUNCTION get_team_game_stats(
    p_team_id INTEGER,
    p_game_id VARCHAR(50)
) RETURNS TABLE (
    player_name VARCHAR(200),
    "position" VARCHAR(10),
    min DECIMAL(5,2),
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pts INTEGER,
    plus_minus_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.player_name,
        b."position",
        b.min,
        b.fgm,
        b.fga,
        b.fg_pct,
        b.fg3m,
        b.fg3a,
        b.fg3_pct,
        b.ftm,
        b.fta,
        b.ft_pct,
        b.reb,
        b.ast,
        b.stl,
        b.blk,
        b.tov,
        b.pts,
        b.plus_minus_points
    FROM nba_boxscores b
    WHERE b.team_id = p_team_id
    AND b.game_id = p_game_id
    ORDER BY b.pts DESC, b.min DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get player season averages
CREATE OR REPLACE FUNCTION get_player_season_averages(
    p_nba_player_id INTEGER,
    p_season_year VARCHAR(10)
) RETURNS TABLE (
    games_played INTEGER,
    min_per_game DECIMAL(5,2),
    fgm_per_game DECIMAL(5,2),
    fga_per_game DECIMAL(5,2),
    fg_pct DECIMAL(5,3),
    fg3m_per_game DECIMAL(5,2),
    fg3a_per_game DECIMAL(5,2),
    fg3_pct DECIMAL(5,3),
    ftm_per_game DECIMAL(5,2),
    fta_per_game DECIMAL(5,2),
    ft_pct DECIMAL(5,3),
    reb_per_game DECIMAL(5,2),
    ast_per_game DECIMAL(5,2),
    stl_per_game DECIMAL(5,2),
    blk_per_game DECIMAL(5,2),
    tov_per_game DECIMAL(5,2),
    pts_per_game DECIMAL(5,2),
    plus_minus_per_game DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as games_played,
        AVG(b.min) as min_per_game,
        AVG(b.fgm) as fgm_per_game,
        AVG(b.fga) as fga_per_game,
        AVG(b.fg_pct) as fg_pct,
        AVG(b.fg3m) as fg3m_per_game,
        AVG(b.fg3a) as fg3a_per_game,
        AVG(b.fg3_pct) as fg3_pct,
        AVG(b.ftm) as ftm_per_game,
        AVG(b.fta) as fta_per_game,
        AVG(b.ft_pct) as ft_pct,
        AVG(b.reb) as reb_per_game,
        AVG(b.ast) as ast_per_game,
        AVG(b.stl) as stl_per_game,
        AVG(b.blk) as blk_per_game,
        AVG(b.tov) as tov_per_game,
        AVG(b.pts) as pts_per_game,
        AVG(b.plus_minus_points) as plus_minus_per_game
    FROM nba_boxscores b
    WHERE b.nba_player_id = p_nba_player_id
    AND b.season_year = p_season_year
    AND b.min > 0; -- Only count games where player actually played
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
ALTER TABLE nba_boxscores ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read NBA box scores
CREATE POLICY "Allow authenticated users to read nba_boxscores" ON nba_boxscores
    FOR SELECT TO authenticated USING (true);

-- Allow service role to manage NBA box scores
CREATE POLICY "Allow service role to manage nba_boxscores" ON nba_boxscores
    FOR ALL TO service_role USING (true);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION upsert_nba_boxscore TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_game_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_game_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_season_averages TO authenticated;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION upsert_nba_boxscore TO service_role;
GRANT EXECUTE ON FUNCTION get_player_game_logs TO service_role;
GRANT EXECUTE ON FUNCTION get_team_game_stats TO service_role;
GRANT EXECUTE ON FUNCTION get_player_season_averages TO service_role;
