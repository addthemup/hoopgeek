-- Fix infinite recursion in league_members RLS policy
-- The issue is that the policy references league_members within itself

-- Drop the problematic policy
DROP POLICY IF EXISTS "Allow league members to read league members" ON league_members;

-- Create a simpler, non-recursive policy
CREATE POLICY "Allow users to read their own league memberships" ON league_members
  FOR SELECT USING (user_id = auth.uid());

-- Also fix the teams policy that has the same issue
DROP POLICY IF EXISTS "Allow league members to read teams in their leagues" ON teams;

-- Create a simpler policy for teams
CREATE POLICY "Allow users to read teams in their leagues" ON teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members 
      WHERE league_members.league_id = teams.league_id 
      AND league_members.user_id = auth.uid()
    )
  );

-- Fix team_players policy as well
DROP POLICY IF EXISTS "Allow league members to read team players" ON team_players;

CREATE POLICY "Allow users to read team players in their leagues" ON team_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN league_members lm ON t.league_id = lm.league_id
      WHERE t.id = team_players.team_id 
      AND lm.user_id = auth.uid()
    )
  );

-- Fix draft_picks policy
DROP POLICY IF EXISTS "Allow league members to read draft picks" ON draft_picks;

CREATE POLICY "Allow users to read draft picks in their leagues" ON draft_picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members 
      WHERE league_members.league_id = draft_picks.league_id 
      AND league_members.user_id = auth.uid()
    )
  );

-- Fix weekly_matchups policy
DROP POLICY IF EXISTS "Allow league members to read matchups" ON weekly_matchups;

CREATE POLICY "Allow users to read matchups in their leagues" ON weekly_matchups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members 
      WHERE league_members.league_id = weekly_matchups.league_id 
      AND league_members.user_id = auth.uid()
    )
  );
