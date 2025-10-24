-- =====================================================
-- SIMPLE RLS POLICIES - NO RECURSION
-- =====================================================
-- This uses simple policies that don't create circular dependencies
-- Works with existing fantasy_teams table as membership tracker
-- =====================================================

-- First ensure RLS is enabled
ALTER TABLE fantasy_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_league_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_roster_spots ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FANTASY_TEAMS - Base table (no external references)
-- =====================================================
-- This policy checks ONLY the fantasy_teams table itself
-- No references to fantasy_leagues = NO RECURSION

CREATE POLICY "Anyone can view teams where they are a member"
ON fantasy_teams FOR SELECT TO authenticated
USING (
    -- User owns this specific team
    user_id = auth.uid()
    OR
    -- OR user owns ANY team in the same league (self-join)
    league_id IN (
        SELECT league_id 
        FROM fantasy_teams 
        WHERE user_id = auth.uid()
    )
);

-- =====================================================
-- FANTASY_LEAGUES - References fantasy_teams only
-- =====================================================
-- This is safe because fantasy_teams policy doesn't reference fantasy_leagues

CREATE POLICY "Users can view their leagues"
ON fantasy_leagues FOR SELECT TO authenticated
USING (
    -- User is commissioner
    commissioner_id = auth.uid()
    OR
    -- OR user has a team in this league
    id IN (
        SELECT league_id 
        FROM fantasy_teams 
        WHERE user_id = auth.uid()
    )
);

-- =====================================================
-- FANTASY_LEAGUE_SEASONS - References fantasy_teams only
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
-- FANTASY_MATCHUPS - References fantasy_teams only
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
-- FANTASY_ROSTER_SPOTS - References fantasy_teams only
-- =====================================================

CREATE POLICY "Users can view roster spots in their leagues"
ON fantasy_roster_spots FOR SELECT TO authenticated
USING (
    fantasy_team_id IN (
        -- All teams in leagues where user has a team
        SELECT id 
        FROM fantasy_teams 
        WHERE league_id IN (
            SELECT league_id 
            FROM fantasy_teams 
            WHERE user_id = auth.uid()
        )
    )
);

-- =====================================================
-- WRITE POLICIES (for completeness)
-- =====================================================

-- Users can update their own teams
CREATE POLICY "Users can update their own teams"
ON fantasy_teams FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Commissioners can update their leagues
CREATE POLICY "Commissioners can update leagues"
ON fantasy_leagues FOR UPDATE TO authenticated
USING (commissioner_id = auth.uid());

-- Users can manage their own roster spots
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

