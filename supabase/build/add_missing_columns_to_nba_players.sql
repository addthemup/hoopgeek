-- =====================================================
-- ADD MISSING COLUMNS TO NBA_PLAYERS TABLE
-- =====================================================
-- This script adds the missing columns that were added to the table definition
-- but not to existing tables
-- =====================================================

-- Add missing columns to nba_players table
ALTER TABLE nba_players 
ADD COLUMN IF NOT EXISTS player_slug TEXT,
ADD COLUMN IF NOT EXISTS team_slug TEXT,
ADD COLUMN IF NOT EXISTS team_city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS roster_status TEXT;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Missing columns added to nba_players table successfully!';
    RAISE NOTICE '✅ Added: player_slug, team_slug, team_city, country, roster_status';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Now the comprehensive import script should work!';
    RAISE NOTICE '';
END $$;
