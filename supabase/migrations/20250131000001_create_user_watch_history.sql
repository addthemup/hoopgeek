-- ============================================================================
-- USER WATCH HISTORY TRACKING
-- Track time spent watching content per team and player
-- Used for personalized home pages and user profile insights
-- ============================================================================

-- Create user_watch_history table
CREATE TABLE IF NOT EXISTS public.user_watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Content identification
  post_id UUID REFERENCES feed_posts(id) ON DELETE CASCADE,
  slide_index INTEGER, -- Which slide in the post (0-indexed)
  
  -- Team/Player tracking
  team_tricode TEXT, -- Team abbreviation (e.g., 'LAL', 'BOS')
  player_id BIGINT, -- NBA player personId
  
  -- Time tracking
  watch_seconds INTEGER NOT NULL DEFAULT 0, -- Time spent watching this content
  video_watch_seconds INTEGER DEFAULT 0, -- Time spent watching videos specifically
  
  -- Context
  post_type TEXT, -- Type of post (fun_score, player_spotlight, etc.)
  game_id VARCHAR(50), -- Associated game ID if available
  
  -- Timestamps
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_watch_seconds CHECK (watch_seconds >= 0),
  CONSTRAINT valid_video_watch_seconds CHECK (video_watch_seconds >= 0),
  CONSTRAINT has_team_or_player CHECK (team_tricode IS NOT NULL OR player_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX idx_user_watch_history_user ON user_watch_history(user_id);
CREATE INDEX idx_user_watch_history_team ON user_watch_history(user_id, team_tricode);
CREATE INDEX idx_user_watch_history_player ON user_watch_history(user_id, player_id);
CREATE INDEX idx_user_watch_history_post ON user_watch_history(post_id);
CREATE INDEX idx_user_watch_history_watched_at ON user_watch_history(watched_at DESC);
CREATE INDEX idx_user_watch_history_user_team ON user_watch_history(user_id, team_tricode, watched_at DESC);
CREATE INDEX idx_user_watch_history_user_player ON user_watch_history(user_id, player_id, watched_at DESC);

-- Composite index for aggregation queries
CREATE INDEX idx_user_watch_history_aggregation ON user_watch_history(user_id, team_tricode, player_id, watched_at DESC);

-- RLS Policies
ALTER TABLE user_watch_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own watch history
CREATE POLICY "Users can read own watch history"
  ON user_watch_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own watch history
CREATE POLICY "Users can insert own watch history"
  ON user_watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own watch history
CREATE POLICY "Users can update own watch history"
  ON user_watch_history FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own watch history
CREATE POLICY "Users can delete own watch history"
  ON user_watch_history FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Upsert watch history (insert or update existing)
CREATE OR REPLACE FUNCTION upsert_watch_history(
  p_user_id UUID,
  p_post_id UUID,
  p_slide_index INTEGER,
  p_team_tricode TEXT,
  p_player_id BIGINT,
  p_watch_seconds INTEGER,
  p_video_watch_seconds INTEGER DEFAULT 0,
  p_post_type TEXT DEFAULT NULL,
  p_game_id VARCHAR(50) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_history_id UUID;
BEGIN
  -- Try to find existing record for this user/post/slide/team/player combination
  -- within the last minute (to batch updates)
  SELECT id INTO v_history_id
  FROM user_watch_history
  WHERE user_id = p_user_id
    AND post_id = p_post_id
    AND slide_index = p_slide_index
    AND (team_tricode = p_team_tricode OR (team_tricode IS NULL AND p_team_tricode IS NULL))
    AND (player_id = p_player_id OR (player_id IS NULL AND p_player_id IS NULL))
    AND watched_at > now() - INTERVAL '1 minute'
  ORDER BY watched_at DESC
  LIMIT 1;
  
  IF v_history_id IS NOT NULL THEN
    -- Update existing record
    UPDATE user_watch_history
    SET
      watch_seconds = watch_seconds + p_watch_seconds,
      video_watch_seconds = video_watch_seconds + p_video_watch_seconds,
      updated_at = now()
    WHERE id = v_history_id;
    
    RETURN v_history_id;
  ELSE
    -- Insert new record
    INSERT INTO user_watch_history (
      user_id,
      post_id,
      slide_index,
      team_tricode,
      player_id,
      watch_seconds,
      video_watch_seconds,
      post_type,
      game_id
    ) VALUES (
      p_user_id,
      p_post_id,
      p_slide_index,
      p_team_tricode,
      p_player_id,
      p_watch_seconds,
      p_video_watch_seconds,
      p_post_type,
      p_game_id
    )
    RETURNING id INTO v_history_id;
    
    RETURN v_history_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user watch history summary (aggregated by team/player)
CREATE OR REPLACE FUNCTION get_user_watch_summary(
  p_user_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  team_tricode TEXT,
  player_id BIGINT,
  total_watch_seconds INTEGER,
  total_video_watch_seconds INTEGER,
  post_count BIGINT,
  last_watched_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uwh.team_tricode,
    uwh.player_id,
    SUM(uwh.watch_seconds)::INTEGER as total_watch_seconds,
    SUM(uwh.video_watch_seconds)::INTEGER as total_video_watch_seconds,
    COUNT(DISTINCT uwh.post_id) as post_count,
    MAX(uwh.watched_at) as last_watched_at
  FROM user_watch_history uwh
  WHERE uwh.user_id = p_user_id
    AND uwh.watched_at > now() - (p_days_back || ' days')::INTERVAL
  GROUP BY uwh.team_tricode, uwh.player_id
  ORDER BY total_watch_seconds DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get top teams by watch time
CREATE OR REPLACE FUNCTION get_user_top_teams(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  team_tricode TEXT,
  total_watch_seconds INTEGER,
  total_video_watch_seconds INTEGER,
  post_count BIGINT,
  last_watched_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uwh.team_tricode,
    SUM(uwh.watch_seconds)::INTEGER as total_watch_seconds,
    SUM(uwh.video_watch_seconds)::INTEGER as total_video_watch_seconds,
    COUNT(DISTINCT uwh.post_id) as post_count,
    MAX(uwh.watched_at) as last_watched_at
  FROM user_watch_history uwh
  WHERE uwh.user_id = p_user_id
    AND uwh.team_tricode IS NOT NULL
    AND uwh.watched_at > now() - (p_days_back || ' days')::INTERVAL
  GROUP BY uwh.team_tricode
  ORDER BY total_watch_seconds DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get top players by watch time
CREATE OR REPLACE FUNCTION get_user_top_players(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  player_id BIGINT,
  total_watch_seconds INTEGER,
  total_video_watch_seconds INTEGER,
  post_count BIGINT,
  last_watched_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uwh.player_id,
    SUM(uwh.watch_seconds)::INTEGER as total_watch_seconds,
    SUM(uwh.video_watch_seconds)::INTEGER as total_video_watch_seconds,
    COUNT(DISTINCT uwh.post_id) as post_count,
    MAX(uwh.watched_at) as last_watched_at
  FROM user_watch_history uwh
  WHERE uwh.user_id = p_user_id
    AND uwh.player_id IS NOT NULL
    AND uwh.watched_at > now() - (p_days_back || ' days')::INTERVAL
  GROUP BY uwh.player_id
  ORDER BY total_watch_seconds DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_watch_history(UUID, UUID, INTEGER, TEXT, BIGINT, INTEGER, INTEGER, TEXT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_watch_summary(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_top_teams(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_top_players(UUID, INTEGER, INTEGER) TO authenticated;

-- Comments
COMMENT ON TABLE user_watch_history IS 'Tracks time spent watching content per team and player for personalized recommendations';
COMMENT ON FUNCTION upsert_watch_history IS 'Upserts watch history with batching (updates if record exists within 1 minute)';
COMMENT ON FUNCTION get_user_watch_summary IS 'Gets aggregated watch history summary for a user';
COMMENT ON FUNCTION get_user_top_teams IS 'Gets top teams by watch time for a user';
COMMENT ON FUNCTION get_user_top_players IS 'Gets top players by watch time for a user';

