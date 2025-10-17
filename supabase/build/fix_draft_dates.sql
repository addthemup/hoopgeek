-- =====================================================
-- FIX DRAFT DATES FOR ALL LEAGUES
-- =====================================================
-- This script checks and fixes draft dates for all leagues
-- =====================================================

-- First, let's see what's in the database
SELECT 'Current draft dates and statuses:' as info;
SELECT 
    fls.league_id,
    fl.name as league_name,
    fls.draft_date,
    fls.draft_status,
    fls.season_year
FROM fantasy_league_seasons fls
JOIN fantasy_leagues fl ON fls.league_id = fl.id
ORDER BY fls.draft_date;

-- Check if any leagues have null draft dates
SELECT 'Leagues with null draft dates:' as info;
SELECT 
    fls.league_id,
    fl.name as league_name,
    fls.draft_date,
    fls.draft_status
FROM fantasy_league_seasons fls
JOIN fantasy_leagues fl ON fls.league_id = fl.id
WHERE fls.draft_date IS NULL;

-- Check if any leagues have future draft dates
SELECT 'Leagues with future draft dates:' as info;
SELECT 
    fls.league_id,
    fl.name as league_name,
    fls.draft_date,
    fls.draft_status,
    NOW() as current_time
FROM fantasy_league_seasons fls
JOIN fantasy_leagues fl ON fls.league_id = fl.id
WHERE fls.draft_date > NOW();

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

-- Verify the fixes
SELECT 'After fixes - draft dates and statuses:' as info;
SELECT 
    fls.league_id,
    fl.name as league_name,
    fls.draft_date,
    fls.draft_status,
    fls.season_year
FROM fantasy_league_seasons fls
JOIN fantasy_leagues fl ON fls.league_id = fl.id
ORDER BY fls.draft_date;
