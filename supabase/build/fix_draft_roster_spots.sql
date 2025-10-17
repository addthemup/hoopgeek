-- =====================================================
-- FIX DRAFT ROSTER SPOTS
-- =====================================================
-- This script ensures that:
-- 1. Draft picks UPDATE existing roster spots (not INSERT new ones)
-- 2. Each team has exactly the correct number of roster spots
-- 3. No duplicate roster spots exist
-- =====================================================

-- Step 1: Identify teams with incorrect roster spot counts
DO $$
DECLARE
    team_record RECORD;
    expected_spots INTEGER;
    actual_spots INTEGER;
BEGIN
    RAISE NOTICE '🔍 Checking roster spot counts for all teams...';
    
    FOR team_record IN 
        SELECT 
            ft.id,
            ft.team_name,
            ft.league_id,
            fl.name as league_name,
            COUNT(frs.id) as spot_count
        FROM fantasy_teams ft
        INNER JOIN fantasy_leagues fl ON ft.league_id = fl.id
        LEFT JOIN fantasy_roster_spots frs ON ft.id = frs.fantasy_team_id
        GROUP BY ft.id, ft.team_name, ft.league_id, fl.name
    LOOP
        -- Get expected roster spots from league settings
        SELECT 
            COALESCE((roster_positions->>'G')::int, 0) +
            COALESCE((roster_positions->>'F')::int, 0) +
            COALESCE((roster_positions->>'C')::int, 0) +
            COALESCE((roster_positions->>'UTIL')::int, 0) +
            COALESCE((roster_positions->>'BENCH')::int, 0) +
            COALESCE((roster_positions->>'IR')::int, 0)
        INTO expected_spots
        FROM fantasy_leagues
        WHERE id = team_record.league_id;
        
        actual_spots := team_record.spot_count;
        
        IF actual_spots != expected_spots THEN
            RAISE WARNING '⚠️  Team "%" (%) has % roster spots but should have %',
                team_record.team_name,
                team_record.league_name,
                actual_spots,
                expected_spots;
        ELSE
            RAISE NOTICE '✅ Team "%" has correct number of roster spots (%)',
                team_record.team_name,
                actual_spots;
        END IF;
    END LOOP;
END $$;

-- Step 2: Find and report duplicate roster spots (same team, same position_order)
WITH duplicate_spots AS (
    SELECT 
        fantasy_team_id,
        position_order,
        COUNT(*) as count
    FROM fantasy_roster_spots
    GROUP BY fantasy_team_id, position_order
    HAVING COUNT(*) > 1
)
SELECT 
    ft.team_name,
    fl.name as league_name,
    ds.position_order,
    ds.count as duplicate_count
FROM duplicate_spots ds
INNER JOIN fantasy_teams ft ON ds.fantasy_team_id = ft.id
INNER JOIN fantasy_leagues fl ON ft.league_id = fl.id;

-- Step 3: Check if make_draft_pick function exists and is correct
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'make_draft_pick'
    ) THEN
        RAISE NOTICE '✅ make_draft_pick function exists';
        
        -- Check if function uses UPDATE (not INSERT) for roster spots
        IF EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = 'make_draft_pick'
            AND pg_get_functiondef(p.oid) LIKE '%UPDATE fantasy_roster_spots%'
            AND pg_get_functiondef(p.oid) NOT LIKE '%INSERT INTO fantasy_roster_spots%'
        ) THEN
            RAISE NOTICE '✅ make_draft_pick correctly UPDATES roster spots (does not INSERT)';
        ELSE
            RAISE WARNING '⚠️  make_draft_pick may be INSERT-ing roster spots instead of UPDATE-ing';
        END IF;
    ELSE
        RAISE ERROR '❌ make_draft_pick function does not exist!';
    END IF;
END $$;

-- Step 4: Verify make_draft_pick function logic
DO $$
DECLARE
    func_def TEXT;
BEGIN
    SELECT pg_get_functiondef(oid) INTO func_def
    FROM pg_proc
    WHERE proname = 'make_draft_pick'
    LIMIT 1;
    
    -- Check for correct UPDATE pattern
    IF func_def LIKE '%SELECT id INTO available_spot_id%' 
       AND func_def LIKE '%FROM fantasy_roster_spots%'
       AND func_def LIKE '%WHERE fantasy_team_id%'
       AND func_def LIKE '%AND player_id IS NULL%'
       AND func_def LIKE '%UPDATE fantasy_roster_spots%'
       AND func_def LIKE '%SET player_id = player_id_param%'
       AND func_def LIKE '%WHERE id = available_spot_id%' THEN
        RAISE NOTICE '✅ make_draft_pick has correct logic:';
        RAISE NOTICE '   1. Finds available (NULL) roster spot';
        RAISE NOTICE '   2. UPDATES that spot with player_id';
        RAISE NOTICE '   3. Does NOT insert new roster spots';
    ELSE
        RAISE WARNING '⚠️  make_draft_pick logic may be incorrect';
    END IF;
