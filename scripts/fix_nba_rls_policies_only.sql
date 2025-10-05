-- Fix RLS policies for NBA tables to allow authenticated users to insert/update
-- This script only updates the policies, doesn't recreate tables

-- Drop existing policies for NBA tables
DROP POLICY IF EXISTS "Allow authenticated users to read NBA games" ON nba_games;
DROP POLICY IF EXISTS "Allow service role to manage NBA games" ON nba_games;
DROP POLICY IF EXISTS "Allow authenticated users to read NBA season weeks" ON nba_season_weeks;
DROP POLICY IF EXISTS "Allow service role to manage NBA season weeks" ON nba_season_weeks;

-- Create new policies that allow authenticated users to insert/update
CREATE POLICY "Allow authenticated users to manage NBA games" ON nba_games
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage NBA games" ON nba_games
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to manage NBA season weeks" ON nba_season_weeks
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage NBA season weeks" ON nba_season_weeks
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
