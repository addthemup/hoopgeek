-- Final RLS fix for league creation
-- This will drop all existing policies and recreate them properly

-- Drop ALL existing policies on leagues table
DROP POLICY IF EXISTS "Allow all users to read public leagues" ON leagues;
DROP POLICY IF EXISTS "Allow league members to read their leagues" ON leagues;
DROP POLICY IF EXISTS "Allow authenticated users to create leagues" ON leagues;
DROP POLICY IF EXISTS "Allow commissioners to update their leagues" ON leagues;
DROP POLICY IF EXISTS "Allow commissioners to delete their leagues" ON leagues;
DROP POLICY IF EXISTS "Commissioners can create leagues" ON leagues;
DROP POLICY IF EXISTS "Commissioners can manage their leagues" ON leagues;

-- Drop ALL existing policies on league_members table
DROP POLICY IF EXISTS "Allow league members to read league members" ON league_members;
DROP POLICY IF EXISTS "Allow users to join leagues" ON league_members;
DROP POLICY IF EXISTS "Allow users to leave leagues" ON league_members;
DROP POLICY IF EXISTS "Allow commissioners to manage league members" ON league_members;

-- Drop ALL existing policies on teams table
DROP POLICY IF EXISTS "Allow team owners to manage their teams" ON teams;
DROP POLICY IF EXISTS "Allow league members to read teams in their leagues" ON teams;
DROP POLICY IF EXISTS "Allow commissioners to create teams in their leagues" ON teams;
DROP POLICY IF EXISTS "Allow commissioners to update all teams in their leagues" ON teams;
DROP POLICY IF EXISTS "Allow commissioners to delete teams in their leagues" ON teams;
DROP POLICY IF EXISTS "Users can manage their own team" ON teams;
DROP POLICY IF EXISTS "Commissioners can manage all teams in their leagues" ON teams;

-- Create SIMPLE, WORKING policies for leagues
CREATE POLICY "leagues_select_policy" ON leagues
  FOR SELECT USING (true);

CREATE POLICY "leagues_insert_policy" ON leagues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "leagues_update_policy" ON leagues
  FOR UPDATE USING (commissioner_id = auth.uid());

CREATE POLICY "leagues_delete_policy" ON leagues
  FOR DELETE USING (commissioner_id = auth.uid());

-- Create SIMPLE, WORKING policies for league_members
CREATE POLICY "league_members_select_policy" ON league_members
  FOR SELECT USING (true);

CREATE POLICY "league_members_insert_policy" ON league_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "league_members_update_policy" ON league_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "league_members_delete_policy" ON league_members
  FOR DELETE USING (user_id = auth.uid());

-- Create SIMPLE, WORKING policies for teams
CREATE POLICY "teams_select_policy" ON teams
  FOR SELECT USING (true);

CREATE POLICY "teams_insert_policy" ON teams
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "teams_update_policy" ON teams
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "teams_delete_policy" ON teams
  FOR DELETE USING (user_id = auth.uid());

-- Create SIMPLE, WORKING policies for league_settings (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'league_settings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow league members to read league settings" ON league_settings';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to create league settings" ON league_settings';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to update league settings" ON league_settings';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to delete league settings" ON league_settings';
        
        EXECUTE 'CREATE POLICY "league_settings_select_policy" ON league_settings FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "league_settings_insert_policy" ON league_settings FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
        EXECUTE 'CREATE POLICY "league_settings_update_policy" ON league_settings FOR UPDATE USING (true)';
        EXECUTE 'CREATE POLICY "league_settings_delete_policy" ON league_settings FOR DELETE USING (true)';
    END IF;
END $$;

-- Create SIMPLE, WORKING policies for draft_order (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'draft_order') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow league members to read draft order" ON draft_order';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to create draft order" ON draft_order';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to update draft order" ON draft_order';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to delete draft order" ON draft_order';
        
        EXECUTE 'CREATE POLICY "draft_order_select_policy" ON draft_order FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "draft_order_insert_policy" ON draft_order FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
        EXECUTE 'CREATE POLICY "draft_order_update_policy" ON draft_order FOR UPDATE USING (true)';
        EXECUTE 'CREATE POLICY "draft_order_delete_policy" ON draft_order FOR DELETE USING (true)';
    END IF;
END $$;

-- Create SIMPLE, WORKING policies for league_states (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'league_states') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow league members to read league state" ON league_states';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to create league state" ON league_states';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to update league state" ON league_states';
        EXECUTE 'DROP POLICY IF EXISTS "Allow commissioners to delete league state" ON league_states';
        
        EXECUTE 'CREATE POLICY "league_states_select_policy" ON league_states FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "league_states_insert_policy" ON league_states FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
        EXECUTE 'CREATE POLICY "league_states_update_policy" ON league_states FOR UPDATE USING (true)';
        EXECUTE 'CREATE POLICY "league_states_delete_policy" ON league_states FOR DELETE USING (true)';
    END IF;
END $$;
