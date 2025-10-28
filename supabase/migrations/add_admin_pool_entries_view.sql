-- ============================================================================
-- ADMIN POOL ENTRIES VIEW WITH USER DETAILS
-- ============================================================================
-- Creates a function that allows admins to view all pool entries with user emails
-- This bypasses RLS for admin users only
-- ============================================================================

-- Function to get pool entries with user details (admin only)
CREATE OR REPLACE FUNCTION get_admin_pool_entries(p_pool_id UUID)
RETURNS TABLE (
  entry_id UUID,
  user_id UUID,
  user_email TEXT,
  user_display_name TEXT,
  user_avatar_url TEXT,
  final_points DECIMAL,
  final_rank INTEGER,
  prize_amount DECIMAL,
  is_submitted BOOLEAN,
  lineup_locked BOOLEAN,
  created_at TIMESTAMPTZ,
  total_salary BIGINT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if the current user is an admin
  SELECT is_admin INTO v_is_admin
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- If not admin, raise exception
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Return entries with user details from auth.users
  RETURN QUERY
  SELECT 
    e.id as entry_id,
    e.user_id,
    COALESCE(au.email, 'unknown@example.com') as user_email,
    COALESCE(p.display_name, SPLIT_PART(au.email, '@', 1)) as user_display_name,
    p.avatar_url as user_avatar_url,
    e.final_points,
    e.final_rank,
    e.prize_amount,
    e.is_submitted,
    e.lineup_locked,
    e.created_at,
    e.total_salary
  FROM dfs_entries e
  LEFT JOIN auth.users au ON au.id = e.user_id
  LEFT JOIN profiles p ON p.id = e.user_id
  WHERE e.pool_id = p_pool_id
  ORDER BY 
    CASE WHEN e.final_rank IS NULL THEN 1 ELSE 0 END,
    e.final_rank ASC;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin status internally)
GRANT EXECUTE ON FUNCTION get_admin_pool_entries TO authenticated;

COMMENT ON FUNCTION get_admin_pool_entries IS 
'Returns all entries for a pool with user details. Admin access only.';

-- ============================================================================
-- USAGE
-- ============================================================================
-- 
-- To use this function in your React code:
-- 
-- const { data, error } = await supabase.rpc('get_admin_pool_entries', {
--   p_pool_id: poolId
-- });
-- 
-- This will return all entries with:
-- - entry_id: UUID of the entry
-- - user_id: UUID of the user
-- - user_email: Email from auth.users
-- - user_display_name: Display name or email username
-- - user_avatar_url: Avatar URL from profiles
-- - final_points: Score
-- - final_rank: Rank in pool
-- - prize_amount: Prize won
-- - is_submitted: Whether entry is submitted
-- - lineup_locked: Whether lineup is locked
-- - created_at: When entry was created
-- - total_salary: Total salary used
-- 
-- ============================================================================

