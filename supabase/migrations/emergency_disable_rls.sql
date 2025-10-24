-- =====================================================
-- EMERGENCY: DISABLE RLS TO FIX INFINITE RECURSION
-- =====================================================
-- This temporarily disables RLS so the system can function
-- We'll rebuild proper policies after
-- =====================================================

-- Disable RLS on the problematic tables
ALTER TABLE fantasy_leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_league_seasons DISABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_matchups DISABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_roster_spots DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies that are causing recursion
DROP POLICY IF EXISTS "Users can view leagues they created" ON fantasy_leagues;
DROP POLICY IF EXISTS "Users can view leagues they are members of" ON fantasy_leagues;

DROP POLICY IF EXISTS "Users can view teams in their leagues" ON fantasy_teams;
DROP POLICY IF EXISTS "Users can view teams in leagues they are members of" ON fantasy_teams;

DROP POLICY IF EXISTS "Users can view seasons in their leagues" ON fantasy_league_seasons;
DROP POLICY IF EXISTS "Users can view seasons in leagues they are members of" ON fantasy_league_seasons;

DROP POLICY IF EXISTS "Users can view matchups in their leagues" ON fantasy_matchups;
DROP POLICY IF EXISTS "Users can view matchups in leagues they are members of" ON fantasy_matchups;

DROP POLICY IF EXISTS "Users can view roster spots in their leagues" ON fantasy_roster_spots;
DROP POLICY IF EXISTS "Users can view roster spots in leagues they are members of" ON fantasy_roster_spots;

