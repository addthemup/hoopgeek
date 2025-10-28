-- ============================================================================
-- FEED POSTS SYSTEM - Manual Content Creation for Instagram-style Feed
-- ============================================================================
-- This system allows super admins to manually create curated feed posts
-- Posts are created slide-by-slide using uploaded JSON game data (not stored)
-- Supports drafts, publishing, and social engagement
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Post types (expandable)
CREATE TYPE feed_post_type AS ENUM (
  'game_highlight',       -- Standard game highlights carousel
  'buzzer_beater',        -- Buzzer beater moments
  'player_spotlight',     -- Focus on specific player performance
  'rookie_watch',         -- Rookie player highlights
  'team_performance',     -- Team-focused content
  'stat_showcase',        -- Statistical breakdowns with charts
  'comparison',           -- Player/team comparisons
  'milestone',            -- Career/season milestones
  'custom'                -- Custom post type
);

-- Post status
CREATE TYPE feed_post_status AS ENUM (
  'draft',                -- Saved but not published
  'published',            -- Live on feed
  'scheduled',            -- Scheduled for future publication
  'archived'              -- Archived/hidden from feed
);

-- Slide types (expandable for future features)
CREATE TYPE feed_slide_type AS ENUM (
  'video',                -- Video highlight
  'image',                -- Static image
  'player_profile',       -- Player profile card
  'stat_chart',           -- Statistical chart/visualization
  'team_matchup',         -- Team matchup overview
  'quote',                -- Text quote/caption
  'game_summary',         -- Game summary with score
  'custom'                -- Custom slide type
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Feed posts (manually curated content)
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Author & Permissions
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT, -- Denormalized for display
  
  -- Post Classification
  post_type feed_post_type NOT NULL DEFAULT 'game_highlight',
  status feed_post_status NOT NULL DEFAULT 'draft',
  
  -- Content
  title TEXT, -- Optional title for post
  description TEXT, -- Short description/caption
  
  -- Game Association (optional - for context, not required)
  game_id VARCHAR(50), -- FK to nba_games.game_id (optional)
  game_date TIMESTAMPTZ, -- Denormalized for feed sorting
  
  -- Team/Player Tags (for filtering and discovery)
  team_tricodes TEXT[], -- e.g., ['LAL', 'BOS']
  player_ids BIGINT[], -- Player IDs featured in this post
  
  -- Slides (JSONB array of slide data)
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure:
  -- [
  --   {
  --     "type": "video",
  --     "order": 0,
  --     "video_url": "https://...",
  --     "thumbnail_url": "https://...",
  --     "caption": "LeBron drives baseline...",
  --     "duration": 15,
  --     "metadata": { ... }
  --   },
  --   {
  --     "type": "stat_chart",
  --     "order": 1,
  --     "chart_type": "bar",
  --     "data": { ... },
  --     "caption": "Points breakdown..."
  --   }
  -- ]
  
  -- Metadata (additional post data)
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Can include:
  -- - "season": "2024-25"
  -- - "arena": "Crypto.com Arena"
  -- - "fun_score": 95
  -- - "quarter_scores": [[30,28], [25,27], ...]
  -- - etc.
  
  -- Thumbnail (first slide or custom)
  thumbnail_url TEXT,
  
  -- Social Engagement (denormalized for performance)
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  
  -- Publishing
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  
  -- SEO & Sharing
  share_title TEXT, -- Title for social sharing
  share_description TEXT, -- Description for social sharing
  share_image_url TEXT, -- Image for social sharing (Open Graph)
  
  -- Pinning & Featuring
  is_pinned BOOLEAN DEFAULT FALSE, -- Pin to top of feed
  is_featured BOOLEAN DEFAULT FALSE, -- Feature in special section
  featured_order INTEGER, -- Order in featured section
  
  -- Feed Algorithm Override
  boost_score NUMERIC(3,1) DEFAULT 0, -- Manual boost for feed ranking (0-10)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_boost_score CHECK (boost_score >= 0 AND boost_score <= 10),
  CONSTRAINT published_has_timestamp CHECK (
    (status = 'published' AND published_at IS NOT NULL) OR
    (status != 'published')
  ),
  CONSTRAINT scheduled_has_timestamp CHECK (
    (status = 'scheduled' AND scheduled_for IS NOT NULL) OR
    (status != 'scheduled')
  ),
  CONSTRAINT slides_not_empty CHECK (jsonb_array_length(slides) > 0)
);

