-- =====================================================
-- FANTASY LINEUPS SYSTEM
-- =====================================================
-- Manages weekly lineups for fantasy basketball teams
-- Supports starters, rotation, and bench players with position assignments
-- =====================================================

-- =====================================================
-- FANTASY LINEUPS TABLE
-- =====================================================
-- Stores weekly lineup configurations for each team
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_lineups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Matchup Information (foreign key to specific matchup)
    matchup_id UUID NOT NULL REFERENCES fantasy_matchups(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    
    -- Lineup Status
    is_locked BOOLEAN DEFAULT false,
    is_submitted BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE,
    
    -- Lineup Configuration
    lineup_type TEXT NOT NULL CHECK (lineup_type IN ('starters', 'rotation', 'bench')),
    
    -- Position Assignment
    position TEXT NOT NULL, -- G, F, C, UTIL
    position_order INTEGER, -- Order within the position (1st G, 2nd G, etc.)
    
    -- Player Assignment
    player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    
    -- Court Position (for BasketballCourt component)
    position_x DECIMAL(5,2) DEFAULT 50.0, -- X coordinate (0-100)
    position_y DECIMAL(5,2) DEFAULT 50.0, -- Y coordinate (0-100)
    
    -- Lineup Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, fantasy_team_id, matchup_id, lineup_type, position, position_order)
);

