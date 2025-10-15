-- =====================================================
-- FANTASY MATCHUPS SYSTEM
-- =====================================================
-- Manages weekly matchups between fantasy teams
-- Based on fantasy_season_weeks and league configuration
-- =====================================================

-- =====================================================
-- FANTASY MATCHUPS TABLE
-- =====================================================
-- Stores weekly matchups between fantasy teams
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_matchups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    
    -- Week Information (foreign key to fantasy_season_weeks)
    season_week_id UUID NOT NULL REFERENCES fantasy_season_weeks(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    
    -- Teams
    fantasy_team1_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    fantasy_team2_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Home/Away Designation
    home_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    away_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Matchup Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
    
    -- Scores
    team1_score DECIMAL(10,2) DEFAULT 0.0,
    team2_score DECIMAL(10,2) DEFAULT 0.0,
    
    -- Projected Scores
    team1_projected_score DECIMAL(10,2) DEFAULT 0.0,
    team2_projected_score DECIMAL(10,2) DEFAULT 0.0,
    
    -- Matchup Timing
    matchup_start_date TIMESTAMP WITH TIME ZONE,
    matchup_end_date TIMESTAMP WITH TIME ZONE,
    matchup_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Matchup Metadata
    is_playoff_matchup BOOLEAN DEFAULT false,
    playoff_round INTEGER, -- 1, 2, 3, etc. for playoff rounds
    is_bye_week BOOLEAN DEFAULT false, -- For teams with bye weeks
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, fantasy_team1_id, fantasy_team2_id, week_number, season_year),
    CHECK (fantasy_team1_id != fantasy_team2_id),
    CHECK (home_team_id = fantasy_team1_id OR home_team_id = fantasy_team2_id),
    CHECK (away_team_id = fantasy_team1_id OR away_team_id = fantasy_team2_id),
    CHECK (home_team_id != away_team_id)
);

