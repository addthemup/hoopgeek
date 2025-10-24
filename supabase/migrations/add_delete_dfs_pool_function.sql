-- ============================================================================
-- DFS Pool Delete Function
-- ============================================================================
-- Creates a function to properly delete DFS pools with all related data
-- This bypasses RLS and ensures cascading deletes work correctly
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_dfs_pool(
  p_pool_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) 
SECURITY DEFINER  -- Run with function owner's permissions (bypasses RLS)
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = p_user_id 
    AND is_active = TRUE
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: User is not an admin'::TEXT;
    RETURN;
  END IF;

  -- Check if pool exists
  IF NOT EXISTS (SELECT 1 FROM dfs_pools WHERE id = p_pool_id) THEN
    RETURN QUERY SELECT FALSE, 'Pool not found'::TEXT;
    RETURN;
  END IF;

  -- Delete in correct order (respecting foreign keys)
  
  -- 1. Delete lineup positions (references lineups)
  DELETE FROM dfs_lineup_positions 
  WHERE pool_id = p_pool_id;
  
  -- 2. Delete lineups (references pool and entries)
  DELETE FROM dfs_lineups 
  WHERE pool_id = p_pool_id;
  
  -- 3. Delete entries (references pool)
  DELETE FROM dfs_entries 
  WHERE pool_id = p_pool_id;
  
  -- 4. Delete player salaries (references pool)
  DELETE FROM dfs_player_salaries 
  WHERE pool_id = p_pool_id;
  
  -- 5. Delete pool games (references pool)
  DELETE FROM dfs_pool_games 
  WHERE pool_id = p_pool_id;
  
  -- 6. Finally delete the pool itself
  DELETE FROM dfs_pools 
  WHERE id = p_pool_id;

  RETURN QUERY SELECT TRUE, 'Pool deleted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_dfs_pool IS
'Deletes a DFS pool and all related data (lineup_positions, lineups, entries, salaries, games).
Only callable by admin users. Uses SECURITY DEFINER to bypass RLS.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_dfs_pool TO authenticated;

