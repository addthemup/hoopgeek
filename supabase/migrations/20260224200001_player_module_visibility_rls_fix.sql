-- Fix: drop overly restrictive RLS policies and disable RLS on
-- player_module_visibility to match feed_module_visibility (config table,
-- not user data). The admin panel writes via the authenticated client.

DROP POLICY IF EXISTS "player_module_visibility_all_service" ON player_module_visibility;
DROP POLICY IF EXISTS "player_module_visibility_select" ON player_module_visibility;
ALTER TABLE player_module_visibility DISABLE ROW LEVEL SECURITY;
