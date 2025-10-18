-- =====================================================
-- FIX GET_LINEUP_POSITIONS FUNCTION
-- =====================================================
-- Adds position and position_order to the return values
-- This fixes the issue where players were being added to 
-- the wrong position avatar slots
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_lineup_positions(UUID, UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_lineup_positions(
    p_league_id UUID,
    p_fantasy_team_id UUID,
    p_lineup_type TEXT DEFAULT NULL,
    p_week_number INTEGER DEFAULT NULL,
    p_season_year INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    player_id TEXT,
    lineup_type TEXT,
    "position" TEXT,
    position_order INTEGER,
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
        fl.position,
        fl.position_order,
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
    AND (p_week_number IS NULL OR fl.week_number = p_week_number)
    AND (p_season_year IS NULL OR fl.season_year = p_season_year)
    ORDER BY fl.lineup_type, fl.position, fl.position_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_lineup_positions(UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;

