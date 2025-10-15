-- =====================================================
-- NBA PLAYERS TABLE
-- =====================================================
-- This table stores basic NBA player information from the NBA API
-- =====================================================

CREATE TABLE IF NOT EXISTS nba_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nba_player_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    player_slug TEXT,
    position TEXT,
    team_id INTEGER,
    team_name TEXT,
    team_abbreviation TEXT,
    team_slug TEXT,
    team_city TEXT,
    jersey_number TEXT,
    height TEXT,
    weight INTEGER,
    age INTEGER,
    birth_date DATE,
    birth_city TEXT,
    birth_state TEXT,
    birth_country TEXT,
    country TEXT,
    college TEXT,
    draft_year INTEGER,
    draft_round INTEGER,
    draft_number INTEGER,
    salary BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_rookie BOOLEAN DEFAULT false,
    years_pro INTEGER DEFAULT 0,
    roster_status TEXT,
    from_year INTEGER,
    to_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index on NBA player ID for fast lookups
CREATE INDEX IF NOT EXISTS idx_nba_players_nba_player_id ON nba_players(nba_player_id);

-- Index on name for search functionality
CREATE INDEX IF NOT EXISTS idx_nba_players_name ON nba_players(name);

-- Index on team for team-based queries
CREATE INDEX IF NOT EXISTS idx_nba_players_team_id ON nba_players(team_id);

-- Index on position for position-based queries
CREATE INDEX IF NOT EXISTS idx_nba_players_position ON nba_players(position);

-- Index on active status for filtering active players
CREATE INDEX IF NOT EXISTS idx_nba_players_is_active ON nba_players(is_active);

-- =====================================================
-- UPSERT FUNCTION FOR NBA PLAYERS
-- =====================================================

-- Drop existing function if it exists (to avoid signature conflicts)
DROP FUNCTION IF EXISTS upsert_nba_player(INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, DATE, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, BIGINT, BOOLEAN, BOOLEAN, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS upsert_nba_player CASCADE;

CREATE OR REPLACE FUNCTION upsert_nba_player(
    p_nba_player_id INTEGER,
    p_name TEXT,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_player_slug TEXT DEFAULT NULL,
    p_position TEXT DEFAULT NULL,
    p_team_id INTEGER DEFAULT NULL,
    p_team_name TEXT DEFAULT NULL,
    p_team_abbreviation TEXT DEFAULT NULL,
    p_team_slug TEXT DEFAULT NULL,
    p_team_city TEXT DEFAULT NULL,
    p_jersey_number TEXT DEFAULT NULL,
    p_height TEXT DEFAULT NULL,
    p_weight INTEGER DEFAULT NULL,
    p_age INTEGER DEFAULT NULL,
    p_birth_date DATE DEFAULT NULL,
    p_birth_city TEXT DEFAULT NULL,
    p_birth_state TEXT DEFAULT NULL,
    p_birth_country TEXT DEFAULT NULL,
    p_country TEXT DEFAULT NULL,
    p_college TEXT DEFAULT NULL,
    p_draft_year INTEGER DEFAULT NULL,
    p_draft_round INTEGER DEFAULT NULL,
    p_draft_number INTEGER DEFAULT NULL,
    p_salary BIGINT DEFAULT 0,
    p_is_active BOOLEAN DEFAULT true,
    p_is_rookie BOOLEAN DEFAULT false,
    p_years_pro INTEGER DEFAULT 0,
    p_roster_status TEXT DEFAULT NULL,
    p_from_year INTEGER DEFAULT NULL,
    p_to_year INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    player_record RECORD;
BEGIN
    -- Try to update existing player
    UPDATE nba_players SET
        name = p_name,
        first_name = p_first_name,
        last_name = p_last_name,
        player_slug = p_player_slug,
        position = p_position,
        team_id = p_team_id,
        team_name = p_team_name,
        team_abbreviation = p_team_abbreviation,
        team_slug = p_team_slug,
        team_city = p_team_city,
        jersey_number = p_jersey_number,
        height = p_height,
        weight = p_weight,
        age = p_age,
        birth_date = p_birth_date,
        birth_city = p_birth_city,
        birth_state = p_birth_state,
        birth_country = p_birth_country,
        country = p_country,
        college = p_college,
        draft_year = p_draft_year,
        draft_round = p_draft_round,
        draft_number = p_draft_number,
        salary = p_salary,
        is_active = p_is_active,
        is_rookie = p_is_rookie,
        years_pro = p_years_pro,
        roster_status = p_roster_status,
        from_year = p_from_year,
        to_year = p_to_year,
        updated_at = NOW()
    WHERE nba_player_id = p_nba_player_id
    RETURNING * INTO player_record;
    
    -- If no rows were updated, insert new player
    IF NOT FOUND THEN
        INSERT INTO nba_players (
            nba_player_id, name, first_name, last_name, player_slug, position,
            team_id, team_name, team_abbreviation, team_slug, team_city, jersey_number,
            height, weight, age, birth_date, birth_city, birth_state,
            birth_country, country, college, draft_year, draft_round, draft_number,
            salary, is_active, is_rookie, years_pro, roster_status, from_year, to_year
        ) VALUES (
            p_nba_player_id, p_name, p_first_name, p_last_name, p_player_slug, p_position,
            p_team_id, p_team_name, p_team_abbreviation, p_team_slug, p_team_city, p_jersey_number,
            p_height, p_weight, p_age, p_birth_date, p_birth_city, p_birth_state,
            p_birth_country, p_country, p_college, p_draft_year, p_draft_round, p_draft_number,
            p_salary, p_is_active, p_is_rookie, p_years_pro, p_roster_status, p_from_year, p_to_year
        ) RETURNING * INTO player_record;
    END IF;
    
    -- Return success result
    result := jsonb_build_object(
        'success', TRUE,
        'action', CASE WHEN FOUND THEN 'updated' ELSE 'inserted' END,
        'player_id', player_record.id,
        'nba_player_id', player_record.nba_player_id,
        'name', player_record.name
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_nba_player TO authenticated;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on the table
ALTER TABLE nba_players ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read nba_players" ON nba_players;
DROP POLICY IF EXISTS "Allow service role to manage nba_players" ON nba_players;

-- Allow all authenticated users to read NBA players data
CREATE POLICY "Allow authenticated users to read nba_players" ON nba_players
    FOR SELECT TO authenticated
    USING (true);

-- Allow service role to insert/update/delete (for import scripts)
CREATE POLICY "Allow service role to manage nba_players" ON nba_players
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ NBA Players table created successfully!';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Upsert function created for safe imports';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Table: nba_players';
    RAISE NOTICE '🔧 Function: upsert_nba_player()';
    RAISE NOTICE '🔒 RLS: Enabled with read access for authenticated users';
    RAISE NOTICE '';
END $$;