-- Feed content table (consolidated view of ALL feed items: posts + algorithmic)
-- This is what the Highlights page queries
-- Drop and recreate to ensure clean schema
DROP TABLE IF EXISTS public.feed_content CASCADE;

CREATE TABLE public.feed_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source tracking
  source_type TEXT NOT NULL CHECK (source_type IN ('post', 'algorithmic')),
  source_id UUID, -- References feed_posts.id if source_type='post', null otherwise
  
  -- Content Type
  content_type TEXT NOT NULL, -- 'fun', 'highlight', 'milestone', etc.
  
  -- Game Information
  game_id VARCHAR(50) NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,
  
  -- Core Data (JSONB for flexibility)
  story_data JSONB, -- Teams, scores, matchup info
  fun_data JSONB, -- Lead changes, dunks, deep shots, etc.
  fun_score NUMERIC(5,2),
  
  -- Video/Slides
  video_script JSONB, -- Array of video highlights
  total_plays INTEGER,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Social Engagement
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  
  -- Feed Ranking
  feed_score NUMERIC(10,4), -- Calculated feed ranking score
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Foreign Key to posts (if manual post)
  CONSTRAINT fk_feed_content_post FOREIGN KEY (source_id) 
    REFERENCES feed_posts(id) ON DELETE CASCADE,
  
  -- Unique constraint: each source_id can only have one feed_content entry
  CONSTRAINT unique_feed_content_source UNIQUE NULLS NOT DISTINCT (source_id)
);

-- Social Engagement Tables
DROP TABLE IF EXISTS public.feed_likes CASCADE;
DROP TABLE IF EXISTS public.feed_comments CASCADE;
DROP TABLE IF EXISTS public.feed_shares CASCADE;

CREATE TABLE public.feed_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL, -- Can reference feed_content.id OR feed_posts.id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_like UNIQUE(content_id, user_id)
);

CREATE TABLE public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL, -- Can reference feed_content.id OR feed_posts.id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  parent_comment_id UUID REFERENCES feed_comments(id) ON DELETE CASCADE, -- For replies
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.feed_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL, -- Can reference feed_content.id OR feed_posts.id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'twitter', 'facebook', 'instagram', 'copy', etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Feed posts
CREATE INDEX idx_feed_posts_status ON feed_posts(status);
CREATE INDEX idx_feed_posts_published ON feed_posts(published_at DESC) 
  WHERE status = 'published';
CREATE INDEX idx_feed_posts_scheduled ON feed_posts(scheduled_for) 
  WHERE status = 'scheduled';
