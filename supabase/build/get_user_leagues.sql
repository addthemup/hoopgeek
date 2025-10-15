-- =====================================================
-- GET USER LEAGUES FUNCTION
-- =====================================================
-- This function returns all leagues where the user is either
-- the commissioner or a team member, with their team info
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_user_leagues(UUID);

CREATE OR REPLACE FUNCTION get_user_leagues(user_id_param UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    leagues_data JSONB;
BEGIN
    -- Get leagues where user is commissioner or team member
    WITH user_leagues AS (
        -- Leagues where user is commissioner
        SELECT 
            fl.id,
            fl.name,
            fl.description,
            fl.commissioner_id,
            fl.max_teams,
            fl.scoring_type,
            fl.lineup_frequency,
            fl.salary_cap_enabled,
            fl.created_at,
            fl.updated_at,
            fls.id as season_id,
            fls.draft_date,
            fls.draft_status,
            fls.salary_cap_amount,
            ft.id as team_id,
            ft.team_name,
            ft.is_commissioner,
            ft.created_at as joined_at
        FROM fantasy_leagues fl
        LEFT JOIN fantasy_league_seasons fls ON fl.id = fls.league_id AND fls.is_active = true
        LEFT JOIN fantasy_teams ft ON fls.id = ft.season_id AND ft.user_id = user_id_param
        WHERE fl.commissioner_id = user_id_param
        
        UNION
        
        -- Leagues where user is a team member
        SELECT 
            fl.id,
            fl.name,
            fl.description,
            fl.commissioner_id,
            fl.max_teams,
            fl.scoring_type,
            fl.lineup_frequency,
            fl.salary_cap_enabled,
            fl.created_at,
            fl.updated_at,
            fls.id as season_id,
            fls.draft_date,
            fls.draft_status,
            fls.salary_cap_amount,
            ft.id as team_id,
            ft.team_name,
            ft.is_commissioner,
            ft.created_at as joined_at
        FROM fantasy_leagues fl
        LEFT JOIN fantasy_league_seasons fls ON fl.id = fls.league_id AND fls.is_active = true
        LEFT JOIN fantasy_teams ft ON fls.id = ft.season_id AND ft.user_id = user_id_param
        WHERE ft.user_id = user_id_param
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'description', description,
            'commissioner_id', commissioner_id,
            'max_teams', max_teams,
            'scoring_type', scoring_type,
            'lineup_frequency', lineup_frequency,
            'salary_cap_enabled', salary_cap_enabled,
            'salary_cap_amount', salary_cap_amount,
            'draft_date', draft_date,
            'draft_status', draft_status,
            'created_at', created_at,
            'updated_at', updated_at,
            'team_name', team_name,
            'is_commissioner', is_commissioner,
            'joined_at', joined_at
        )
    ) INTO leagues_data
    FROM user_leagues
    WHERE id IS NOT NULL;
    
    -- Return the result
    result := jsonb_build_object(
        'success', TRUE,
        'data', COALESCE(leagues_data, '[]'::jsonb),
        'message', 'User leagues retrieved successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to retrieve user leagues',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_leagues(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ get_user_leagues function created successfully!';
    RAISE NOTICE '✅ Function: get_user_leagues(user_id_param UUID)';
    RAISE NOTICE '✅ Returns: JSONB with user leagues and team info';
    RAISE NOTICE '✅ Supports: Commissioner and team member leagues';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support Dashboard.tsx at http://localhost:3000/fantasy';
    RAISE NOTICE '📋 Fields: id, name, description, max_teams, scoring_type, etc.';
    RAISE NOTICE '👥 Team info: team_name, is_commissioner, joined_at';
    RAISE NOTICE '';
END $$;
