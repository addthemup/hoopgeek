-- =====================================================
-- UPDATE: Sync player team info from nba_team_roster to nba_players
-- Also clears team_id for players NOT in any roster (free agents)
-- =====================================================
-- This function updates nba_players.team_id, team_name, team_abbreviation, and team_city
-- from the more accurate nba_team_roster table (which is updated from team roster API)
-- AND clears team info for players who are not on any roster (free agents)
-- =====================================================

CREATE OR REPLACE FUNCTION sync_player_teams_from_roster(p_season TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    updated_count INTEGER := 0;
    cleared_count INTEGER := 0;
    current_season TEXT;
BEGIN
    -- Determine season to use
    IF p_season IS NULL THEN
        -- Get current season
        SELECT 
            CASE 
                WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 10 THEN 
                    EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || SUBSTRING((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT, 3, 2)
                ELSE 
                    (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT || '-' || SUBSTRING(EXTRACT(YEAR FROM CURRENT_DATE)::TEXT, 3, 2)
            END
        INTO current_season;
    ELSE
        current_season := p_season;
    END IF;
    
    -- Step 1: Update nba_players with team info from nba_team_roster (players who ARE on teams)
    UPDATE nba_players np
    SET 
        team_id = r.team_id,
        team_name = t.city || ' ' || t.nickname,
        team_abbreviation = t.abbreviation,
        team_city = t.city,
        updated_at = NOW()
    FROM nba_team_roster r
    JOIN nba_teams t ON r.team_id = t.team_id
    WHERE np.nba_player_id = r.nba_player_id
        AND r.season = current_season
        AND r.team_id IS NOT NULL
        AND (np.team_id IS NULL OR np.team_id != r.team_id OR np.team_id = 0);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Step 2: Clear team_id for players who are NOT in any current season roster (free agents)
    -- This ensures players who were traded/released get marked as free agents
    UPDATE nba_players np
    SET 
        team_id = NULL,
        team_name = NULL,
        team_abbreviation = NULL,
        team_city = NULL,
        updated_at = NOW()
    WHERE np.team_id IS NOT NULL
        AND np.team_id != 0
        AND NOT EXISTS (
            SELECT 1 
            FROM nba_team_roster r 
            WHERE r.nba_player_id = np.nba_player_id 
                AND r.season = current_season
                AND r.team_id IS NOT NULL
        );
    
    GET DIAGNOSTICS cleared_count = ROW_COUNT;
    
    result := jsonb_build_object(
        'success', TRUE,
        'season', current_season,
        'players_updated', updated_count,
        'free_agents_cleared', cleared_count,
        'message', format('Successfully synced %s players and cleared %s free agents from roster data', updated_count, cleared_count)
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
GRANT EXECUTE ON FUNCTION sync_player_teams_from_roster TO authenticated;

-- Update comment
COMMENT ON FUNCTION sync_player_teams_from_roster IS 'Syncs player team information from nba_team_roster to nba_players. Updates players on teams AND clears team_id for players not on any roster (free agents).';
