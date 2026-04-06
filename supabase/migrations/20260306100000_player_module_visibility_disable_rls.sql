-- Ensure player_module_visibility has RLS disabled (global config table, admin-only writes).
-- Fixes "new row violates row-level security policy" when saving module order in player drawer.
-- Idempotent: safe to run even if RLS is already disabled.

DROP POLICY IF EXISTS "player_module_visibility_all_service" ON player_module_visibility;
DROP POLICY IF EXISTS "player_module_visibility_select" ON player_module_visibility;
ALTER TABLE player_module_visibility DISABLE ROW LEVEL SECURITY;
