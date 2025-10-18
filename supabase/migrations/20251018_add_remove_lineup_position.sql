-- =====================================================
-- REMOVE LINEUP POSITION FUNCTION
-- =====================================================
-- Removes a player from a lineup position
-- =====================================================

CREATE OR REPLACE FUNCTION remove_lineup_position(
    p_league_id UUID,
    p_fantasy_team_id UUID,
    p_player_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    deleted_count INTEGER;
BEGIN
    -- Delete all lineup positions for this player in this team
    DELETE FROM fantasy_lineups
    WHERE league_id = p_league_id
    AND fantasy_team_id = p_fantasy_team_id
    AND player_id::TEXT = p_player_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count = 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Player not found in lineup',
            'message', 'The specified player is not in any lineup position.'
        );
    END IF;
    
    result := jsonb_build_object(
        'success', TRUE,
        'deleted_count', deleted_count,
        'league_id', p_league_id,
        'fantasy_team_id', p_fantasy_team_id,
        'player_id', p_player_id,
        'message', 'Player removed from lineup successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to remove player from lineup',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION remove_lineup_position(UUID, UUID, TEXT) TO authenticated;

