-- Allow authenticated users who are admins to delete feed posts.
-- Also allows post creators to delete their own posts.

DROP POLICY IF EXISTS "Authenticated users can delete own feed posts" ON feed_posts;
DROP POLICY IF EXISTS "Admin users can delete any feed posts"         ON feed_posts;

-- Post creators can delete their own posts
CREATE POLICY "Authenticated users can delete own feed posts"
    ON feed_posts FOR DELETE TO authenticated
    USING (auth.uid() = created_by);

-- Admin users (in admin_users table) can delete any post
CREATE POLICY "Admin users can delete any feed posts"
    ON feed_posts FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = auth.uid() AND is_active = true
    ));
