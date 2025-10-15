-- =====================================================
-- NBA TEAMS TABLE AND FUNCTIONS
-- =====================================================
-- This script creates the nba_teams table to store NBA team information
-- including team details, history, awards, and social media links
-- =====================================================

-- Create nba_teams table
CREATE TABLE IF NOT EXISTS nba_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER UNIQUE NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    year_founded INTEGER,
    arena VARCHAR(200),
    arena_capacity INTEGER,
    owner VARCHAR(200),
    general_manager VARCHAR(200),
    head_coach VARCHAR(200),
    d_league_affiliation VARCHAR(200),
    website VARCHAR(500),
    twitter VARCHAR(200),
    instagram VARCHAR(200),
    facebook VARCHAR(200),
    youtube VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nba_teams_team_id ON nba_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_nba_teams_abbreviation ON nba_teams(abbreviation);
CREATE INDEX IF NOT EXISTS idx_nba_teams_city ON nba_teams(city);

-- Create team history table
CREATE TABLE IF NOT EXISTS nba_team_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER NOT NULL,
    city VARCHAR(100) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    year_founded INTEGER,
    year_active_till INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (team_id) REFERENCES nba_teams(team_id) ON DELETE CASCADE
);

-- Create team awards table
CREATE TABLE IF NOT EXISTS nba_team_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER NOT NULL,
    award_type VARCHAR(50) NOT NULL, -- 'championship', 'conference', 'division'
    year_awarded INTEGER NOT NULL,
    opposite_team VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (team_id) REFERENCES nba_teams(team_id) ON DELETE CASCADE
);

-- Create team hall of fame table
CREATE TABLE IF NOT EXISTS nba_team_hof (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER NOT NULL,
    player_id INTEGER,
    player_name VARCHAR(200) NOT NULL,
    position VARCHAR(10),
    jersey VARCHAR(10),
    seasons_with_team INTEGER,
    year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (team_id) REFERENCES nba_teams(team_id) ON DELETE CASCADE
);

-- Create team retired numbers table
CREATE TABLE IF NOT EXISTS nba_team_retired (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER NOT NULL,
    player_id INTEGER,
    player_name VARCHAR(200) NOT NULL,
    position VARCHAR(10),
    jersey VARCHAR(10),
    seasons_with_team INTEGER,
    year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (team_id) REFERENCES nba_teams(team_id) ON DELETE CASCADE
);

-- Create indexes for related tables
CREATE INDEX IF NOT EXISTS idx_nba_team_history_team_id ON nba_team_history(team_id);
CREATE INDEX IF NOT EXISTS idx_nba_team_awards_team_id ON nba_team_awards(team_id);
CREATE INDEX IF NOT EXISTS idx_nba_team_awards_type ON nba_team_awards(award_type);
CREATE INDEX IF NOT EXISTS idx_nba_team_hof_team_id ON nba_team_hof(team_id);
CREATE INDEX IF NOT EXISTS idx_nba_team_retired_team_id ON nba_team_retired(team_id);

