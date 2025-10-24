-- =====================================================
-- FIX RLS POLICIES FOR LEAGUE MEMBERS
-- =====================================================
-- This migration fixes RLS policies to allow users who have joined
-- a league (via invite) to view and interact with league data
-- =====================================================

-- Drop ALL existing policies first (both old and new names)
DROP POLICY IF EXISTS "Users can view leagues they created" ON fantasy_leagues;
DROP POLICY IF EXISTS "Users can view leagues they are members of" ON fantasy_leagues;

CREATE POLICY "Users can view leagues they are members of" ON fantasy_leagues
    FOR SELECT TO authenticated
    USING (
        -- Commissioner can view their leagues
        commissioner_id = auth.uid()
        OR
        -- Users can view leagues where they have a team
        -- Using EXISTS to avoid recursion
        EXISTS (
            SELECT 1 FROM fantasy_teams ft 
            WHERE ft.league_id = fantasy_leagues.id 
            AND ft.user_id = auth.uid()
        )
    );

-- Drop and recreate the fantasy_league_seasons SELECT policy
DROP POLICY IF EXISTS "Users can view seasons in their leagues" ON fantasy_league_seasons;
DROP POLICY IF EXISTS "Users can view seasons in leagues they are members of" ON fantasy_league_seasons;

CREATE POLICY "Users can view seasons in leagues they are members of" ON fantasy_league_seasons
    FOR SELECT TO authenticated
    USING (
        -- Commissioner can view seasons in their leagues
        EXISTS (
            SELECT 1 FROM fantasy_leagues fl 
            WHERE fl.id = fantasy_league_seasons.league_id 
            AND fl.commissioner_id = auth.uid()
        )
        OR
        -- Users can view seasons in leagues where they have a team
        EXISTS (
            SELECT 1 FROM fantasy_teams ft 
            WHERE ft.league_id = fantasy_league_seasons.league_id 
            AND ft.user_id = auth.uid()
        )
    );

-- Add missing policy for users to view ALL teams in leagues they're members of
DROP POLICY IF EXISTS "Users can view teams in their leagues" ON fantasy_teams;
DROP POLICY IF EXISTS "Users can view teams in leagues they are members of" ON fantasy_teams;

CREATE POLICY "Users can view teams in leagues they are members of" ON fantasy_teams
    FOR SELECT TO authenticated
    USING (
        -- Commissioner can view all teams in their leagues
        EXISTS (
            SELECT 1 FROM fantasy_leagues fl 
            WHERE fl.id = fantasy_teams.league_id 
            AND fl.commissioner_id = auth.uid()
        )
        OR
        -- Users own this team
        user_id = auth.uid()
        OR
        -- Users can view all teams in leagues where they have ANY team
        -- This uses a self-join on fantasy_teams to avoid recursion with fantasy_leagues
        EXISTS (
            SELECT 1 FROM fantasy_teams ft2 
            WHERE ft2.league_id = fantasy_teams.league_id 
            AND ft2.user_id = auth.uid()
        )
    );

-- Ensure users can view matchups in their leagues
DROP POLICY IF EXISTS "Users can view matchups in their leagues" ON fantasy_matchups;
DROP POLICY IF EXISTS "Users can view matchups in leagues they are members of" ON fantasy_matchups;

CREATE POLICY "Users can view matchups in leagues they are members of" ON fantasy_matchups
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM fantasy_leagues fl 
            WHERE fl.id = fantasy_matchups.league_id 
            AND fl.commissioner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM fantasy_teams ft 
            WHERE ft.league_id = fantasy_matchups.league_id 
            AND ft.user_id = auth.uid()
        )
    );

-- Ensure users can view roster spots in their leagues
DROP POLICY IF EXISTS "Users can view roster spots in their leagues" ON fantasy_roster_spots;
DROP POLICY IF EXISTS "Users can view roster spots in leagues they are members of" ON fantasy_roster_spots;

CREATE POLICY "Users can view roster spots in leagues they are members of" ON fantasy_roster_spots
    FOR SELECT TO authenticated
    USING (
        -- Users can view roster spots for teams in leagues where they are members
        EXISTS (
            SELECT 1 FROM fantasy_teams ft
            JOIN fantasy_leagues fl ON ft.league_id = fl.id
            WHERE ft.id = fantasy_roster_spots.fantasy_team_id
            AND (
                fl.commissioner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM fantasy_teams ft2
                    WHERE ft2.league_id = fl.id
                    AND ft2.user_id = auth.uid()
                )
            )
        )
    );

-- Ensure users can manage their own roster spots
DROP POLICY IF EXISTS "Users can manage their own roster spots" ON fantasy_roster_spots;

CREATE POLICY "Users can manage their own roster spots" ON fantasy_roster_spots
    FOR ALL TO authenticated
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

-- Grant execute permissions to authenticated users for relevant functions
GRANT EXECUTE ON FUNCTION get_league_data(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_league_by_invite_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_league_by_invite_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION join_league_via_invite(TEXT, UUID, TEXT) TO authenticated;