CREATE INDEX idx_feed_posts_game ON feed_posts(game_id) WHERE game_id IS NOT NULL;
CREATE INDEX idx_feed_posts_game_date ON feed_posts(game_date DESC);
CREATE INDEX idx_feed_posts_type ON feed_posts(post_type);
CREATE INDEX idx_feed_posts_author ON feed_posts(created_by);
CREATE INDEX idx_feed_posts_pinned ON feed_posts(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_feed_posts_featured ON feed_posts(is_featured, featured_order) 
  WHERE is_featured = TRUE;
CREATE INDEX idx_feed_posts_teams ON feed_posts USING GIN (team_tricodes);
CREATE INDEX idx_feed_posts_players ON feed_posts USING GIN (player_ids);

-- Feed content
CREATE INDEX idx_feed_content_source ON feed_content(source_type, source_id);
CREATE INDEX idx_feed_content_game ON feed_content(game_id);
CREATE INDEX idx_feed_content_date ON feed_content(game_date DESC);
CREATE INDEX idx_feed_content_type ON feed_content(content_type);
CREATE INDEX idx_feed_content_score ON feed_content(feed_score DESC NULLS LAST);
CREATE INDEX idx_feed_content_fun_score ON feed_content(fun_score DESC NULLS LAST);

-- Social engagement
CREATE INDEX idx_feed_likes_content ON feed_likes(content_id);
CREATE INDEX idx_feed_likes_user ON feed_likes(user_id);
CREATE INDEX idx_feed_comments_content ON feed_comments(content_id);
CREATE INDEX idx_feed_comments_user ON feed_comments(user_id);
CREATE INDEX idx_feed_comments_parent ON feed_comments(parent_comment_id) 
  WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_feed_shares_content ON feed_shares(content_id);
CREATE INDEX idx_feed_shares_user ON feed_shares(user_id);
CREATE INDEX idx_feed_shares_platform ON feed_shares(platform);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feed_posts_updated_at 
  BEFORE UPDATE ON feed_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_content_updated_at 
  BEFORE UPDATE ON feed_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_comments_updated_at 
  BEFORE UPDATE ON feed_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-populate thumbnail_url from first slide if not set
CREATE OR REPLACE FUNCTION auto_populate_thumbnail()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thumbnail_url IS NULL AND jsonb_array_length(NEW.slides) > 0 THEN
    -- Try to extract thumbnail from first slide
    NEW.thumbnail_url := COALESCE(
      NEW.slides->0->>'thumbnail_url',
      NEW.slides->0->>'video_url',
      NEW.slides->0->>'image_url'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER populate_feed_post_thumbnail 
  BEFORE INSERT OR UPDATE ON feed_posts
  FOR EACH ROW EXECUTE FUNCTION auto_populate_thumbnail();

-- Auto-sync published posts to feed_content
CREATE OR REPLACE FUNCTION sync_post_to_feed_content()
RETURNS TRIGGER AS $$
DECLARE
  enriched_metadata JSONB;
BEGIN
  -- Only sync if status is 'published'
  IF NEW.status = 'published' THEN
    -- Enrich metadata with player_ids and team_tricodes
    enriched_metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'player_ids', NEW.player_ids,
      'team_tricodes', NEW.team_tricodes
    );
    
    -- Create or update feed_content entry
    INSERT INTO feed_content (
      source_type,
      source_id,
      content_type,
      game_id,
      game_date,
      story_data,
      fun_data,
      fun_score,
      video_script,
      total_plays,
      metadata,
      likes_count,
      comments_count,
      shares_count,
      views_count,
      feed_score
    ) VALUES (
      'post',
      NEW.id,
      NEW.post_type::TEXT,
      NEW.game_id,
      NEW.game_date,
      NEW.metadata->'story_data',
      NEW.metadata->'fun_data',
      (NEW.metadata->>'fun_score')::NUMERIC,
      NEW.slides, -- slides become video_script
      jsonb_array_length(NEW.slides),
      enriched_metadata, -- Include player_ids and team_tricodes
      NEW.likes_count,
      NEW.comments_count,
      NEW.shares_count,
      NEW.views_count,
      COALESCE(NEW.boost_score, 5.0) -- Default feed score
    )
    ON CONFLICT (source_id) DO UPDATE
    SET
      content_type = EXCLUDED.content_type,
      game_id = EXCLUDED.game_id,
      game_date = EXCLUDED.game_date,
      story_data = EXCLUDED.story_data,
      fun_data = EXCLUDED.fun_data,
      fun_score = EXCLUDED.fun_score,
      video_script = EXCLUDED.video_script,
      total_plays = EXCLUDED.total_plays,
      metadata = EXCLUDED.metadata, -- Now includes player_ids and team_tricodes
      likes_count = EXCLUDED.likes_count,
      comments_count = EXCLUDED.comments_count,
      shares_count = EXCLUDED.shares_count,
      views_count = EXCLUDED.views_count,
      feed_score = EXCLUDED.feed_score,
      updated_at = now();
  ELSIF OLD.status = 'published' AND NEW.status != 'published' THEN
    -- Remove from feed_content if unpublished
    DELETE FROM feed_content WHERE source_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_post_to_feed_on_publish 
  AFTER INSERT OR UPDATE ON feed_posts
  FOR EACH ROW EXECUTE FUNCTION sync_post_to_feed_content();

-- Sync engagement counts to feed_posts when likes/comments/shares change
CREATE OR REPLACE FUNCTION sync_post_engagement_counts()
RETURNS TRIGGER AS $$
DECLARE
  post_id UUID;
BEGIN
  -- Determine the content_id (either from NEW or OLD)
  post_id := COALESCE(NEW.content_id, OLD.content_id);
  
  -- Update feed_posts engagement counts
  UPDATE feed_posts
  SET
    likes_count = (
      SELECT COUNT(*) FROM feed_likes WHERE content_id = post_id
    ),
    comments_count = (
      SELECT COUNT(*) FROM feed_comments WHERE content_id = post_id
    ),
    shares_count = (
      SELECT COUNT(*) FROM feed_shares WHERE content_id = post_id
    )
  WHERE id = post_id;
  
  -- Also update feed_content if exists
  UPDATE feed_content
  SET
    likes_count = (
      SELECT COUNT(*) FROM feed_likes WHERE content_id = post_id
    ),
    comments_count = (
      SELECT COUNT(*) FROM feed_comments WHERE content_id = post_id
    ),
    shares_count = (
      SELECT COUNT(*) FROM feed_shares WHERE content_id = post_id
    )
  WHERE id = post_id OR source_id = post_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_engagement_on_like 
  AFTER INSERT OR DELETE ON feed_likes
  FOR EACH ROW EXECUTE FUNCTION sync_post_engagement_counts();

CREATE TRIGGER sync_engagement_on_comment 
  AFTER INSERT OR DELETE ON feed_comments
  FOR EACH ROW EXECUTE FUNCTION sync_post_engagement_counts();

CREATE TRIGGER sync_engagement_on_share 
  AFTER INSERT OR DELETE ON feed_shares
  FOR EACH ROW EXECUTE FUNCTION sync_post_engagement_counts();

-- Auto-publish scheduled posts
CREATE OR REPLACE FUNCTION auto_publish_scheduled_posts()
RETURNS void AS $$
BEGIN
  UPDATE feed_posts
  SET 
    status = 'published'::feed_post_status,
    published_at = now()
  WHERE 
    status = 'scheduled'::feed_post_status
    AND scheduled_for <= now();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_shares ENABLE ROW LEVEL SECURITY;

-- Feed Posts Policies
-- Public can view published posts
CREATE POLICY "Public can view published posts" ON feed_posts
  FOR SELECT USING (status = 'published' AND published_at <= now());

-- Super admins can do everything
CREATE POLICY "Super admins can manage all posts" ON feed_posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
        AND au.is_active = TRUE
    )
  );

