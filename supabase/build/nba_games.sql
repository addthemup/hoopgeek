-- NBA Games Table
-- This table stores NBA game data including schedules, scores, and game details

-- Create nba_games table
CREATE TABLE IF NOT EXISTS nba_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- League and Season Information
    league_id INTEGER NOT NULL DEFAULT 0, -- 0 = NBA
    season_year INTEGER NOT NULL,
    
    -- Game Identification
    game_id VARCHAR(50) UNIQUE NOT NULL,
    game_code VARCHAR(50) NOT NULL,
    
    -- Game Timing
    game_date TIMESTAMP WITH TIME ZONE NOT NULL,
    game_status INTEGER NOT NULL DEFAULT 1, -- 1=Scheduled, 2=In Progress, 3=Final, 4=Postponed, 5=Cancelled
    game_status_text VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    game_sequence INTEGER DEFAULT 1,
    
    -- Home Team Information
    home_team_id INTEGER NOT NULL,
    home_team_name VARCHAR(100) NOT NULL,
    home_team_city VARCHAR(100),
    home_team_tricode VARCHAR(10) NOT NULL,
    home_team_score INTEGER DEFAULT 0,
    
    -- Away Team Information
    away_team_id INTEGER NOT NULL,
    away_team_name VARCHAR(100) NOT NULL,
    away_team_city VARCHAR(100),
    away_team_tricode VARCHAR(10) NOT NULL,
    away_team_score INTEGER DEFAULT 0,
    
    -- Week Information
    week_number INTEGER,
    week_name VARCHAR(50),
    
    -- Arena Information
    arena_name VARCHAR(200),
    arena_city VARCHAR(100),
    arena_state VARCHAR(50),
    
    -- Game Details
    attendance INTEGER,
    game_duration VARCHAR(20), -- e.g., "2:15"
    officials JSONB, -- Array of referee information
    
    -- Playoff Information
    is_playoff_game BOOLEAN DEFAULT FALSE,
    playoff_round INTEGER, -- 1=First Round, 2=Conference Semis, 3=Conference Finals, 4=Finals
    playoff_series_game INTEGER, -- Game number in the series (1-7)
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nba_games_league_season ON nba_games(league_id, season_year);
CREATE INDEX IF NOT EXISTS idx_nba_games_game_date ON nba_games(game_date);
CREATE INDEX IF NOT EXISTS idx_nba_games_game_status ON nba_games(game_status);
CREATE INDEX IF NOT EXISTS idx_nba_games_home_team ON nba_games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_nba_games_away_team ON nba_games(away_team_id);
CREATE INDEX IF NOT EXISTS idx_nba_games_week ON nba_games(week_number);
CREATE INDEX IF NOT EXISTS idx_nba_games_playoff ON nba_games(is_playoff_game, playoff_round);
CREATE INDEX IF NOT EXISTS idx_nba_games_teams ON nba_games(home_team_id, away_team_id);

-- Create nba_season_weeks table for season structure
CREATE TABLE IF NOT EXISTS nba_season_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- League and Season Information
    league_id INTEGER NOT NULL DEFAULT 0, -- 0 = NBA
    season_year INTEGER NOT NULL,
    
    -- Week Information
    week_number INTEGER NOT NULL,
    week_name VARCHAR(50) NOT NULL,
    
    -- Week Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Week Type
    is_regular_season BOOLEAN DEFAULT TRUE,
    is_playoff_week BOOLEAN DEFAULT FALSE,
    is_all_star_week BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(league_id, season_year, week_number)
);

-- Create indexes for nba_season_weeks
CREATE INDEX IF NOT EXISTS idx_nba_season_weeks_league_season ON nba_season_weeks(league_id, season_year);
CREATE INDEX IF NOT EXISTS idx_nba_season_weeks_week_number ON nba_season_weeks(week_number);
CREATE INDEX IF NOT EXISTS idx_nba_season_weeks_dates ON nba_season_weeks(start_date, end_date);

