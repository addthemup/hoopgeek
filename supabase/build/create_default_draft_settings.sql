-- =====================================================
-- CREATE DEFAULT DRAFT SETTINGS FOR ALL LEAGUES
-- =====================================================
-- This script ensures all leagues have draft settings
-- =====================================================

-- Check which leagues are missing draft settings
SELECT 'Leagues missing draft settings:' as info;
SELECT 
    fl.id as league_id,
    fl.name as league_name,
    fls.id as season_id,
    fls.season_year
FROM fantasy_leagues fl
JOIN fantasy_league_seasons fls ON fl.id = fls.league_id
LEFT JOIN fantasy_draft_settings fds ON fl.id = fds.league_id AND fls.id = fds.season_id
WHERE fds.id IS NULL
ORDER BY fl.name;

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

-- Verify the settings were created
SELECT 'Draft settings created:' as info;
SELECT 
    fds.league_id,
    fl.name as league_name,
    fds.draft_time_per_pick,
    fds.draft_auto_pick_enabled,
    fds.draft_rounds
FROM fantasy_draft_settings fds
JOIN fantasy_leagues fl ON fds.league_id = fl.id
ORDER BY fl.name;
