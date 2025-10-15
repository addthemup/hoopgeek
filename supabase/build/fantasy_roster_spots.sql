-- =====================================================
-- FANTASY ROSTER SPOTS TABLE
-- =====================================================
-- This table stores individual roster spots for each team
-- Based on TeamRoster.tsx and DraftPlayers.tsx requirements
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_roster_spots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    
    -- Roster Spot Status
    is_injured_reserve BOOLEAN DEFAULT false, -- Is this an IR spot?
    
    -- Player Assignment (null when empty)
    player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    
    -- Player Assignment Tracking
    assigned_at TIMESTAMP WITH TIME ZONE, -- When player was assigned to this spot
    assigned_by UUID REFERENCES auth.users(id), -- Who assigned the player (for draft tracking)
    draft_round INTEGER, -- Which draft round this player was selected in
    draft_pick INTEGER, -- Which overall pick this player was selected at
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (
        (is_injured_reserve = true) OR
        (is_injured_reserve = false)
    )
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Fantasy Roster Spots Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_roster_spots_team_id ON fantasy_roster_spots(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_roster_spots_season_id ON fantasy_roster_spots(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_roster_spots_player_id ON fantasy_roster_spots(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_roster_spots_injured_reserve ON fantasy_roster_spots(is_injured_reserve);
CREATE INDEX IF NOT EXISTS idx_fantasy_roster_spots_assigned_at ON fantasy_roster_spots(assigned_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on the table
ALTER TABLE fantasy_roster_spots ENABLE ROW LEVEL SECURITY;

-- Users can view roster spots in their leagues
CREATE POLICY "Users can view roster spots in their leagues" ON fantasy_roster_spots
    FOR SELECT TO authenticated
    USING (
        fantasy_team_id IN (
            SELECT ft.id FROM fantasy_teams ft
            JOIN fantasy_leagues fl ON ft.league_id = fl.id
            WHERE fl.commissioner_id = auth.uid()
        ) OR
        fantasy_team_id IN (
            SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
        )
    );

-- Team owners can update their roster spots
CREATE POLICY "Team owners can update their roster spots" ON fantasy_roster_spots
    FOR UPDATE TO authenticated
    USING (
        fantasy_team_id IN (
            SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
        )
    );

-- Commissioners can manage all roster spots in their leagues
CREATE POLICY "Commissioners can manage roster spots in their leagues" ON fantasy_roster_spots
    FOR ALL TO authenticated
    USING (
        fantasy_team_id IN (
            SELECT ft.id FROM fantasy_teams ft
            JOIN fantasy_leagues fl ON ft.league_id = fl.id
            WHERE fl.commissioner_id = auth.uid()
        )
    );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create trigger for updated_at
CREATE TRIGGER update_fantasy_roster_spots_updated_at
    BEFORE UPDATE ON fantasy_roster_spots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CREATE ROSTER SPOTS FOR TEAM FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION create_roster_spots_for_team(
    team_id_param UUID,
    season_id_param UUID,
    total_spots_param INTEGER DEFAULT 15,
    ir_spots_param INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    spots_created INTEGER := 0;
    position_key TEXT;
    position_count INTEGER;
    position_order INTEGER;
    i INTEGER;
BEGIN
    -- Check if roster spots already exist for this team
    IF EXISTS (SELECT 1 FROM fantasy_roster_spots WHERE fantasy_team_id = team_id_param) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Roster spots already exist',
            'message', 'Roster spots have already been created for this team.'
        );
    END IF;

    -- Create regular roster spots
    FOR i IN 1..total_spots_param LOOP
        INSERT INTO fantasy_roster_spots (
            fantasy_team_id,
            season_id,
            is_injured_reserve
        ) VALUES (
            team_id_param,
            season_id_param,
            FALSE
        );
        
        spots_created := spots_created + 1;
    END LOOP;
    
    -- Create injured reserve spots
    FOR i IN 1..ir_spots_param LOOP
        INSERT INTO fantasy_roster_spots (
            fantasy_team_id,
            season_id,
            is_injured_reserve
        ) VALUES (
            team_id_param,
            season_id_param,
            TRUE
        );
        
        spots_created := spots_created + 1;
    END LOOP;
    
    RAISE NOTICE 'Created % roster spots for team %', spots_created, team_id_param;
    
    result := jsonb_build_object(
        'success', TRUE,
        'team_id', team_id_param,
        'season_id', season_id_param,
        'spots_created', spots_created,
        'total_spots', total_spots_param,
        'ir_spots', ir_spots_param,
        'message', 'Roster spots created successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Roster spots creation failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_roster_spots_for_team(UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- =====================================================
-- ASSIGN PLAYER TO ROSTER SPOT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION assign_player_to_roster_spot(
    roster_spot_id_param UUID,
    player_id_param UUID,
    assigned_by_param UUID,
    draft_round_param INTEGER DEFAULT NULL,
    draft_pick_param INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    roster_spot_record RECORD;
BEGIN
    -- Get the roster spot details
    SELECT * INTO roster_spot_record 
    FROM fantasy_roster_spots 
    WHERE id = roster_spot_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Roster spot not found',
            'message', 'The specified roster spot does not exist.'
        );
    END IF;
    
    -- Check if the roster spot is already occupied
    IF roster_spot_record.player_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Roster spot occupied',
            'message', 'This roster spot already has a player assigned.'
        );
    END IF;
    
    -- Check if the player is already on another roster spot
    IF EXISTS (
        SELECT 1 FROM fantasy_roster_spots 
        WHERE player_id = player_id_param 
        AND fantasy_team_id = roster_spot_record.fantasy_team_id
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Player already on team',
            'message', 'This player is already on this team.'
        );
    END IF;
    
    -- Assign the player to the roster spot
    UPDATE fantasy_roster_spots 
    SET 
        player_id = player_id_param,
        assigned_at = NOW(),
        assigned_by = assigned_by_param,
        draft_round = draft_round_param,
        draft_pick = draft_pick_param,
        updated_at = NOW()
    WHERE id = roster_spot_id_param;
    
    result := jsonb_build_object(
        'success', TRUE,
        'roster_spot_id', roster_spot_id_param,
        'player_id', player_id_param,
        'team_id', roster_spot_record.fantasy_team_id,
        'is_injured_reserve', roster_spot_record.is_injured_reserve,
        'message', 'Player assigned to roster spot successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Player assignment failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_player_to_roster_spot(UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- =====================================================
-- REMOVE PLAYER FROM ROSTER SPOT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION remove_player_from_roster_spot(
    roster_spot_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    roster_spot_record RECORD;
BEGIN
    -- Get the roster spot details
    SELECT * INTO roster_spot_record 
    FROM fantasy_roster_spots 
    WHERE id = roster_spot_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Roster spot not found',
            'message', 'The specified roster spot does not exist.'
        );
    END IF;
    
    -- Check if the roster spot is empty
    IF roster_spot_record.player_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Roster spot empty',
            'message', 'This roster spot is already empty.'
        );
    END IF;
    
    -- Remove the player from the roster spot
    UPDATE fantasy_roster_spots 
    SET 
        player_id = NULL,
        assigned_at = NULL,
        assigned_by = NULL,
        draft_round = NULL,
        draft_pick = NULL,
        updated_at = NOW()
    WHERE id = roster_spot_id_param;
    
    result := jsonb_build_object(
        'success', TRUE,
        'roster_spot_id', roster_spot_id_param,
        'team_id', roster_spot_record.fantasy_team_id,
        'is_injured_reserve', roster_spot_record.is_injured_reserve,
        'message', 'Player removed from roster spot successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Player removal failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION remove_player_from_roster_spot(UUID) TO authenticated;

-- =====================================================
-- GET TEAM ROSTER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_team_roster(
    team_id_param UUID
)
RETURNS TABLE (
    roster_spot_id UUID,
    is_injured_reserve BOOLEAN,
    player_id UUID,
    player_name TEXT,
    player_position TEXT,
    player_team TEXT,
    player_salary BIGINT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    draft_round INTEGER,
    draft_pick INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rs.id as roster_spot_id,
        rs.is_injured_reserve,
        rs.player_id,
        np.name as player_name,
        np.position as player_position,
        np.team_abbreviation as player_team,
        np.salary as player_salary,
        rs.assigned_at,
        rs.draft_round,
        rs.draft_pick
    FROM fantasy_roster_spots rs
    LEFT JOIN nba_players np ON rs.player_id = np.id
    WHERE rs.fantasy_team_id = team_id_param
    ORDER BY 
        CASE rs.is_injured_reserve 
            WHEN false THEN 1 
            WHEN true THEN 2 
        END,
        rs.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_team_roster(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fantasy Roster Spots table created successfully!';
    RAISE NOTICE '✅ Table: fantasy_roster_spots';
    RAISE NOTICE '✅ Functions: create_roster_spots_for_team, assign_player_to_roster_spot, remove_player_from_roster_spot, get_team_roster';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support TeamRoster.tsx and DraftPlayers.tsx functionality';
    RAISE NOTICE '📋 Features: Positionless roster spots, draft tracking, IR support';
    RAISE NOTICE '🔄 Roster management: Assign/remove players, frontend handles position validation';
    RAISE NOTICE '';
END $$;