-- Content admins can view and edit posts
CREATE POLICY "Content admins can manage posts" ON feed_posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.role IN ('super_admin', 'content_admin')
        AND au.is_active = TRUE
    )
  );

-- Feed Content Policies
-- Public can view all published content
CREATE POLICY "Public can view feed content" ON feed_content
  FOR SELECT USING (true);

-- Admins can manage feed content
CREATE POLICY "Admins can manage feed content" ON feed_content
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.role IN ('super_admin', 'content_admin')
        AND au.is_active = TRUE
    )
  );

-- Social Engagement Policies
-- Anyone can view likes/comments/shares
CREATE POLICY "Public can view likes" ON feed_likes
  FOR SELECT USING (true);

CREATE POLICY "Public can view comments" ON feed_comments
  FOR SELECT USING (true);

CREATE POLICY "Public can view shares" ON feed_shares
  FOR SELECT USING (true);

-- Authenticated users can create engagement
CREATE POLICY "Users can like content" ON feed_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike content" ON feed_likes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can comment" ON feed_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit own comments" ON feed_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON feed_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can share content" ON feed_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get feed with proper sorting (combines manual posts + algorithmic content)
CREATE OR REPLACE FUNCTION get_feed_content(
  limit_count INTEGER DEFAULT 12,
  offset_count INTEGER DEFAULT 0
)
RETURNS SETOF feed_content AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM feed_content
  ORDER BY feed_score DESC NULLS LAST, game_date DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Publish a post (change from draft to published)
