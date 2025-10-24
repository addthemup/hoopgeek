-- =====================================================
-- ULTRA SIMPLE RLS - NO SUBQUERIES ON FANTASY_TEAMS
-- =====================================================
-- This version uses NO subqueries on fantasy_teams to avoid recursion
-- =====================================================

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view leagues they created" ON fantasy_leagues;
DROP POLICY IF EXISTS "Users can view leagues they are members of" ON fantasy_leagues;
DROP POLICY IF EXISTS "Users can view their leagues" ON fantasy_leagues;

DROP POLICY IF EXISTS "Users can view teams in their leagues" ON fantasy_teams;
DROP POLICY IF EXISTS "Users can view teams in leagues they are members of" ON fantasy_teams;
DROP POLICY IF EXISTS "Anyone can view teams where they are a member" ON fantasy_teams;

DROP POLICY IF EXISTS "Users can view seasons in their leagues" ON fantasy_league_seasons;
DROP POLICY IF EXISTS "Users can view seasons in leagues they are members of" ON fantasy_league_seasons;

DROP POLICY IF EXISTS "Users can view matchups in their leagues" ON fantasy_matchups;
DROP POLICY IF EXISTS "Users can view matchups in leagues they are members of" ON fantasy_matchups;

DROP POLICY IF EXISTS "Users can view roster spots in their leagues" ON fantasy_roster_spots;
DROP POLICY IF EXISTS "Users can view roster spots in leagues they are members of" ON fantasy_roster_spots;

DROP POLICY IF EXISTS "Users can update their own teams" ON fantasy_teams;
DROP POLICY IF EXISTS "Commissioners can update leagues" ON fantasy_leagues;
DROP POLICY IF EXISTS "Users can manage their roster spots" ON fantasy_roster_spots;

-- Disable RLS on fantasy_teams completely (it's the source of recursion)
ALTER TABLE fantasy_teams DISABLE ROW LEVEL SECURITY;

-- Keep RLS enabled on other tables
ALTER TABLE fantasy_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_league_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_roster_spots ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FANTASY_LEAGUES - Simple direct check
-- =====================================================

CREATE POLICY "Users can view their leagues"
ON fantasy_leagues FOR SELECT TO authenticated
USING (
    -- User is commissioner
    commissioner_id = auth.uid()
    OR
    -- OR user has a team in this league (safe because fantasy_teams has no RLS)
    id IN (
        SELECT league_id 
        FROM fantasy_teams 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Commissioners can update leagues"
ON fantasy_leagues FOR UPDATE TO authenticated
USING (commissioner_id = auth.uid());

-- =====================================================
-- FANTASY_LEAGUE_SEASONS
-- =====================================================

CREATE POLICY "Users can view seasons in their leagues"
ON fantasy_league_seasons FOR SELECT TO authenticated
USING (
    league_id IN (
        SELECT league_id 
        FROM fantasy_teams 
        WHERE user_id = auth.uid()
    )
);

-- =====================================================
-- FANTASY_MATCHUPS
-- =====================================================

CREATE POLICY "Users can view matchups in their leagues"
ON fantasy_matchups FOR SELECT TO authenticated
USING (
    league_id IN (
        SELECT league_id 
        FROM fantasy_teams 
        WHERE user_id = auth.uid()
    )
);

-- =====================================================
-- FANTASY_ROSTER_SPOTS
-- =====================================================

CREATE POLICY "Users can view roster spots in their leagues"
ON fantasy_roster_spots FOR SELECT TO authenticated
USING (
    fantasy_team_id IN (
        SELECT id 
        FROM fantasy_teams 
        WHERE league_id IN (
            SELECT league_id 
            FROM fantasy_teams 
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can manage their roster spots"
ON fantasy_roster_spots FOR ALL TO authenticated
USING (
    fantasy_team_id IN (
        SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    fantasy_team_id IN (
        SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
    )
);