-- Function to upsert NBA team
CREATE OR REPLACE FUNCTION upsert_nba_team(
    p_team_id INTEGER,
    p_abbreviation VARCHAR(10),
    p_nickname VARCHAR(100),
    p_city VARCHAR(100),
    p_year_founded INTEGER DEFAULT NULL,
    p_arena VARCHAR(200) DEFAULT NULL,
    p_arena_capacity INTEGER DEFAULT NULL,
    p_owner VARCHAR(200) DEFAULT NULL,
    p_general_manager VARCHAR(200) DEFAULT NULL,
    p_head_coach VARCHAR(200) DEFAULT NULL,
    p_d_league_affiliation VARCHAR(200) DEFAULT NULL,
    p_website VARCHAR(500) DEFAULT NULL,
    p_twitter VARCHAR(200) DEFAULT NULL,
    p_instagram VARCHAR(200) DEFAULT NULL,
    p_facebook VARCHAR(200) DEFAULT NULL,
    p_youtube VARCHAR(200) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    team_uuid UUID;
BEGIN
    -- Insert or update the main team record
    INSERT INTO nba_teams (
        team_id, abbreviation, nickname, city, year_founded, arena, arena_capacity,
        owner, general_manager, head_coach, d_league_affiliation,
        website, twitter, instagram, facebook, youtube, updated_at
    ) VALUES (
        p_team_id, p_abbreviation, p_nickname, p_city, p_year_founded, p_arena, p_arena_capacity,
        p_owner, p_general_manager, p_head_coach, p_d_league_affiliation,
        p_website, p_twitter, p_instagram, p_facebook, p_youtube, NOW()
    )
    ON CONFLICT (team_id) DO UPDATE SET
        abbreviation = EXCLUDED.abbreviation,
        nickname = EXCLUDED.nickname,
        city = EXCLUDED.city,
        year_founded = EXCLUDED.year_founded,
        arena = EXCLUDED.arena,
        arena_capacity = EXCLUDED.arena_capacity,
        owner = EXCLUDED.owner,
        general_manager = EXCLUDED.general_manager,
        head_coach = EXCLUDED.head_coach,
        d_league_affiliation = EXCLUDED.d_league_affiliation,
        website = EXCLUDED.website,
        twitter = EXCLUDED.twitter,
        instagram = EXCLUDED.instagram,
        facebook = EXCLUDED.facebook,
        youtube = EXCLUDED.youtube,
        updated_at = NOW()
    RETURNING id INTO team_uuid;
    
    RETURN team_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to add team history
CREATE OR REPLACE FUNCTION add_team_history(
    p_team_id INTEGER,
    p_city VARCHAR(100),
    p_nickname VARCHAR(100),
    p_year_founded INTEGER DEFAULT NULL,
    p_year_active_till INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    history_uuid UUID;
BEGIN
    INSERT INTO nba_team_history (
        team_id, city, nickname, year_founded, year_active_till
    ) VALUES (
        p_team_id, p_city, p_nickname, p_year_founded, p_year_active_till
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO history_uuid;
    
    RETURN history_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to add team award
CREATE OR REPLACE FUNCTION add_team_award(
    p_team_id INTEGER,
    p_award_type VARCHAR(50),
    p_year_awarded INTEGER,
    p_opposite_team VARCHAR(100) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    award_uuid UUID;
BEGIN
    INSERT INTO nba_team_awards (
        team_id, award_type, year_awarded, opposite_team
    ) VALUES (
        p_team_id, p_award_type, p_year_awarded, p_opposite_team
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO award_uuid;
    
    RETURN award_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to add team hall of fame member
CREATE OR REPLACE FUNCTION add_team_hof(
    p_team_id INTEGER,
    p_player_name VARCHAR(200),
    p_player_id INTEGER DEFAULT NULL,
    p_position VARCHAR(10) DEFAULT NULL,
    p_jersey VARCHAR(10) DEFAULT NULL,
    p_seasons_with_team INTEGER DEFAULT NULL,
    p_year INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    hof_uuid UUID;
BEGIN
    INSERT INTO nba_team_hof (
        team_id, player_id, player_name, position, jersey, seasons_with_team, year
    ) VALUES (
        p_team_id, p_player_id, p_player_name, p_position, p_jersey, p_seasons_with_team, p_year
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO hof_uuid;
    
    RETURN hof_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to add retired number
CREATE OR REPLACE FUNCTION add_team_retired(
    p_team_id INTEGER,
    p_player_name VARCHAR(200),
    p_player_id INTEGER DEFAULT NULL,
    p_position VARCHAR(10) DEFAULT NULL,
    p_jersey VARCHAR(10) DEFAULT NULL,
    p_seasons_with_team INTEGER DEFAULT NULL,
    p_year INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    retired_uuid UUID;
BEGIN
    INSERT INTO nba_team_retired (
        team_id, player_id, player_name, position, jersey, seasons_with_team, year
    ) VALUES (
        p_team_id, p_player_id, p_player_name, p_position, p_jersey, p_seasons_with_team, p_year
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO retired_uuid;
    
    RETURN retired_uuid;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON nba_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nba_team_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nba_team_awards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nba_team_hof TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nba_team_retired TO authenticated;

GRANT EXECUTE ON FUNCTION upsert_nba_team TO authenticated;
GRANT EXECUTE ON FUNCTION add_team_history TO authenticated;
GRANT EXECUTE ON FUNCTION add_team_award TO authenticated;
GRANT EXECUTE ON FUNCTION add_team_hof TO authenticated;
GRANT EXECUTE ON FUNCTION add_team_retired TO authenticated;

-- Enable Row Level Security
ALTER TABLE nba_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_team_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_team_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_team_hof ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_team_retired ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to read nba_teams" ON nba_teams
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to read nba_team_history" ON nba_team_history
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to read nba_team_awards" ON nba_team_awards
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to read nba_team_hof" ON nba_team_hof
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to read nba_team_retired" ON nba_team_retired
    FOR SELECT USING (true);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Created nba_teams table and related tables';
    RAISE NOTICE '✅ Created upsert functions for team data';
    RAISE NOTICE '✅ Created indexes for performance';
    RAISE NOTICE '✅ Enabled Row Level Security';
    RAISE NOTICE '✅ Granted permissions to authenticated users';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready for NBA team data import';
    RAISE NOTICE '📋 Tables created: nba_teams, nba_team_history, nba_team_awards, nba_team_hof, nba_team_retired';
    RAISE NOTICE '';
END $$;
