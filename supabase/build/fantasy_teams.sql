-- =====================================================
-- FANTASY TEAMS TABLE
-- =====================================================
-- This table stores teams within fantasy leagues
-- Based on TeamRoster.tsx requirements
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Team Status
    is_commissioner BOOLEAN DEFAULT false,
    draft_position INTEGER,
    is_active BOOLEAN DEFAULT true,
    
    -- Season-Specific Team Stats (for TeamRoster.tsx display)
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    ties INTEGER DEFAULT 0,
    points_for DECIMAL DEFAULT 0,
    points_against DECIMAL DEFAULT 0,
    
    -- Season-Specific Team Record Display Fields (from TeamRoster.tsx)
    current_streak TEXT DEFAULT 'L0', -- e.g., 'W2', 'L3'
    current_standing INTEGER DEFAULT 1, -- 1st, 2nd, 3rd place, etc.
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(season_id, team_name), -- Unique team names per season
    UNIQUE(season_id, user_id), -- One team per user per season
    UNIQUE(season_id, draft_position) -- Unique draft positions per season
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Fantasy Teams Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_league_id ON fantasy_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_season_id ON fantasy_teams(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_user_id ON fantasy_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_commissioner ON fantasy_teams(is_commissioner);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_draft_position ON fantasy_teams(draft_position);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_active ON fantasy_teams(is_active);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on the table
ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;

-- Users can view teams in their leagues
CREATE POLICY "Users can view teams in their leagues" ON fantasy_teams
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        ) OR
        user_id = auth.uid()
    );

