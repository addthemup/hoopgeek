-- Fix RLS policies to allow league creation
-- This version only applies to tables that exist
-- Run this in your Supabase SQL editor

-- Drop existing restrictive policies (only if they exist)
DROP POLICY IF EXISTS "Commissioners can manage their leagues" ON leagues;
DROP POLICY IF EXISTS "Commissioners can manage league settings" ON league_settings;
DROP POLICY IF EXISTS "Users can manage their own team" ON teams;
DROP POLICY IF EXISTS "Commissioners can manage all teams in their leagues" ON teams;
DROP POLICY IF EXISTS "Commissioners can manage draft order" ON draft_order;
DROP POLICY IF EXISTS "Commissioners can manage league state" ON league_states;
DROP POLICY IF EXISTS "Commissioners can manage invitations" ON league_invitations;
DROP POLICY IF EXISTS "Commissioners can manage league members" ON league_members;

-- Create specific policies for leagues (this table should exist)
CREATE POLICY "Commissioners can create leagues" ON leagues
  FOR INSERT WITH CHECK (commissioner_id = auth.uid());

CREATE POLICY "Commissioners can update their leagues" ON leagues
  FOR UPDATE USING (commissioner_id = auth.uid());

CREATE POLICY "Commissioners can delete their leagues" ON leagues
  FOR DELETE USING (commissioner_id = auth.uid());

-- Create specific policies for teams (this table should exist)
CREATE POLICY "Commissioners can create teams in their leagues" ON teams
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own team" ON teams
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Commissioners can update all teams in their leagues" ON teams
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Commissioners can delete teams in their leagues" ON teams
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Create specific policies for league_settings (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'league_settings') THEN
        EXECUTE 'CREATE POLICY "Commissioners can create league settings" ON league_settings
          FOR INSERT WITH CHECK (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can update league settings" ON league_settings
          FOR UPDATE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can delete league settings" ON league_settings
          FOR DELETE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
    END IF;
END $$;

-- Create specific policies for draft_order (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'draft_order') THEN
        EXECUTE 'CREATE POLICY "Commissioners can create draft order" ON draft_order
          FOR INSERT WITH CHECK (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can update draft order" ON draft_order
          FOR UPDATE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can delete draft order" ON draft_order
          FOR DELETE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
    END IF;
END $$;

-- Create specific policies for league_states (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'league_states') THEN
        EXECUTE 'CREATE POLICY "Commissioners can create league state" ON league_states
          FOR INSERT WITH CHECK (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can update league state" ON league_states
          FOR UPDATE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can delete league state" ON league_states
          FOR DELETE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
    END IF;
END $$;

-- Create specific policies for league_invitations (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'league_invitations') THEN
        EXECUTE 'CREATE POLICY "Commissioners can create invitations" ON league_invitations
          FOR INSERT WITH CHECK (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can update invitations" ON league_invitations
          FOR UPDATE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can delete invitations" ON league_invitations
          FOR DELETE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
    END IF;
END $$;

-- Create specific policies for league_members (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'league_members') THEN
        EXECUTE 'CREATE POLICY "Commissioners can create league members" ON league_members
          FOR INSERT WITH CHECK (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can update league members" ON league_members
          FOR UPDATE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
        
        EXECUTE 'CREATE POLICY "Commissioners can delete league members" ON league_members
          FOR DELETE USING (
            league_id IN (
              SELECT id FROM leagues 
              WHERE commissioner_id = auth.uid()
            )
          )';
    END IF;
END $$;
