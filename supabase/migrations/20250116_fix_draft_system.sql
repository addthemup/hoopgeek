-- =====================================================
-- FIX DRAFT SYSTEM FOR ALL LEAGUES
-- =====================================================
-- This migration fixes draft dates and creates default settings
-- =====================================================

-- Fix draft dates for leagues that need it
DO $$
DECLARE
    league_record RECORD;
BEGIN
    -- Set draft dates to NOW() for leagues that have null or future dates
    -- and are in 'scheduled' status
    FOR league_record IN
        SELECT fls.league_id, fls.id as season_id, fl.name as league_name
        FROM fantasy_league_seasons fls
        JOIN fantasy_leagues fl ON fls.league_id = fl.id
        WHERE fls.draft_status = 'scheduled'
        AND (fls.draft_date IS NULL OR fls.draft_date > NOW())
    LOOP
        UPDATE fantasy_league_seasons
        SET 
            draft_date = NOW(),
            updated_at = NOW()
        WHERE id = league_record.season_id;
        
        RAISE NOTICE '✅ Set draft_date to NOW() for league: % (%)', league_record.league_name, league_record.league_id;
    END LOOP;
    
    RAISE NOTICE '✅ Draft dates fixed for all leagues';
END $$;

-- Create default draft settings for leagues that don't have them
DO $$
DECLARE
    league_record RECORD;
BEGIN
    FOR league_record IN
        SELECT 
            fl.id as league_id,
            fl.name as league_name,
            fls.id as season_id,
            fls.season_year
        FROM fantasy_leagues fl
        JOIN fantasy_league_seasons fls ON fl.id = fls.league_id
        LEFT JOIN fantasy_draft_settings fds ON fl.id = fds.league_id AND fls.id = fds.season_id
        WHERE fds.id IS NULL
    LOOP
        INSERT INTO fantasy_draft_settings (
            league_id,
            season_id,
            draft_type,
            draft_rounds,
            draft_time_per_pick,
            draft_auto_pick_enabled,
            roster_positions,
            scoring_categories,
            waiver_wire,
            waiver_period_days,
            max_trades_per_team,
            max_adds_per_team,
            playoff_teams,
            playoff_weeks,
            playoff_start_week,
            keeper_league,
            max_keepers,
            public_league,
            allow_duplicate_players,
            lineup_deadline,
            lineup_lock_time
        ) VALUES (
            league_record.league_id,
            league_record.season_id,
            'snake',
            15,
            60, -- 60 seconds per pick
            true, -- Auto-pick enabled
            '{"G": 4, "F": 4, "C": 2, "UTIL": 5}',
            '{"PTS": 1, "REB": 1, "AST": 1, "STL": 1, "BLK": 1, "TO": -1}',
            true,
            2,
            10,
            50,
            6,
            3,
            18,
            false,
            3,
            false,
            false,
            'daily',
            'game_start'
        );
        
        RAISE NOTICE '✅ Created default draft settings for league: % (%)', league_record.league_name, league_record.league_id;
    END LOOP;
    
    RAISE NOTICE '✅ Default draft settings created for all leagues';
END $$;
