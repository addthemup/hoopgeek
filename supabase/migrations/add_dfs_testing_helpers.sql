-- ============================================================================
-- DFS TESTING HELPER FUNCTIONS
-- ============================================================================
-- Helper functions for testing and populating DFS pools
-- ============================================================================

-- Function to get all user IDs (for testing/population scripts)
CREATE OR REPLACE FUNCTION get_all_user_ids()
RETURNS TABLE(id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id
  FROM auth.users au
  ORDER BY au.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_user_ids TO service_role;

-- Function to increment pool entry count
CREATE OR REPLACE FUNCTION increment_pool_entries(p_pool_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE dfs_pools
  SET current_entries = current_entries + 1,
      updated_at = NOW()
  WHERE id = p_pool_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_pool_entries TO service_role;