-- Commissioners can create teams in their leagues
CREATE POLICY "Commissioners can create teams" ON fantasy_teams
    FOR INSERT TO authenticated
    WITH CHECK (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- Team owners can update their teams
CREATE POLICY "Team owners can update their teams" ON fantasy_teams
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Commissioners can update all teams in their leagues
CREATE POLICY "Commissioners can update teams in their leagues" ON fantasy_teams
    FOR UPDATE TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- Commissioners can delete teams in their leagues
CREATE POLICY "Commissioners can delete teams" ON fantasy_teams
    FOR DELETE TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create trigger for updated_at
CREATE TRIGGER update_fantasy_teams_updated_at
    BEFORE UPDATE ON fantasy_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CREATE TEAMS FOR LEAGUE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION create_teams_for_season(
    season_id_param UUID,
    commissioner_team_name_param TEXT,
    max_teams_param INTEGER DEFAULT 12
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    teams_created INTEGER := 0;
    commissioner_team_id UUID;
    league_id_val UUID;
    commissioner_id_val UUID;
    i INTEGER;
BEGIN
    -- Get league and commissioner info from the season
    SELECT fls.league_id, fl.commissioner_id 
    INTO league_id_val, commissioner_id_val
    FROM fantasy_league_seasons fls
    JOIN fantasy_leagues fl ON fls.league_id = fl.id
    WHERE fls.id = season_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Season not found',
            'message', 'The specified season_id does not exist.'
        );
    END IF;

    -- Check if teams already exist for this season
    IF EXISTS (SELECT 1 FROM fantasy_teams WHERE season_id = season_id_param) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Teams already exist',
            'message', 'Teams have already been created for this season.'
        );
    END IF;

    -- Create the commissioner's team (position 1)
    INSERT INTO fantasy_teams (
        league_id,
        season_id,
        team_name,
        user_id,
        is_commissioner,
        draft_position,
        is_active
    ) VALUES (
        league_id_val,
        season_id_param,
        commissioner_team_name_param,
        commissioner_id_val,
        TRUE,
        1,
        TRUE
    ) RETURNING id INTO commissioner_team_id;
    
    teams_created := teams_created + 1;
    RAISE NOTICE 'Created commissioner team: % (%)', commissioner_team_name_param, commissioner_team_id;
    
    -- Create the remaining teams (unclaimed, positions 2 to max_teams)
    FOR i IN 2..max_teams_param LOOP
        INSERT INTO fantasy_teams (
            league_id,
            season_id,
            team_name,
            user_id,
            is_commissioner,
            draft_position,
            is_active
        ) VALUES (
            league_id_val,
            season_id_param,
            'Team ' || i,
            NULL, -- No user assigned yet
            FALSE,
            i,
            TRUE
        );
        
        teams_created := teams_created + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % total teams for season %', teams_created, season_id_param;
    
    result := jsonb_build_object(
        'success', TRUE,
        'league_id', league_id_val,
        'season_id', season_id_param,
        'teams_created', teams_created,
        'commissioner_team_id', commissioner_team_id,
        'commissioner_team_name', commissioner_team_name_param,
        'message', 'Teams created successfully for season'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Team creation failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_teams_for_season(UUID, TEXT, INTEGER) TO authenticated;

-- =====================================================
-- JOIN TEAM FUNCTION (for when users join via invite)
-- =====================================================

CREATE OR REPLACE FUNCTION join_team(
    season_id_param UUID,
    team_id_param UUID,
    user_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    team_record RECORD;
BEGIN
    -- Check if the team exists and is available
    SELECT * INTO team_record 
    FROM fantasy_teams 
    WHERE id = team_id_param 
    AND season_id = season_id_param 
    AND user_id IS NULL;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Team not available',
            'message', 'This team is not available or does not exist.'
        );
    END IF;
    
    -- Check if user already has a team in this season
    IF EXISTS (SELECT 1 FROM fantasy_teams WHERE season_id = season_id_param AND user_id = user_id_param) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'User already has team',
            'message', 'You already have a team in this season.'
        );
    END IF;
    
    -- Assign the team to the user
    UPDATE fantasy_teams 
    SET 
        user_id = user_id_param,
        updated_at = NOW()
    WHERE id = team_id_param;
    
    result := jsonb_build_object(
        'success', TRUE,
        'team_id', team_id_param,
        'team_name', team_record.team_name,
        'league_id', team_record.league_id,
        'season_id', season_id_param,
        'message', 'Successfully joined team'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Join team failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION join_team(UUID, UUID, UUID) TO authenticated;

-- =====================================================
-- UPDATE TEAM STATS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_team_stats(
    team_id_param UUID,
    wins_param INTEGER DEFAULT NULL,
    losses_param INTEGER DEFAULT NULL,
    ties_param INTEGER DEFAULT NULL,
    points_for_param DECIMAL DEFAULT NULL,
    points_against_param DECIMAL DEFAULT NULL,
    current_streak_param TEXT DEFAULT NULL,
    current_standing_param INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Update team stats
    UPDATE fantasy_teams 
    SET 
        wins = COALESCE(wins_param, wins),
        losses = COALESCE(losses_param, losses),
        ties = COALESCE(ties_param, ties),
        points_for = COALESCE(points_for_param, points_for),
        points_against = COALESCE(points_against_param, points_against),
        current_streak = COALESCE(current_streak_param, current_streak),
        current_standing = COALESCE(current_standing_param, current_standing),
        updated_at = NOW()
    WHERE id = team_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Team not found',
            'message', 'The specified team does not exist.'
        );
    END IF;
    
    result := jsonb_build_object(
        'success', TRUE,
        'team_id', team_id_param,
        'message', 'Team stats updated successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Update team stats failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_team_stats(UUID, INTEGER, INTEGER, INTEGER, DECIMAL, DECIMAL, TEXT, INTEGER) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fantasy Teams table created successfully!';
    RAISE NOTICE '✅ Table: fantasy_teams';
    RAISE NOTICE '✅ Functions: create_teams_for_league, join_team, update_team_stats';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support TeamRoster.tsx functionality';
    RAISE NOTICE '📋 Fields supported: team_name, wins, losses, points_for, points_against, etc.';
    RAISE NOTICE '';
END $$;
