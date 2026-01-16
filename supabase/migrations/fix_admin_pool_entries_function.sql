-- ============================================================================
-- FIX: Admin Pool Entries Function to Return ALL Entries
-- ============================================================================
-- This fixes the issue where some entries were not being returned
-- by ensuring all entries are included even if user data is missing
-- ============================================================================

-- First, add an admin policy to allow admins to view all entries
-- Drop existing conflicting policies first
DROP POLICY IF EXISTS "Admins can view all entries" ON dfs_entries;
DROP POLICY IF EXISTS "Users can view own entries" ON dfs_entries;
DROP POLICY IF EXISTS "Users can view their own entries" ON dfs_entries;

-- Create admin policy that allows admins to view ALL entries
CREATE POLICY "Admins can view all entries" ON dfs_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
        AND is_active = TRUE
    )
  );

-- Now update the function to explicitly bypass RLS
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
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
      AND is_active = TRUE
  ) INTO v_is_admin;

  -- If not admin, raise exception
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Return ALL entries with user details from auth.users
  -- SECURITY DEFINER should bypass RLS when the function owner has access
  -- The admin policy should also allow admins to view all entries
  -- Using LEFT JOINs ensures entries are returned even if user data is missing
  RETURN QUERY
  SELECT 
    e.id as entry_id,
    e.user_id,
    COALESCE(au.email, 'user-' || SUBSTRING(e.user_id::text, 1, 8) || '@unknown') as user_email,
    COALESCE(
      NULLIF(p.display_name, ''), 
      NULLIF(SPLIT_PART(au.email, '@', 1), ''),
      'user-' || SUBSTRING(e.user_id::text, 1, 8)
    ) as user_display_name,
    p.avatar_url as user_avatar_url,
    e.final_points,
    e.final_rank,
    e.prize_amount,
    COALESCE(e.is_submitted, FALSE) as is_submitted,
    COALESCE(e.lineup_locked, FALSE) as lineup_locked,
    e.created_at,
    COALESCE(e.total_salary, 0) as total_salary
  FROM public.dfs_entries e
  LEFT JOIN auth.users au ON au.id = e.user_id
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.pool_id = p_pool_id
  ORDER BY 
    CASE WHEN e.final_rank IS NULL THEN 1 ELSE 0 END,
    e.final_rank ASC NULLS LAST,
    e.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin status internally)
GRANT EXECUTE ON FUNCTION get_admin_pool_entries TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_pool_entries TO service_role;

COMMENT ON FUNCTION get_admin_pool_entries IS 
'Returns ALL entries for a pool with user details. Admin access only. 
This function bypasses RLS and returns all entries even if user data is missing.';

-- Verify the function was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_pool_entries') THEN
    RAISE NOTICE '✅ Function get_admin_pool_entries created successfully';
  ELSE
    RAISE WARNING '❌ Function get_admin_pool_entries was NOT created';
  END IF;
END $$;