CREATE OR REPLACE FUNCTION publish_post(post_id UUID)
RETURNS feed_posts AS $$
DECLARE
  updated_post feed_posts;
BEGIN
  UPDATE feed_posts
  SET 
    status = 'published'::feed_post_status,
    published_at = now()
  WHERE id = post_id
  RETURNING * INTO updated_post;
  
  -- Create corresponding feed_content entry
  INSERT INTO feed_content (
    source_type,
    source_id,
    content_type,
    game_id,
    game_date,
    story_data,
    fun_data,
    fun_score,
    video_script,
    metadata,
    likes_count,
    comments_count,
    shares_count,
    views_count,
    feed_score
  )
  SELECT
    'post',
    updated_post.id,
    updated_post.post_type::TEXT,
    updated_post.game_id,
    updated_post.game_date,
    updated_post.metadata->'story_data',
    updated_post.metadata->'fun_data',
    (updated_post.metadata->>'fun_score')::NUMERIC,
    updated_post.slides,
    updated_post.metadata,
    updated_post.likes_count,
    updated_post.comments_count,
    updated_post.shares_count,
    updated_post.views_count,
    COALESCE(updated_post.boost_score, 5.0) -- Default feed score
  ON CONFLICT (source_id) DO UPDATE
  SET
    content_type = EXCLUDED.content_type,
    game_id = EXCLUDED.game_id,
    game_date = EXCLUDED.game_date,
    story_data = EXCLUDED.story_data,
    fun_data = EXCLUDED.fun_data,
    fun_score = EXCLUDED.fun_score,
    video_script = EXCLUDED.video_script,
    metadata = EXCLUDED.metadata,
    feed_score = EXCLUDED.feed_score,
    updated_at = now();
  
  RETURN updated_post;
END;
$$ LANGUAGE plpgsql;

-- Unpublish a post (archive it)
CREATE OR REPLACE FUNCTION unpublish_post(post_id UUID)
RETURNS feed_posts AS $$
DECLARE
  updated_post feed_posts;
BEGIN
  UPDATE feed_posts
  SET status = 'archived'::feed_post_status
  WHERE id = post_id
  RETURNING * INTO updated_post;
  
  -- Remove from feed_content
  DELETE FROM feed_content
  WHERE source_id = post_id AND source_type = 'post';
  
  RETURN updated_post;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for published posts with engagement
CREATE OR REPLACE VIEW published_feed_posts AS
SELECT 
  fp.*,
  COALESCE(l.like_count, 0) AS current_likes,
  COALESCE(c.comment_count, 0) AS current_comments,
  COALESCE(s.share_count, 0) AS current_shares
FROM feed_posts fp
LEFT JOIN (
  SELECT content_id, COUNT(*) AS like_count
  FROM feed_likes
  GROUP BY content_id
) l ON fp.id = l.content_id
LEFT JOIN (
  SELECT content_id, COUNT(*) AS comment_count
  FROM feed_comments
  GROUP BY content_id
) c ON fp.id = c.content_id
LEFT JOIN (
  SELECT content_id, COUNT(*) AS share_count
  FROM feed_shares
  GROUP BY content_id
) s ON fp.id = s.content_id
WHERE fp.status = 'published' AND fp.published_at <= now()
ORDER BY fp.published_at DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE feed_posts IS 'Manually curated feed posts created by admins';
COMMENT ON TABLE feed_content IS 'Consolidated feed content (manual + algorithmic)';
COMMENT ON TABLE feed_likes IS 'User likes on feed content';
COMMENT ON TABLE feed_comments IS 'User comments on feed content';
COMMENT ON TABLE feed_shares IS 'User shares of feed content';

COMMENT ON COLUMN feed_posts.slides IS 'JSONB array of slide data with type, content, and metadata';
COMMENT ON COLUMN feed_posts.metadata IS 'Additional post metadata (game stats, season, arena, etc)';
COMMENT ON COLUMN feed_posts.boost_score IS 'Manual feed ranking boost (0-10)';

-- ============================================================================
-- END OF FEED POSTS SYSTEM
-- ============================================================================

