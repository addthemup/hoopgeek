-- ============================================================================
-- FIX ADMIN RLS INFINITE RECURSION
-- ============================================================================
-- Issue: The policy checks admin_users to see if you can read admin_users
-- This causes infinite recursion!
-- Solution: Drop the recursive policy, create simple ones
-- ============================================================================

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;

-- Simple policy: Users can view their own admin status (no recursion!)
CREATE POLICY "Users can view own admin status" ON admin_users
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- For admin management (add/remove admins), use service role or Edge Functions
-- This prevents infinite recursion while still protecting the table

-- Verify the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'admin_users';

