-- ============================================================================
-- USER VIEWED POSTS TRACKING
-- Track which feed_content posts users have watched/viewed
-- ============================================================================

-- Create user_viewed_posts table
CREATE TABLE IF NOT EXISTS public.user_viewed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES feed_content(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  
  -- Track engagement
  watch_duration INTEGER, -- Seconds watched
  completed BOOLEAN DEFAULT FALSE, -- Did they watch the whole thing?
  
  CONSTRAINT unique_user_view UNIQUE(user_id, content_id)
);

-- Indexes for performance
CREATE INDEX idx_user_viewed_posts_user ON user_viewed_posts(user_id);
CREATE INDEX idx_user_viewed_posts_content ON user_viewed_posts(content_id);
CREATE INDEX idx_user_viewed_posts_viewed_at ON user_viewed_posts(viewed_at DESC);

-- RLS Policies
ALTER TABLE user_viewed_posts ENABLE ROW LEVEL SECURITY;

-- Users can read their own viewed posts
CREATE POLICY "Users can read own viewed posts"
  ON user_viewed_posts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own viewed posts
CREATE POLICY "Users can insert own viewed posts"
  ON user_viewed_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own viewed posts
CREATE POLICY "Users can update own viewed posts"
  ON user_viewed_posts FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Mark a post as viewed by the current user
CREATE OR REPLACE FUNCTION mark_post_as_viewed(
  p_content_id UUID,
  p_watch_duration INTEGER DEFAULT NULL,
  p_completed BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
BEGIN
  -- Insert or update view record
  INSERT INTO user_viewed_posts (user_id, content_id, watch_duration, completed, viewed_at)
  VALUES (auth.uid(), p_content_id, p_watch_duration, p_completed, now())
  ON CONFLICT (user_id, content_id) 
  DO UPDATE SET
    viewed_at = now(),
    watch_duration = GREATEST(user_viewed_posts.watch_duration, EXCLUDED.watch_duration),
    completed = EXCLUDED.completed OR user_viewed_posts.completed
  RETURNING id INTO v_view_id;
  
  -- Increment views count on feed_content
  UPDATE feed_content
  SET views_count = views_count + 1
  WHERE id = p_content_id;
  
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get personalized feed for user with weighted algorithm
CREATE OR REPLACE FUNCTION get_personalized_feed(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_include_viewed BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  content_type TEXT,
  game_id VARCHAR(50),
  game_date TIMESTAMPTZ,
  story_data JSONB,
  fun_data JSONB,
  fun_score NUMERIC(5,2),
  video_script JSONB,
  total_plays INTEGER,
  metadata JSONB,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  views_count INTEGER,
  feed_score NUMERIC(10,4),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_viewed BOOLEAN,
  viewed_at TIMESTAMPTZ,
  personalized_score NUMERIC(10,4)
) AS $$
DECLARE
  v_favorite_players BIGINT[];
  v_favorite_teams TEXT[];
BEGIN
  -- Get user's favorite players
  SELECT ARRAY_AGG(DISTINCT player_id)
  INTO v_favorite_players
  FROM player_favorites
  WHERE user_id = auth.uid();
  
  -- Get user's favorite teams
  SELECT ARRAY_AGG(DISTINCT team_id)
  INTO v_favorite_teams
  FROM favorite_teams
  WHERE user_id = auth.uid();
  
  -- Return feed with personalized scoring
  RETURN QUERY
  SELECT 
    fc.id,
    fc.source_type,
    fc.source_id,
    fc.content_type,
    fc.game_id,
    fc.game_date,
    fc.story_data,
    fc.fun_data,
    fc.fun_score,
    fc.video_script,
    fc.total_plays,
    fc.metadata,
    fc.likes_count,
    fc.comments_count,
    fc.shares_count,
    fc.views_count,
    fc.feed_score,
    fc.created_at,
    fc.updated_at,
    (uvp.id IS NOT NULL) as is_viewed,
    uvp.viewed_at,
    -- Personalized score calculation
    (
      COALESCE(fc.feed_score, 5.0) * 1.0 + -- Base feed score
      CASE 
        -- Boost if post features user's favorite players
        WHEN v_favorite_players IS NOT NULL AND 
             (fc.metadata->'player_ids')::jsonb ?| ARRAY(SELECT jsonb_array_elements_text(to_jsonb(v_favorite_players)))
        THEN 3.0
        ELSE 0.0
      END +
      CASE
        -- Boost if post features user's favorite teams
        WHEN v_favorite_teams IS NOT NULL AND
             (fc.metadata->'team_tricodes')::jsonb ?| ARRAY(SELECT jsonb_array_elements_text(to_jsonb(v_favorite_teams)))
        THEN 2.0
        ELSE 0.0
      END +
      -- Slight penalty for already viewed (but still include them)
      CASE 
        WHEN uvp.id IS NOT NULL THEN -1.0
        ELSE 0.0
      END +
      -- Boost newer content
      CASE
        WHEN fc.game_date > now() - INTERVAL '3 days' THEN 1.0
        WHEN fc.game_date > now() - INTERVAL '7 days' THEN 0.5
        ELSE 0.0
      END
    ) as personalized_score
  FROM feed_content fc
  LEFT JOIN user_viewed_posts uvp ON uvp.content_id = fc.id AND uvp.user_id = auth.uid()
  WHERE 
    -- Only include viewed posts if requested
    (p_include_viewed = TRUE OR uvp.id IS NULL)
  ORDER BY 
    -- Sort by personalized score, then by date
    personalized_score DESC,
    fc.game_date DESC,
    fc.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_post_as_viewed(UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_personalized_feed(INTEGER, INTEGER, BOOLEAN) TO authenticated;