END $$;

-- Step 5: Cleanup duplicate roster spots if any exist
DO $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🧹 Checking for duplicate roster spots to clean up...';
    
    -- Keep the oldest roster spot for each team/position, delete the rest
    WITH ranked_spots AS (
        SELECT 
            id,
            fantasy_team_id,
            position_order,
            player_id,
            ROW_NUMBER() OVER (
                PARTITION BY fantasy_team_id, position_order 
                ORDER BY created_at ASC, id ASC
            ) as rn
        FROM fantasy_roster_spots
    ),
    spots_to_delete AS (
        SELECT id 
        FROM ranked_spots 
        WHERE rn > 1
    )
    DELETE FROM fantasy_roster_spots
    WHERE id IN (SELECT id FROM spots_to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        RAISE WARNING '🧹 Deleted % duplicate roster spots', deleted_count;
    ELSE
        RAISE NOTICE '✅ No duplicate roster spots found';
    END IF;
END $$;

-- Step 6: Final verification
DO $$
DECLARE
    total_teams INTEGER;
    teams_with_issues INTEGER;
BEGIN
    -- Count total teams
    SELECT COUNT(*) INTO total_teams FROM fantasy_teams;
    
    -- Count teams with wrong number of roster spots
    WITH team_spot_counts AS (
        SELECT 
            ft.id,
            ft.league_id,
            COUNT(frs.id) as actual_spots,
            (
                SELECT 
                    COALESCE((roster_positions->>'G')::int, 0) +
                    COALESCE((roster_positions->>'F')::int, 0) +
                    COALESCE((roster_positions->>'C')::int, 0) +
                    COALESCE((roster_positions->>'UTIL')::int, 0) +
                    COALESCE((roster_positions->>'BENCH')::int, 0) +
                    COALESCE((roster_positions->>'IR')::int, 0)
                FROM fantasy_leagues
                WHERE id = ft.league_id
            ) as expected_spots
        FROM fantasy_teams ft
        LEFT JOIN fantasy_roster_spots frs ON ft.id = frs.fantasy_team_id
        GROUP BY ft.id, ft.league_id
    )
    SELECT COUNT(*) INTO teams_with_issues
    FROM team_spot_counts
    WHERE actual_spots != expected_spots;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '📊 FINAL REPORT';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE 'Total teams: %', total_teams;
    RAISE NOTICE 'Teams with roster spot issues: %', teams_with_issues;
    
    IF teams_with_issues = 0 THEN
        RAISE NOTICE '✅ ALL TEAMS HAVE CORRECT ROSTER SPOT COUNTS';
    ELSE
        RAISE WARNING '⚠️  % TEAMS HAVE INCORRECT ROSTER SPOT COUNTS', teams_with_issues;
        RAISE NOTICE 'This may indicate roster spots were created incorrectly';
        RAISE NOTICE 'Check team setup and initialization logic';
    END IF;
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- REFERENCE: Correct make_draft_pick logic
-- =====================================================

COMMENT ON FUNCTION make_draft_pick IS 
'Makes a draft pick by:
1. Finding the FIRST AVAILABLE (player_id IS NULL) roster spot for the team
2. UPDATING that roster spot with the picked player_id
3. NEVER inserting new roster spots (they should exist from team creation)
4. Creating a record in fantasy_draft_picks for history
5. Updating fantasy_draft_order to mark pick as completed';

-- =====================================================
-- DIAGNOSTIC QUERY: Use this to check specific teams
-- =====================================================

-- Run this query to see roster spot details for a specific team:
/*
SELECT 
    ft.team_name,
    frs.position_order,
    frs.player_id,
    np.name as player_name,
    frs.created_at,
    frs.assigned_at,
    frs.draft_round,
    frs.draft_pick
FROM fantasy_teams ft
INNER JOIN fantasy_roster_spots frs ON ft.id = frs.fantasy_team_id
LEFT JOIN nba_players np ON frs.player_id = np.id
WHERE ft.id = 'YOUR_TEAM_ID_HERE'
ORDER BY frs.position_order;
*/

