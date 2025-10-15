-- =====================================================
-- GET LEAGUE DATA FUNCTION
-- =====================================================
-- This function returns detailed league data including season information
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_league_data(UUID, UUID);

CREATE OR REPLACE FUNCTION get_league_data(
    league_id_param UUID,
    user_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    league_data JSONB;
    league_members JSONB;
BEGIN
    -- Get league data with season information
    SELECT jsonb_build_object(
        'id', fl.id,
        'name', fl.name,
        'description', fl.description,
        'commissioner_id', fl.commissioner_id,
        'logo_url', fl.logo_url,
        'logo_upload_id', fl.logo_upload_id,
        'colors', fl.colors,
        'league_type', fl.league_type,
        'max_teams', fl.max_teams,
        'draft_type', fl.draft_type,
        'draft_rounds', fl.draft_rounds,
        'scoring_type', fl.scoring_type,
        'fantasy_scoring_format', fl.fantasy_scoring_format,
        'lineup_frequency', fl.lineup_frequency,
        'salary_cap_enabled', fl.salary_cap_enabled,
        'trades_enabled', fl.trades_enabled,
        'public_league', fl.public_league,
        'invite_code', fl.invite_code,
        'created_at', fl.created_at,
        'updated_at', fl.updated_at,
        -- Season-specific data
        'season_year', fls.season_year,
        'season_status', fls.season_status,
        'current_teams', fls.current_teams,
        'draft_date', fls.draft_date,
        'draft_status', fls.draft_status,
        'trade_deadline', fls.trade_deadline,
        'salary_cap_amount', fls.salary_cap_amount,
        'roster_positions', fls.roster_positions,
        'starters_count', fls.starters_count,
        'starters_multiplier', fls.starters_multiplier,
        'rotation_count', fls.rotation_count,
        'rotation_multiplier', fls.rotation_multiplier,
        'bench_count', fls.bench_count,
        'bench_multiplier', fls.bench_multiplier,
        'position_unit_assignments', fls.position_unit_assignments,
        'playoff_teams', fls.playoff_teams,
        'playoff_weeks', fls.playoff_weeks
    ) INTO league_data
    FROM fantasy_leagues fl
    LEFT JOIN fantasy_league_seasons fls ON fl.id = fls.league_id AND fls.is_active = true
    WHERE fl.id = league_id_param;

    -- Get league members (teams with users)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', ft.id,
            'league_id', ft.league_id,
            'user_id', ft.user_id,
            'team_name', ft.team_name,
            'is_commissioner', ft.is_commissioner,
            'wins', ft.wins,
            'losses', ft.losses,
            'ties', ft.ties,
            'points_for', ft.points_for,
            'points_against', ft.points_against,
            'current_streak', ft.current_streak,
            'current_standing', ft.current_standing,
            'created_at', ft.created_at
        )
    ) INTO league_members
    FROM fantasy_teams ft
    WHERE ft.league_id = league_id_param;

    -- Return the result
    result := jsonb_build_object(
        'success', TRUE,
        'data', jsonb_build_object(
            'league', league_data,
            'league_members', COALESCE(league_members, '[]'::jsonb)
        ),
        'message', 'League data retrieved successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    result := jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'message', 'Failed to retrieve league data'
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_league_data(UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ get_league_data function created successfully!';
END $$;