-- Function to upsert NBA game
CREATE OR REPLACE FUNCTION upsert_nba_game(
    p_season_year INTEGER,
    p_game_id VARCHAR(50),
    p_game_code VARCHAR(50),
    p_game_date TIMESTAMP WITH TIME ZONE,
    p_home_team_id INTEGER,
    p_home_team_name VARCHAR(100),
    p_home_team_tricode VARCHAR(10),
    p_away_team_id INTEGER,
    p_away_team_name VARCHAR(100),
    p_away_team_tricode VARCHAR(10),
    p_league_id INTEGER DEFAULT 0,
    p_game_status INTEGER DEFAULT 1,
    p_game_status_text VARCHAR(50) DEFAULT 'Scheduled',
    p_game_sequence INTEGER DEFAULT 1,
    p_home_team_city VARCHAR(100) DEFAULT NULL,
    p_home_team_score INTEGER DEFAULT 0,
    p_away_team_city VARCHAR(100) DEFAULT NULL,
    p_away_team_score INTEGER DEFAULT 0,
    p_week_number INTEGER DEFAULT NULL,
    p_week_name VARCHAR(50) DEFAULT NULL,
    p_arena_name VARCHAR(200) DEFAULT NULL,
    p_arena_city VARCHAR(100) DEFAULT NULL,
    p_arena_state VARCHAR(50) DEFAULT NULL,
    p_attendance INTEGER DEFAULT NULL,
    p_game_duration VARCHAR(20) DEFAULT NULL,
    p_officials JSONB DEFAULT NULL,
    p_is_playoff_game BOOLEAN DEFAULT FALSE,
    p_playoff_round INTEGER DEFAULT NULL,
    p_playoff_series_game INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    game_uuid UUID;
BEGIN
    INSERT INTO nba_games (
        league_id, season_year, game_id, game_code, game_date, game_status, game_status_text,
        game_sequence, home_team_id, home_team_name, home_team_city, home_team_tricode, home_team_score,
        away_team_id, away_team_name, away_team_city, away_team_tricode, away_team_score,
        week_number, week_name, arena_name, arena_city, arena_state, attendance, game_duration,
        officials, is_playoff_game, playoff_round, playoff_series_game, updated_at
    ) VALUES (
        p_league_id, p_season_year, p_game_id, p_game_code, p_game_date, p_game_status, p_game_status_text,
        p_game_sequence, p_home_team_id, p_home_team_name, p_home_team_city, p_home_team_tricode, p_home_team_score,
        p_away_team_id, p_away_team_name, p_away_team_city, p_away_team_tricode, p_away_team_score,
        p_week_number, p_week_name, p_arena_name, p_arena_city, p_arena_state, p_attendance, p_game_duration,
        p_officials, p_is_playoff_game, p_playoff_round, p_playoff_series_game, NOW()
    )
    ON CONFLICT (game_id) DO UPDATE SET
        league_id = EXCLUDED.league_id,
        season_year = EXCLUDED.season_year,
        game_code = EXCLUDED.game_code,
        game_date = EXCLUDED.game_date,
        game_status = EXCLUDED.game_status,
        game_status_text = EXCLUDED.game_status_text,
        game_sequence = EXCLUDED.game_sequence,
        home_team_id = EXCLUDED.home_team_id,
        home_team_name = EXCLUDED.home_team_name,
        home_team_city = EXCLUDED.home_team_city,
        home_team_tricode = EXCLUDED.home_team_tricode,
        home_team_score = EXCLUDED.home_team_score,
        away_team_id = EXCLUDED.away_team_id,
        away_team_name = EXCLUDED.away_team_name,
        away_team_city = EXCLUDED.away_team_city,
        away_team_tricode = EXCLUDED.away_team_tricode,
        away_team_score = EXCLUDED.away_team_score,
        week_number = EXCLUDED.week_number,
        week_name = EXCLUDED.week_name,
        arena_name = EXCLUDED.arena_name,
        arena_city = EXCLUDED.arena_city,
        arena_state = EXCLUDED.arena_state,
        attendance = EXCLUDED.attendance,
        game_duration = EXCLUDED.game_duration,
        officials = EXCLUDED.officials,
        is_playoff_game = EXCLUDED.is_playoff_game,
        playoff_round = EXCLUDED.playoff_round,
        playoff_series_game = EXCLUDED.playoff_series_game,
        updated_at = NOW()
    RETURNING id INTO game_uuid;
    
    RETURN game_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert NBA season week
CREATE OR REPLACE FUNCTION upsert_nba_season_week(
    p_season_year INTEGER,
    p_week_number INTEGER,
    p_week_name VARCHAR(50),
    p_start_date DATE,
    p_end_date DATE,
    p_league_id INTEGER DEFAULT 0,
    p_is_regular_season BOOLEAN DEFAULT TRUE,
    p_is_playoff_week BOOLEAN DEFAULT FALSE,
    p_is_all_star_week BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
    week_uuid UUID;
BEGIN
    INSERT INTO nba_season_weeks (
        league_id, season_year, week_number, week_name, start_date, end_date,
        is_regular_season, is_playoff_week, is_all_star_week, updated_at
    ) VALUES (
        p_league_id, p_season_year, p_week_number, p_week_name, p_start_date, p_end_date,
        p_is_regular_season, p_is_playoff_week, p_is_all_star_week, NOW()
    )
    ON CONFLICT (league_id, season_year, week_number) DO UPDATE SET
        week_name = EXCLUDED.week_name,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        is_regular_season = EXCLUDED.is_regular_season,
        is_playoff_week = EXCLUDED.is_playoff_week,
        is_all_star_week = EXCLUDED.is_all_star_week,
        updated_at = NOW()
    RETURNING id INTO week_uuid;
    
    RETURN week_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get games by team
CREATE OR REPLACE FUNCTION get_team_games(
    p_team_id INTEGER,
    p_season_year INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    game_id VARCHAR(50),
    game_date TIMESTAMP WITH TIME ZONE,
    home_team_name VARCHAR(100),
    away_team_name VARCHAR(100),
    home_team_score INTEGER,
    away_team_score INTEGER,
    game_status_text VARCHAR(50),
    is_home_game BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.game_id,
        g.game_date,
        g.home_team_name,
        g.away_team_name,
        g.home_team_score,
        g.away_team_score,
        g.game_status_text,
        (g.home_team_id = p_team_id) as is_home_game
    FROM nba_games g
    WHERE (g.home_team_id = p_team_id OR g.away_team_id = p_team_id)
    AND (p_season_year IS NULL OR g.season_year = p_season_year)
    ORDER BY g.game_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get games by date range
CREATE OR REPLACE FUNCTION get_games_by_date_range(
    p_start_date DATE,
    p_end_date DATE,
    p_season_year INTEGER DEFAULT NULL
) RETURNS TABLE (
    game_id VARCHAR(50),
    game_date TIMESTAMP WITH TIME ZONE,
    home_team_name VARCHAR(100),
    away_team_name VARCHAR(100),
    home_team_score INTEGER,
    away_team_score INTEGER,
    game_status_text VARCHAR(50),
    arena_name VARCHAR(200)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.game_id,
        g.game_date,
        g.home_team_name,
        g.away_team_name,
        g.home_team_score,
        g.away_team_score,
        g.game_status_text,
        g.arena_name
    FROM nba_games g
    WHERE g.game_date::date BETWEEN p_start_date AND p_end_date
    AND (p_season_year IS NULL OR g.season_year = p_season_year)
    ORDER BY g.game_date;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
ALTER TABLE nba_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_season_weeks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read NBA games
CREATE POLICY "Allow authenticated users to read nba_games" ON nba_games
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to read NBA season weeks
CREATE POLICY "Allow authenticated users to read nba_season_weeks" ON nba_season_weeks
    FOR SELECT TO authenticated USING (true);

-- Allow service role to manage NBA games
CREATE POLICY "Allow service role to manage nba_games" ON nba_games
    FOR ALL TO service_role USING (true);

-- Allow service role to manage NBA season weeks
CREATE POLICY "Allow service role to manage nba_season_weeks" ON nba_season_weeks
    FOR ALL TO service_role USING (true);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION upsert_nba_game TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_nba_season_week TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_games TO authenticated;
GRANT EXECUTE ON FUNCTION get_games_by_date_range TO authenticated;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION upsert_nba_game TO service_role;
GRANT EXECUTE ON FUNCTION upsert_nba_season_week TO service_role;
GRANT EXECUTE ON FUNCTION get_team_games TO service_role;
GRANT EXECUTE ON FUNCTION get_games_by_date_range TO service_role;
