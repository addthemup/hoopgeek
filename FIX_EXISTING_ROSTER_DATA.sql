-- ============================================================================
-- Fix Existing Roster Data After Trades
-- ============================================================================
-- This script fixes rosters that were messed up by trades before the fix
-- It syncs fantasy_team_players with draft_picks to match actual ownership

DO $$
DECLARE
    pick_record RECORD;
    empty_spot_id UUID;
BEGIN
    RAISE NOTICE '🔧 Starting roster data fix...';
    
    -- For each completed pick in draft_picks
    FOR pick_record IN 
        SELECT 
            dp.player_id,
            dp.fantasy_team_id as correct_owner,
            dp.league_id,
            p.name as player_name
        FROM draft_picks dp
        JOIN players p ON p.id = dp.player_id
        WHERE dp.player_id IS NOT NULL
        ORDER BY dp.pick_number
    LOOP
        RAISE NOTICE '🔍 Checking player % (ID: %), should be on team %', 
            pick_record.player_name, pick_record.player_id, pick_record.correct_owner;
        
        -- Check if player is in correct team's roster
        IF NOT EXISTS (
            SELECT 1 
            FROM fantasy_team_players 
            WHERE fantasy_team_id = pick_record.correct_owner 
              AND player_id = pick_record.player_id
        ) THEN
            RAISE NOTICE '❌ Player % is NOT on correct team roster. Fixing...', pick_record.player_name;
            
            -- 1. Remove player from any incorrect roster
            UPDATE fantasy_team_players
            SET player_id = NULL
            WHERE player_id = pick_record.player_id
              AND fantasy_team_id != pick_record.correct_owner;
            
            RAISE NOTICE '   Removed from wrong roster';
            
            -- 2. Find empty spot on correct team
            SELECT id INTO empty_spot_id
            FROM fantasy_team_players
            WHERE fantasy_team_id = pick_record.correct_owner
              AND player_id IS NULL
            LIMIT 1;
            
            IF empty_spot_id IS NULL THEN
                RAISE NOTICE '   ⚠️ WARNING: No empty spot for player % on team %', 
                    pick_record.player_name, pick_record.correct_owner;
            ELSE
                -- 3. Assign to correct team
                UPDATE fantasy_team_players
                SET player_id = pick_record.player_id
                WHERE id = empty_spot_id;
                
                RAISE NOTICE '   ✅ Assigned to correct team';
            END IF;
        ELSE
            RAISE NOTICE '✅ Player % already on correct team', pick_record.player_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Roster data fix complete!';
END $$;

-- Verify the fix
SELECT 
    ft.team_name,
    p.name as player_name,
    dp.fantasy_team_id as owner_in_draft_picks,
    ftp.fantasy_team_id as owner_in_roster,
    CASE 
        WHEN dp.fantasy_team_id = ftp.fantasy_team_id THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as status
FROM draft_picks dp
JOIN players p ON p.id = dp.player_id
JOIN fantasy_team_players ftp ON ftp.player_id = dp.player_id
JOIN fantasy_teams ft ON ft.id = dp.fantasy_team_id
WHERE dp.player_id IS NOT NULL
ORDER BY dp.pick_number;

