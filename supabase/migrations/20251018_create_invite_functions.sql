-- League Invite System Functions

-- Function to get league info by invite code
CREATE OR REPLACE FUNCTION get_league_by_invite_code(
    invite_code_param TEXT
)
RETURNS JSONB AS $$
DECLARE
    league_record RECORD;
    current_teams_count INTEGER;
BEGIN
    SELECT 
        fl.id,
        fl.name,
        fl.description,
        fl.max_teams,
        fl.commissioner_id,
        fl.scoring_type,
        fl.draft_date,
        fls.draft_status
    INTO league_record
    FROM fantasy_leagues fl
    LEFT JOIN fantasy_league_seasons fls ON fl.id = fls.league_id AND fls.is_active = true
    WHERE fl.invite_code = invite_code_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid invite code',
            'message', 'No league found with this invite code'
        );
    END IF;
    
    SELECT COUNT(*)
    INTO current_teams_count
    FROM fantasy_teams
    WHERE league_id = league_record.id
    AND user_id IS NOT NULL;
    
    IF current_teams_count >= league_record.max_teams THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'league', jsonb_build_object(
                'id', league_record.id,
                'name', league_record.name,
                'description', league_record.description,
                'max_teams', league_record.max_teams,
                'current_teams', current_teams_count,
                'draft_status', league_record.draft_status,
                'is_full', TRUE
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'league', jsonb_build_object(
            'id', league_record.id,
            'name', league_record.name,
            'description', league_record.description,
            'max_teams', league_record.max_teams,
            'current_teams', current_teams_count,
            'draft_status', league_record.draft_status,
            'is_full', FALSE
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Database error',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_league_by_invite_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_league_by_invite_code(TEXT) TO authenticated;

-- Drop existing join_league_via_invite function
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS join_league_via_invite CASCADE;
EXCEPTION 
    WHEN undefined_function THEN NULL;
END $$;

-- Function to join league via invite code
CREATE OR REPLACE FUNCTION join_league_via_invite(
    invite_code_param TEXT,
    user_id_param UUID,
    team_name_param TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    league_record RECORD;
    available_team_record RECORD;
    current_teams_count INTEGER;
    final_team_name TEXT;
BEGIN
    SELECT id, name, max_teams, commissioner_id
    INTO league_record
    FROM fantasy_leagues
    WHERE invite_code = invite_code_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Invalid invite code - league not found'
        );
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM fantasy_teams
        WHERE league_id = league_record.id
        AND user_id = user_id_param
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'You are already a member of this league'
        );
    END IF;
    
    SELECT COUNT(*)
    INTO current_teams_count
    FROM fantasy_teams
    WHERE league_id = league_record.id
    AND user_id IS NOT NULL
    AND user_id != league_record.commissioner_id;
    
    IF current_teams_count >= (league_record.max_teams - 1) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'This league is full - no more spots available'
        );
    END IF;
    
    SELECT id, team_name, season_id
    INTO available_team_record
    FROM fantasy_teams
    WHERE league_id = league_record.id
    AND user_id IS NULL
    AND is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'No available team slots found in this league'
        );
    END IF;
    
    IF team_name_param IS NOT NULL AND trim(team_name_param) != '' THEN
        final_team_name := trim(team_name_param);
    ELSE
        final_team_name := available_team_record.team_name;
    END IF;
    
    UPDATE fantasy_teams
    SET 
        user_id = user_id_param,
        team_name = final_team_name,
        updated_at = NOW()
    WHERE id = available_team_record.id;
    
    INSERT INTO fantasy_roster_spots (
        fantasy_team_id,
        league_id,
        season_id,
        player_id,
        position_type,
        created_at,
        updated_at
    )
    SELECT
        available_team_record.id,
        league_record.id,
        available_team_record.season_id,
        NULL,
        'regular',
        NOW(),
        NOW()
    FROM generate_series(1, 15);
    
    RAISE NOTICE 'User % assigned to team % in league %', user_id_param, available_team_record.id, league_record.id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Successfully joined the league',
        'team_id', available_team_record.id,
        'league_id', league_record.id,
        'team_name', final_team_name,
        'is_new_team', FALSE
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'message', 'Failed to join league: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_league_via_invite(TEXT, UUID, TEXT) TO authenticated;
