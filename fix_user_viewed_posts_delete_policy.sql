-- ============================================================================
-- FIX: Add DELETE policy for user_viewed_posts to allow admin cascade deletes
-- ============================================================================
-- This fixes the issue where admins can't delete feed_posts because 
-- user_viewed_posts RLS blocks the cascade delete
-- ============================================================================

-- Drop existing policy if it exists (in case we need to recreate)
DROP POLICY IF EXISTS "Admins can delete user viewed posts" ON user_viewed_posts;

-- Add DELETE policy for admins to allow cascade deletes
CREATE POLICY "Admins can delete user viewed posts"
  ON user_viewed_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.role IN ('super_admin', 'content_admin')
        AND au.is_active = TRUE
    )
  );

-- Also allow users to delete their own viewed posts (for cleanup)
-- This might already be handled by CASCADE, but good to have explicit
DROP POLICY IF EXISTS "Users can delete own viewed posts" ON user_viewed_posts;

CREATE POLICY "Users can delete own viewed posts"
  ON user_viewed_posts FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Admins can delete user viewed posts" ON user_viewed_posts IS
'Allows admins to delete user_viewed_posts records, enabling cascade deletes from feed_content';