-- =====================================================
-- FANTASY LINEUP SUBMISSIONS TABLE
-- =====================================================
-- Tracks when lineups are submitted and locked
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_lineup_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Matchup Information (foreign key to specific matchup)
    matchup_id UUID NOT NULL REFERENCES fantasy_matchups(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    
    -- Submission Status
    is_locked BOOLEAN DEFAULT false,
    is_submitted BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE,
    locked_at TIMESTAMP WITH TIME ZONE,
    
    -- Submission Details
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, fantasy_team_id, matchup_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Fantasy Lineups Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_league_id ON fantasy_lineups(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_season_id ON fantasy_lineups(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_fantasy_team_id ON fantasy_lineups(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_matchup_id ON fantasy_lineups(matchup_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_week_number ON fantasy_lineups(week_number);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_season_year ON fantasy_lineups(season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_lineup_type ON fantasy_lineups(lineup_type);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_player_id ON fantasy_lineups(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_position ON fantasy_lineups(position);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_team_matchup ON fantasy_lineups(fantasy_team_id, matchup_id);

-- Fantasy Lineup Submissions Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_submissions_league_id ON fantasy_lineup_submissions(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_submissions_season_id ON fantasy_lineup_submissions(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_submissions_fantasy_team_id ON fantasy_lineup_submissions(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_submissions_matchup_id ON fantasy_lineup_submissions(matchup_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_submissions_week_number ON fantasy_lineup_submissions(week_number);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_submissions_season_year ON fantasy_lineup_submissions(season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_submissions_team_matchup ON fantasy_lineup_submissions(fantasy_team_id, matchup_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE fantasy_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_lineup_submissions ENABLE ROW LEVEL SECURITY;

-- Fantasy Lineups Policies
CREATE POLICY "Users can view lineups in their leagues" ON fantasy_lineups
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage lineups for their teams" ON fantasy_lineups
    FOR ALL TO authenticated
    USING (
        fantasy_team_id IN (
            SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Commissioners can manage all lineups" ON fantasy_lineups
    FOR ALL TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- Fantasy Lineup Submissions Policies
CREATE POLICY "Users can view lineup submissions in their leagues" ON fantasy_lineup_submissions
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage lineup submissions for their teams" ON fantasy_lineup_submissions
    FOR ALL TO authenticated
    USING (
        fantasy_team_id IN (
            SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Commissioners can manage all lineup submissions" ON fantasy_lineup_submissions
    FOR ALL TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create triggers for updated_at
CREATE TRIGGER update_fantasy_lineups_updated_at
    BEFORE UPDATE ON fantasy_lineups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_lineup_submissions_updated_at
    BEFORE UPDATE ON fantasy_lineup_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- GET LINEUP POSITIONS FUNCTION
-- =====================================================
-- Replaces the existing get_lineup_positions function
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_lineup_positions(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION get_lineup_positions(
    p_league_id UUID,
    p_fantasy_team_id UUID,
    p_lineup_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    player_id TEXT,
    lineup_type TEXT,
    position_x DECIMAL,
    position_y DECIMAL,
    player_name TEXT,
    player_team TEXT,
    player_position TEXT,
    player_avatar TEXT,
    nba_player_id INTEGER,
    jersey_number TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fl.id,
        fl.player_id::TEXT,
        fl.lineup_type,
        fl.position_x,
        fl.position_y,
        np.name as player_name,
        np.team_abbreviation as player_team,
        np.position as player_position,
        CASE 
            WHEN np.nba_player_id IS NOT NULL THEN 
                'https://cdn.nba.com/headshots/nba/latest/260x190/' || np.nba_player_id || '.png'
            ELSE ''
        END as player_avatar,
        np.nba_player_id,
        np.jersey_number
    FROM fantasy_lineups fl
    LEFT JOIN nba_players np ON fl.player_id = np.id
    WHERE fl.league_id = p_league_id
    AND fl.fantasy_team_id = p_fantasy_team_id
    AND (p_lineup_type IS NULL OR fl.lineup_type = p_lineup_type)
    ORDER BY fl.lineup_type, fl.position, fl.position_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_lineup_positions(UUID, UUID, TEXT) TO authenticated;

-- =====================================================
-- UPSERT LINEUP POSITION FUNCTION
-- =====================================================
-- Handles adding/updating lineup positions
-- =====================================================

CREATE OR REPLACE FUNCTION upsert_lineup_position(
    p_league_id UUID,
    p_season_id UUID,
    p_fantasy_team_id UUID,
    p_matchup_id UUID,
    p_week_number INTEGER,
    p_season_year INTEGER,
    p_lineup_type TEXT,
    p_position TEXT,
    p_position_order INTEGER,
    p_player_id UUID,
    p_position_x DECIMAL DEFAULT 50.0,
    p_position_y DECIMAL DEFAULT 50.0,
    p_created_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    lineup_id UUID;
BEGIN
    -- Validate lineup type
    IF p_lineup_type NOT IN ('starters', 'rotation', 'bench') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid lineup type',
            'message', 'Lineup type must be starters, rotation, or bench'
        );
    END IF;
    
    -- Validate position
    IF p_position NOT IN ('G', 'F', 'C', 'UTIL') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid position',
            'message', 'Position must be G, F, C, or UTIL'
        );
    END IF;
    
    -- Upsert the lineup position
    INSERT INTO fantasy_lineups (
        league_id,
        season_id,
        fantasy_team_id,
        matchup_id,
        week_number,
        season_year,
        lineup_type,
        position,
        position_order,
        player_id,
        position_x,
        position_y,
        created_by,
        updated_by
    ) VALUES (
        p_league_id,
        p_season_id,
        p_fantasy_team_id,
        p_matchup_id,
        p_week_number,
        p_season_year,
        p_lineup_type,
        p_position,
        p_position_order,
        p_player_id,
        p_position_x,
        p_position_y,
        p_created_by,
        p_created_by
    )
    ON CONFLICT (league_id, fantasy_team_id, matchup_id, lineup_type, position, position_order)
    DO UPDATE SET
        player_id = EXCLUDED.player_id,
        position_x = EXCLUDED.position_x,
        position_y = EXCLUDED.position_y,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    RETURNING id INTO lineup_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'lineup_id', lineup_id,
        'league_id', p_league_id,
        'fantasy_team_id', p_fantasy_team_id,
        'matchup_id', p_matchup_id,
        'week_number', p_week_number,
        'lineup_type', p_lineup_type,
        'position', p_position,
        'message', 'Lineup position updated successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Lineup position update failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION upsert_lineup_position(UUID, UUID, UUID, UUID, INTEGER, INTEGER, TEXT, TEXT, INTEGER, UUID, DECIMAL, DECIMAL, UUID) TO authenticated;

-- =====================================================
-- SUBMIT LINEUP FUNCTION
-- =====================================================
-- Handles lineup submission and locking
-- =====================================================

CREATE OR REPLACE FUNCTION submit_lineup(
    p_league_id UUID,
    p_season_id UUID,
    p_fantasy_team_id UUID,
    p_matchup_id UUID,
    p_week_number INTEGER,
    p_season_year INTEGER,
    p_submitted_by UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    submission_id UUID;
BEGIN
    -- Check if lineup is already submitted
    IF EXISTS (
        SELECT 1 FROM fantasy_lineup_submissions 
        WHERE league_id = p_league_id 
        AND fantasy_team_id = p_fantasy_team_id 
        AND matchup_id = p_matchup_id
        AND is_submitted = true
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Lineup already submitted',
            'message', 'This lineup has already been submitted for this week'
        );
    END IF;
    
    -- Upsert lineup submission
    INSERT INTO fantasy_lineup_submissions (
        league_id,
        season_id,
        fantasy_team_id,
        matchup_id,
        week_number,
        season_year,
        is_submitted,
        submitted_at,
        submitted_by
    ) VALUES (
        p_league_id,
        p_season_id,
        p_fantasy_team_id,
        p_matchup_id,
        p_week_number,
        p_season_year,
        true,
        NOW(),
        p_submitted_by
    )
    ON CONFLICT (league_id, fantasy_team_id, matchup_id)
    DO UPDATE SET
        is_submitted = true,
        submitted_at = NOW(),
        submitted_by = p_submitted_by,
        updated_at = NOW()
    RETURNING id INTO submission_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'submission_id', submission_id,
        'league_id', p_league_id,
        'fantasy_team_id', p_fantasy_team_id,
        'matchup_id', p_matchup_id,
        'week_number', p_week_number,
        'submitted_at', NOW(),
        'message', 'Lineup submitted successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Lineup submission failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION submit_lineup(UUID, UUID, UUID, UUID, INTEGER, INTEGER, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fantasy Lineups system created successfully!';
    RAISE NOTICE '✅ Tables: fantasy_lineups, fantasy_lineup_submissions';
    RAISE NOTICE '✅ Functions: get_lineup_positions, upsert_lineup_position, submit_lineup';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support BasketballCourt component and Lineups.tsx';
    RAISE NOTICE '📋 Features: Starters, rotation, bench with position assignments';
    RAISE NOTICE '🔄 Lineup management: Drag-and-drop, position validation, submission';
    RAISE NOTICE '🏀 Court positioning: X/Y coordinates for visual lineup placement';
    RAISE NOTICE '📊 Weekly lineups: Per-team, per-week lineup management';
    RAISE NOTICE '';
END $$;
