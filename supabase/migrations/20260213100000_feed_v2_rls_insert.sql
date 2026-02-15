-- =====================================================================
-- FEED V2 RLS — Allow authenticated users to create & update posts
-- Migration: 20260213100000_feed_v2_rls_insert.sql
--
-- The initial schema only allowed service_role to INSERT/UPDATE.
-- This adds policies so authenticated users can create posts from
-- the admin PostCreator UI.
--
-- Idempotent: drops existing policies before re-creating them.
-- =====================================================================

-- ── Drop existing policies (safe if they don't exist) ──
DROP POLICY IF EXISTS "Authenticated users can create feed posts"          ON feed_posts;
DROP POLICY IF EXISTS "Authenticated users can update own feed posts"      ON feed_posts;
DROP POLICY IF EXISTS "Authenticated users can create sections for own posts" ON feed_post_sections;
DROP POLICY IF EXISTS "Authenticated users can update sections for own posts" ON feed_post_sections;
DROP POLICY IF EXISTS "Authenticated users can delete sections for own posts" ON feed_post_sections;
DROP POLICY IF EXISTS "Authenticated users can read sections of own posts"   ON feed_post_sections;

-- ── feed_posts: INSERT for authenticated users ──
CREATE POLICY "Authenticated users can create feed posts"
    ON feed_posts FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- ── feed_posts: UPDATE own posts ──
CREATE POLICY "Authenticated users can update own feed posts"
    ON feed_posts FOR UPDATE TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- ── feed_post_sections: INSERT when user owns the parent post ──
CREATE POLICY "Authenticated users can create sections for own posts"
    ON feed_post_sections FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM feed_posts
        WHERE id = post_id AND created_by = auth.uid()
    ));

-- ── feed_post_sections: UPDATE when user owns the parent post ──
CREATE POLICY "Authenticated users can update sections for own posts"
    ON feed_post_sections FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM feed_posts
        WHERE id = post_id AND created_by = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM feed_posts
        WHERE id = post_id AND created_by = auth.uid()
    ));

-- ── feed_post_sections: DELETE when user owns the parent post ──
CREATE POLICY "Authenticated users can delete sections for own posts"
    ON feed_post_sections FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM feed_posts
        WHERE id = post_id AND created_by = auth.uid()
    ));

-- ── feed_post_sections: allow authenticated to read draft/archived sections ──
-- (The existing SELECT policy only allows reading sections of published posts.)
CREATE POLICY "Authenticated users can read sections of own posts"
    ON feed_post_sections FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM feed_posts
        WHERE id = post_id AND created_by = auth.uid()
    ));
