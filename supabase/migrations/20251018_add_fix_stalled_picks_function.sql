-- =====================================================
-- AUTO-FIX STALLED DRAFT PICKS FUNCTION
-- =====================================================
-- Finds and fixes all draft picks that are incomplete
-- but have null time_expires (stalled picks)
-- =====================================================

CREATE OR REPLACE FUNCTION fix_stalled_draft_picks()
RETURNS JSONB AS $$
DECLARE
    fixed_count INTEGER := 0;
    pick_record RECORD;
    team_record RECORD;
    league_settings RECORD;
    time_per_pick INTEGER;
    expires_at TIMESTAMP WITH TIME ZONE;
    result JSONB;
BEGIN
    -- Find all stalled picks (in-progress drafts with incomplete picks that have null time_expires)
    FOR pick_record IN
        SELECT 
            fdo.id,
            fdo.league_id,
            fdo.pick_number,
            fdo.round,
            fdo.team_position
        FROM fantasy_draft_order fdo
        JOIN fantasy_league_seasons fls ON fdo.league_id = fls.league_id
        WHERE fls.draft_status = 'in_progress'
        AND fdo.is_completed = FALSE
        AND fdo.time_expires IS NULL
        ORDER BY fdo.league_id, fdo.pick_number
    LOOP
        -- Get the team for this pick
        SELECT 
            ft.id,
            ft.team_name,
            COALESCE(ft.autodraft_enabled, FALSE) as autodraft_enabled
        INTO team_record
        FROM fantasy_teams ft
        WHERE ft.league_id = pick_record.league_id
        AND ft.draft_position = pick_record.team_position;
        
        -- Get league settings
        SELECT draft_time_per_pick
        INTO league_settings
        FROM fantasy_leagues
        WHERE id = pick_record.league_id;
        
        -- Determine time per pick (3 seconds if autodraft, otherwise league setting or 60)
        IF team_record.autodraft_enabled THEN
            time_per_pick := 3;
        ELSE
            time_per_pick := COALESCE(league_settings.draft_time_per_pick, 60);
        END IF;
        
        -- Calculate expiration time
        expires_at := NOW() + (time_per_pick || ' seconds')::INTERVAL;
        
        -- Update the pick
        UPDATE fantasy_draft_order
        SET 
            time_started = NOW(),
            time_expires = expires_at
        WHERE id = pick_record.id;
        
        fixed_count := fixed_count + 1;
        
        RAISE NOTICE 'Fixed stalled pick: League %, Pick #%, Team "%" (autodraft: %, timer: %s)',
            pick_record.league_id,
            pick_record.pick_number,
            team_record.team_name,
            team_record.autodraft_enabled,
            time_per_pick;
    END LOOP;
    
    result := jsonb_build_object(
        'success', TRUE,
        'fixed_count', fixed_count,
        'message', format('Fixed %s stalled pick(s)', fixed_count),
        'timestamp', NOW()
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to fix stalled picks',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION fix_stalled_draft_picks() TO authenticated;

-- Grant execute permission to service role (for cron jobs)
GRANT EXECUTE ON FUNCTION fix_stalled_draft_picks() TO service_role;

COMMENT ON FUNCTION fix_stalled_draft_picks() IS 
'Automatically fixes all stalled draft picks by setting time_expires to an appropriate value based on team autodraft status and league settings. Returns count of fixed picks.';

-- Test the function (optional - comment out in production)
-- SELECT fix_stalled_draft_picks();