-- =====================================================
-- FANTASY MATCHUP STATS TABLE
-- =====================================================
-- Stores detailed statistics for each matchup
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_matchup_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    matchup_id UUID NOT NULL REFERENCES fantasy_matchups(id) ON DELETE CASCADE,
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Team Performance Stats
    total_salary BIGINT DEFAULT 0,
    active_players_count INTEGER DEFAULT 0,
    starters_count INTEGER DEFAULT 0,
    rotation_count INTEGER DEFAULT 0,
    bench_count INTEGER DEFAULT 0,
    
    -- Scoring Stats
    total_fantasy_points DECIMAL(10,2) DEFAULT 0.0,
    starters_points DECIMAL(10,2) DEFAULT 0.0,
    rotation_points DECIMAL(10,2) DEFAULT 0.0,
    bench_points DECIMAL(10,2) DEFAULT 0.0,
    
    -- Efficiency Stats
    points_per_dollar DECIMAL(10,4) DEFAULT 0.0,
    utilization_rate DECIMAL(5,2) DEFAULT 0.0, -- Percentage of roster used
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(matchup_id, fantasy_team_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Fantasy Matchups Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_league_id ON fantasy_matchups(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_season_id ON fantasy_matchups(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_season_week_id ON fantasy_matchups(season_week_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_week_number ON fantasy_matchups(week_number);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_season_year ON fantasy_matchups(season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_fantasy_team1_id ON fantasy_matchups(fantasy_team1_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_fantasy_team2_id ON fantasy_matchups(fantasy_team2_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_home_team_id ON fantasy_matchups(home_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_away_team_id ON fantasy_matchups(away_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_status ON fantasy_matchups(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_team_week ON fantasy_matchups(fantasy_team1_id, week_number, season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchups_team2_week ON fantasy_matchups(fantasy_team2_id, week_number, season_year);

-- Fantasy Matchup Stats Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_matchup_stats_matchup_id ON fantasy_matchup_stats(matchup_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_matchup_stats_fantasy_team_id ON fantasy_matchup_stats(fantasy_team_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE fantasy_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_matchup_stats ENABLE ROW LEVEL SECURITY;

-- Fantasy Matchups Policies
CREATE POLICY "Users can view matchups in their leagues" ON fantasy_matchups
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "Commissioners can manage all matchups" ON fantasy_matchups
    FOR ALL TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- Fantasy Matchup Stats Policies
CREATE POLICY "Users can view matchup stats in their leagues" ON fantasy_matchup_stats
    FOR SELECT TO authenticated
    USING (
        matchup_id IN (
            SELECT id FROM fantasy_matchups WHERE league_id IN (
                SELECT fl.id FROM fantasy_leagues fl
                JOIN fantasy_teams ft ON fl.id = ft.league_id
                WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
            )
        )
    );

CREATE POLICY "Commissioners can manage all matchup stats" ON fantasy_matchup_stats
    FOR ALL TO authenticated
    USING (
        matchup_id IN (
            SELECT id FROM fantasy_matchups WHERE league_id IN (
                SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
            )
        )
    );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create triggers for updated_at
CREATE TRIGGER update_fantasy_matchups_updated_at
    BEFORE UPDATE ON fantasy_matchups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_matchup_stats_updated_at
    BEFORE UPDATE ON fantasy_matchup_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CREATE MATCHUP FUNCTION
-- =====================================================
-- Creates a new matchup between two teams
-- =====================================================

CREATE OR REPLACE FUNCTION create_fantasy_matchup(
    p_league_id UUID,
    p_season_id UUID,
    p_season_week_id UUID,
    p_week_number INTEGER,
    p_season_year INTEGER,
    p_fantasy_team1_id UUID,
    p_fantasy_team2_id UUID,
    p_home_team_id UUID,
    p_is_playoff_matchup BOOLEAN DEFAULT false,
    p_playoff_round INTEGER DEFAULT NULL,
    p_is_bye_week BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    matchup_id UUID;
    away_team_id UUID;
BEGIN
    -- Validate teams are different
    IF p_fantasy_team1_id = p_fantasy_team2_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid teams',
            'message', 'Team 1 and Team 2 must be different'
        );
    END IF;
    
    -- Validate home team is one of the two teams
    IF p_home_team_id != p_fantasy_team1_id AND p_home_team_id != p_fantasy_team2_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid home team',
            'message', 'Home team must be either team 1 or team 2'
        );
    END IF;
    
    -- Determine away team
    away_team_id := CASE 
        WHEN p_home_team_id = p_fantasy_team1_id THEN p_fantasy_team2_id
        ELSE p_fantasy_team1_id
    END;
    
    -- Insert the matchup
    INSERT INTO fantasy_matchups (
        league_id,
        season_id,
        season_week_id,
        week_number,
        season_year,
        fantasy_team1_id,
        fantasy_team2_id,
        home_team_id,
        away_team_id,
        is_playoff_matchup,
        playoff_round,
        is_bye_week
    ) VALUES (
        p_league_id,
        p_season_id,
        p_season_week_id,
        p_week_number,
        p_season_year,
        p_fantasy_team1_id,
        p_fantasy_team2_id,
        p_home_team_id,
        away_team_id,
        p_is_playoff_matchup,
        p_playoff_round,
        p_is_bye_week
    ) RETURNING id INTO matchup_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'matchup_id', matchup_id,
        'league_id', p_league_id,
        'week_number', p_week_number,
        'season_year', p_season_year,
        'fantasy_team1_id', p_fantasy_team1_id,
        'fantasy_team2_id', p_fantasy_team2_id,
        'home_team_id', p_home_team_id,
        'away_team_id', away_team_id,
        'message', 'Matchup created successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Matchup creation failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_fantasy_matchup(UUID, UUID, UUID, INTEGER, INTEGER, UUID, UUID, UUID, BOOLEAN, INTEGER, BOOLEAN) TO authenticated;

-- =====================================================
-- UPDATE MATCHUP SCORES FUNCTION
-- =====================================================
-- Updates scores for a matchup
-- =====================================================

CREATE OR REPLACE FUNCTION update_matchup_scores(
    p_matchup_id UUID,
    p_team1_score DECIMAL DEFAULT NULL,
    p_team2_score DECIMAL DEFAULT NULL,
    p_team1_projected_score DECIMAL DEFAULT NULL,
    p_team2_projected_score DECIMAL DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    matchup_record RECORD;
BEGIN
    -- Get current matchup data
    SELECT * INTO matchup_record FROM fantasy_matchups WHERE id = p_matchup_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Matchup not found',
            'message', 'The specified matchup does not exist'
        );
    END IF;
    
    -- Update the matchup
    UPDATE fantasy_matchups SET
        team1_score = COALESCE(p_team1_score, team1_score),
        team2_score = COALESCE(p_team2_score, team2_score),
        team1_projected_score = COALESCE(p_team1_projected_score, team1_projected_score),
        team2_projected_score = COALESCE(p_team2_projected_score, team2_projected_score),
        status = COALESCE(p_status, status),
        matchup_completed_at = CASE 
            WHEN p_status = 'completed' AND status != 'completed' THEN NOW()
            ELSE matchup_completed_at
        END,
        updated_at = NOW()
    WHERE id = p_matchup_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'matchup_id', p_matchup_id,
        'team1_score', COALESCE(p_team1_score, matchup_record.team1_score),
        'team2_score', COALESCE(p_team2_score, matchup_record.team2_score),
        'status', COALESCE(p_status, matchup_record.status),
        'message', 'Matchup scores updated successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Score update failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_matchup_scores(UUID, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT) TO authenticated;

-- =====================================================
-- GET MATCHUP DETAILS FUNCTION
-- =====================================================
-- Returns detailed matchup information for MatchupDetails.tsx
-- =====================================================

CREATE OR REPLACE FUNCTION get_matchup_details(p_matchup_id UUID)
RETURNS TABLE (
    matchup_id UUID,
    league_id UUID,
    week_number INTEGER,
    season_year INTEGER,
    status TEXT,
    team1_score DECIMAL,
    team2_score DECIMAL,
    team1_projected_score DECIMAL,
    team2_projected_score DECIMAL,
    matchup_start_date TIMESTAMP WITH TIME ZONE,
    matchup_end_date TIMESTAMP WITH TIME ZONE,
    matchup_completed_at TIMESTAMP WITH TIME ZONE,
    is_playoff_matchup BOOLEAN,
    playoff_round INTEGER,
    is_bye_week BOOLEAN,
    -- Team 1 details
    team1_id UUID,
    team1_name TEXT,
    team1_wins INTEGER,
    team1_losses INTEGER,
    team1_ties INTEGER,
    -- Team 2 details
    team2_id UUID,
    team2_name TEXT,
    team2_wins INTEGER,
    team2_losses INTEGER,
    team2_ties INTEGER,
    -- Week info
    week_name TEXT,
    week_start_date DATE,
    week_end_date DATE,
    -- Home/Away info
    home_team_id UUID,
    home_team_name TEXT,
    away_team_id UUID,
    away_team_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fm.id as matchup_id,
        fm.league_id,
        fm.week_number,
        fm.season_year,
        fm.status,
        fm.team1_score,
        fm.team2_score,
        fm.team1_projected_score,
        fm.team2_projected_score,
        fm.matchup_start_date,
        fm.matchup_end_date,
        fm.matchup_completed_at,
        fm.is_playoff_matchup,
        fm.playoff_round,
        fm.is_bye_week,
        -- Team 1 details
        fm.fantasy_team1_id as team1_id,
        ft1.team_name as team1_name,
        ft1.wins as team1_wins,
        ft1.losses as team1_losses,
        ft1.ties as team1_ties,
        -- Team 2 details
        fm.fantasy_team2_id as team2_id,
        ft2.team_name as team2_name,
        ft2.wins as team2_wins,
        ft2.losses as team2_losses,
        ft2.ties as team2_ties,
        -- Week info
        fsw.week_name,
        fsw.start_date as week_start_date,
        fsw.end_date as week_end_date,
        -- Home/Away info
        fm.home_team_id,
        fth.team_name as home_team_name,
        fm.away_team_id,
        fta.team_name as away_team_name
    FROM fantasy_matchups fm
    LEFT JOIN fantasy_teams ft1 ON fm.fantasy_team1_id = ft1.id
    LEFT JOIN fantasy_teams ft2 ON fm.fantasy_team2_id = ft2.id
    LEFT JOIN fantasy_teams fth ON fm.home_team_id = fth.id
    LEFT JOIN fantasy_teams fta ON fm.away_team_id = fta.id
    LEFT JOIN fantasy_season_weeks fsw ON fm.season_week_id = fsw.id
    WHERE fm.id = p_matchup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_matchup_details(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fantasy Matchups system created successfully!';
    RAISE NOTICE '✅ Tables: fantasy_matchups, fantasy_matchup_stats';
    RAISE NOTICE '✅ Functions: create_fantasy_matchup, update_matchup_scores, get_matchup_details';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support MatchupDetails.tsx and schedule generation';
    RAISE NOTICE '📋 Features: Home/away teams, scores, projected scores, playoff support';
    RAISE NOTICE '🔄 Schedule generation: Will use this data to create weekly matchups';
    RAISE NOTICE '🏀 Matchup details: Complete team info, week info, home/away designation';
    RAISE NOTICE '📊 Matchup stats: Salary totals, player counts, efficiency metrics';
    RAISE NOTICE '';
END $$;
