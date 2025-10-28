-- ============================================================================
-- ENGAGEMENT & ANALYTICS TRACKING SYSTEM
-- ============================================================================
-- Purpose: Track user engagement metrics for investor reporting
-- - Session duration (time spent in app)
-- - Post view analytics (views, duration, completion rate)
-- - Video engagement (watch time, completion %)
-- - DFS performance analytics
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE engagement_event_type AS ENUM (
  'page_view',
  'post_view',
  'video_start',
  'video_progress',
  'video_complete',
  'slide_change',
  'post_interaction', -- like, comment, share
  'post_complete' -- user finished viewing all slides
);

CREATE TYPE session_end_reason AS ENUM (
  'user_logout',
  'timeout',
  'navigation_away',
  'browser_close',
  'unknown'
);

-- ============================================================================
-- USER ENGAGEMENT SESSIONS TABLE
-- ============================================================================
-- Tracks each user session for session duration analytics

-- Drop existing table/view if recreating
-- DROP TABLE IF EXISTS public.user_engagement_sessions CASCADE;

CREATE TABLE IF NOT EXISTS public.user_engagement_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session Info
  session_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_end TIMESTAMPTZ,
  session_duration_seconds INTEGER, -- Calculated on session end
  
  -- Page/Route
  entry_page TEXT, -- Where they entered (e.g., '/highlights', '/dfs')
  exit_page TEXT, -- Where they exited
  
  -- Device & Browser
  user_agent TEXT,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  
  -- Engagement Summary
  posts_viewed INTEGER DEFAULT 0,
  posts_completed INTEGER DEFAULT 0, -- Watched all slides
  videos_watched INTEGER DEFAULT 0,
  total_video_watch_seconds INTEGER DEFAULT 0,
  interactions_count INTEGER DEFAULT 0, -- likes + comments + shares
  
  -- Session Quality Metrics
  avg_post_completion_rate DECIMAL(5, 2), -- % of slides watched per post
  engagement_score DECIMAL(10, 2), -- Calculated engagement score
  
  -- End Reason
  end_reason session_end_reason DEFAULT 'unknown',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional session data
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_duration CHECK (session_duration_seconds IS NULL OR session_duration_seconds >= 0),
  CONSTRAINT valid_end_time CHECK (session_end IS NULL OR session_end >= session_start)
);

-- Indexes
CREATE INDEX idx_user_sessions_user ON user_engagement_sessions(user_id);
CREATE INDEX idx_user_sessions_start ON user_engagement_sessions(session_start DESC);
CREATE INDEX idx_user_sessions_duration ON user_engagement_sessions(session_duration_seconds DESC) 
  WHERE session_duration_seconds IS NOT NULL;
CREATE INDEX idx_user_sessions_active ON user_engagement_sessions(user_id, session_start DESC) 
  WHERE session_end IS NULL;

-- ============================================================================
-- USER POST VIEWS TABLE
-- ============================================================================
-- Detailed tracking of individual post views

CREATE TABLE IF NOT EXISTS public.user_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Post
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL, -- References feed_posts.id
  session_id UUID REFERENCES user_engagement_sessions(id) ON DELETE CASCADE,
  
  -- View Timing
  view_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_ended_at TIMESTAMPTZ,
  view_duration_seconds INTEGER, -- Total time viewing this post
  
  -- Engagement Metrics
  slides_viewed INTEGER DEFAULT 0, -- How many slides viewed
  total_slides INTEGER, -- Total slides in post
  completion_percentage DECIMAL(5, 2) DEFAULT 0, -- % of slides viewed
  
  -- Video Metrics (if post has videos)
  videos_in_post INTEGER DEFAULT 0,
  videos_started INTEGER DEFAULT 0,
  videos_completed INTEGER DEFAULT 0,
  total_video_watch_seconds INTEGER DEFAULT 0,
  avg_video_completion_rate DECIMAL(5, 2), -- % of video watched on average
  
  -- Interaction
  did_like BOOLEAN DEFAULT FALSE,
  did_comment BOOLEAN DEFAULT FALSE,
  did_share BOOLEAN DEFAULT FALSE,
  
  -- How they left the post
  exit_method TEXT, -- 'scroll_away', 'click_away', 'auto_advance', 'session_end'
  
  -- Was this a reshuffled/clicked post?
  was_clicked_from_avatar BOOLEAN DEFAULT FALSE,
  
  -- Quality Score
  engagement_score DECIMAL(10, 2), -- Calculated engagement score for this view
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_view_duration CHECK (view_duration_seconds IS NULL OR view_duration_seconds >= 0),
  CONSTRAINT valid_completion CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  CONSTRAINT valid_slides CHECK (slides_viewed >= 0 AND slides_viewed <= COALESCE(total_slides, slides_viewed))
);

-- Indexes
CREATE INDEX idx_user_post_views_user ON user_post_views(user_id);
CREATE INDEX idx_user_post_views_post ON user_post_views(post_id);
CREATE INDEX idx_user_post_views_session ON user_post_views(session_id);
CREATE INDEX idx_user_post_views_started ON user_post_views(view_started_at DESC);
CREATE INDEX idx_user_post_views_completion ON user_post_views(completion_percentage DESC);
CREATE UNIQUE INDEX idx_user_post_views_unique ON user_post_views(user_id, post_id, session_id, view_started_at);

-- ============================================================================
-- ENGAGEMENT EVENTS TABLE
-- ============================================================================
-- Granular event tracking for deep analytics

CREATE TABLE IF NOT EXISTS public.engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Session
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES user_engagement_sessions(id) ON DELETE CASCADE,
  post_view_id UUID REFERENCES user_post_views(id) ON DELETE CASCADE,
  
  -- Event Details
  event_type engagement_event_type NOT NULL,
  post_id UUID, -- References feed_posts.id
  
  -- Event Specifics
  event_data JSONB, -- Flexible event data
  -- Examples:
  -- video_progress: { "video_url": "...", "progress_seconds": 10, "duration_seconds": 30 }
  -- slide_change: { "from_slide": 0, "to_slide": 1, "total_slides": 5 }
  -- post_interaction: { "action": "like", "content_id": "..." }
  
  -- Timestamp
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_engagement_events_user ON engagement_events(user_id);
CREATE INDEX idx_engagement_events_session ON engagement_events(session_id);
CREATE INDEX idx_engagement_events_post_view ON engagement_events(post_view_id);
CREATE INDEX idx_engagement_events_type ON engagement_events(event_type);
CREATE INDEX idx_engagement_events_timestamp ON engagement_events(event_timestamp DESC);
CREATE INDEX idx_engagement_events_post ON engagement_events(post_id) WHERE post_id IS NOT NULL;

-- ============================================================================
-- DFS USER STATISTICS TABLE
-- ============================================================================
-- Aggregated DFS performance stats for investor metrics

-- Drop existing view if it exists (from previous migrations)
DROP VIEW IF EXISTS public.dfs_user_statistics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.dfs_user_statistics CASCADE;

CREATE TABLE IF NOT EXISTS public.dfs_user_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contest Participation
  total_contests_entered INTEGER DEFAULT 0,
  active_contests INTEGER DEFAULT 0,
  completed_contests INTEGER DEFAULT 0,
  
  -- Financial Stats
  total_entry_fees_paid DECIMAL(12, 2) DEFAULT 0.00,
  total_winnings DECIMAL(12, 2) DEFAULT 0.00,
  net_profit_loss DECIMAL(12, 2) DEFAULT 0.00, -- winnings - fees
  roi_percentage DECIMAL(10, 2), -- (net_profit / total_fees) * 100
  
  -- Performance Stats
  contests_won INTEGER DEFAULT 0, -- 1st place finishes
  contests_cashed INTEGER DEFAULT 0, -- Any prize won
  cash_rate DECIMAL(5, 2), -- (contests_cashed / completed) * 100
  win_rate DECIMAL(5, 2), -- (contests_won / completed) * 100
  
  -- Scoring Stats
  avg_final_score DECIMAL(10, 2),
  best_final_score DECIMAL(10, 2),
  total_points_scored DECIMAL(15, 2) DEFAULT 0.00,
  
  -- Ranking Stats
  avg_rank DECIMAL(10, 2),
  best_rank INTEGER,
  top_10_finishes INTEGER DEFAULT 0,
  top_25_percent_finishes INTEGER DEFAULT 0,
  
  -- Entry Behavior
  total_lineups_created INTEGER DEFAULT 0,
  avg_salary_cap_used DECIMAL(5, 2), -- % of cap used
  favorite_difficulty_tier TEXT, -- 'elite', 'pro', 'standard'
  
  -- Player Selection Patterns
  most_used_player_id BIGINT, -- Their most selected player
  most_successful_player_id BIGINT, -- Player in most winning lineups
  avg_starters_overlap DECIMAL(5, 2), -- How similar their lineups are to others
  
  -- Engagement
  last_contest_entered_at TIMESTAMPTZ,
  last_prize_won_at TIMESTAMPTZ,
  longest_winning_streak INTEGER DEFAULT 0,
  current_winning_streak INTEGER DEFAULT 0,
  longest_losing_streak INTEGER DEFAULT 0,
  current_losing_streak INTEGER DEFAULT 0,
  
  -- Tier Classification (for matchmaking/recommendations)
  skill_tier TEXT, -- 'beginner', 'intermediate', 'advanced', 'expert'
  confidence_score DECIMAL(5, 2), -- 0-100, based on data quality
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  first_contest_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_counts CHECK (
    total_contests_entered >= 0 AND
    completed_contests >= 0 AND
    completed_contests <= total_contests_entered
  ),
  CONSTRAINT valid_money CHECK (
    total_entry_fees_paid >= 0 AND
    total_winnings >= 0
  ),
  CONSTRAINT valid_rates CHECK (
    (cash_rate IS NULL OR (cash_rate >= 0 AND cash_rate <= 100)) AND
    (win_rate IS NULL OR (win_rate >= 0 AND win_rate <= 100))
  )
);

-- Index
CREATE INDEX idx_dfs_user_stats_user ON dfs_user_statistics(user_id);
CREATE INDEX idx_dfs_user_stats_roi ON dfs_user_statistics(roi_percentage DESC NULLS LAST);
CREATE INDEX idx_dfs_user_stats_cash_rate ON dfs_user_statistics(cash_rate DESC NULLS LAST);
CREATE INDEX idx_dfs_user_stats_net_profit ON dfs_user_statistics(net_profit_loss DESC);
CREATE INDEX idx_dfs_user_stats_skill_tier ON dfs_user_statistics(skill_tier);

-- ============================================================================
-- MATERIALIZED VIEW: DAILY ENGAGEMENT METRICS
-- ============================================================================
-- For fast investor dashboard queries

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_engagement_metrics AS
SELECT
  date_trunc('day', session_start) AS metric_date,
  
  -- User Metrics
  COUNT(DISTINCT user_id) AS daily_active_users,
  COUNT(DISTINCT CASE WHEN posts_viewed >= 3 THEN user_id END) AS engaged_users,
  
  -- Session Metrics
  COUNT(*) AS total_sessions,
  AVG(session_duration_seconds) AS avg_session_duration_seconds,
  SUM(session_duration_seconds) AS total_session_time_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY session_duration_seconds) AS median_session_duration,
  
  -- Content Metrics
  SUM(posts_viewed) AS total_posts_viewed,
  SUM(posts_completed) AS total_posts_completed,
  AVG(posts_viewed::DECIMAL / NULLIF(session_duration_seconds::DECIMAL / 60, 0)) AS avg_posts_per_minute,
  AVG(CASE WHEN posts_viewed > 0 THEN (posts_completed::DECIMAL / posts_viewed) * 100 ELSE 0 END) AS avg_post_completion_rate,
  
  -- Video Metrics
  SUM(videos_watched) AS total_videos_watched,
  SUM(total_video_watch_seconds) AS total_video_watch_time_seconds,
  
  -- Engagement Metrics
  SUM(interactions_count) AS total_interactions,
  AVG(engagement_score) AS avg_engagement_score
  
FROM user_engagement_sessions
WHERE session_start >= CURRENT_DATE - INTERVAL '365 days'
  AND session_duration_seconds IS NOT NULL
GROUP BY date_trunc('day', session_start)
ORDER BY metric_date DESC;

-- Create index on materialized view
CREATE INDEX idx_daily_engagement_date ON daily_engagement_metrics(metric_date DESC);

-- ============================================================================
-- MATERIALIZED VIEW: DFS CONVERSION FUNNEL
-- ============================================================================
-- Track conversion from highlight viewers to DFS players

CREATE MATERIALIZED VIEW IF NOT EXISTS dfs_conversion_funnel AS
WITH user_cohorts AS (
  SELECT
    user_id,
    MIN(session_start)::date AS first_session_date,
    date_trunc('week', MIN(session_start)) AS cohort_week,
    date_trunc('month', MIN(session_start)) AS cohort_month
  FROM user_engagement_sessions
  GROUP BY user_id
),
dfs_activity AS (
  SELECT
    user_id,
    MIN(created_at)::date AS first_dfs_entry_date,
    COUNT(DISTINCT pool_id) AS pools_entered,
    SUM(entry_fee_paid) AS total_spent
  FROM dfs_entries
  GROUP BY user_id
)
SELECT
  uc.cohort_week,
  uc.cohort_month,
  COUNT(DISTINCT uc.user_id) AS total_users,
  COUNT(DISTINCT da.user_id) AS converted_to_dfs,
  ROUND((COUNT(DISTINCT da.user_id)::DECIMAL / COUNT(DISTINCT uc.user_id)) * 100, 2) AS conversion_rate,
  AVG(da.pools_entered) AS avg_pools_per_converter,
  AVG(da.total_spent) AS avg_revenue_per_converter,
  AVG((da.first_dfs_entry_date - uc.first_session_date)::NUMERIC) AS avg_days_to_convert
FROM user_cohorts uc
LEFT JOIN dfs_activity da ON uc.user_id = da.user_id
GROUP BY uc.cohort_week, uc.cohort_month
ORDER BY uc.cohort_week DESC;

-- ============================================================================
-- FUNCTIONS FOR ENGAGEMENT TRACKING
-- ============================================================================

-- Function: Start new user session
CREATE OR REPLACE FUNCTION start_user_session(
  p_user_id UUID,
  p_entry_page TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO user_engagement_sessions (
    user_id,
    entry_page,
    user_agent,
    device_type
  ) VALUES (
    p_user_id,
    p_entry_page,
    p_user_agent,
    p_device_type
  )
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: End user session
CREATE OR REPLACE FUNCTION end_user_session(
  p_session_id UUID,
  p_exit_page TEXT DEFAULT NULL,
  p_end_reason session_end_reason DEFAULT 'unknown'
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_engagement_sessions
  SET
    session_end = now(),
    session_duration_seconds = EXTRACT(EPOCH FROM (now() - session_start))::INTEGER,
    exit_page = COALESCE(p_exit_page, exit_page),
    end_reason = p_end_reason,
    updated_at = now()
  WHERE id = p_session_id
    AND session_end IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Start post view
CREATE OR REPLACE FUNCTION start_post_view(
  p_user_id UUID,
  p_post_id UUID,
  p_session_id UUID,
  p_total_slides INTEGER,
  p_was_clicked BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
BEGIN
  INSERT INTO user_post_views (
    user_id,
    post_id,
    session_id,
    total_slides,
    was_clicked_from_avatar
  ) VALUES (
    p_user_id,
    p_post_id,
    p_session_id,
    p_total_slides,
    p_was_clicked
  )
  RETURNING id INTO v_view_id;
  
  -- Increment session posts viewed
  UPDATE user_engagement_sessions
  SET posts_viewed = posts_viewed + 1
  WHERE id = p_session_id;
  
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update post view progress
CREATE OR REPLACE FUNCTION update_post_view_progress(
  p_view_id UUID,
  p_slides_viewed INTEGER,
  p_video_watch_seconds INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_post_views
  SET
    slides_viewed = GREATEST(slides_viewed, p_slides_viewed),
    completion_percentage = CASE 
      WHEN total_slides > 0 THEN (GREATEST(slides_viewed, p_slides_viewed)::DECIMAL / total_slides) * 100
      ELSE 0
    END,
    total_video_watch_seconds = total_video_watch_seconds + p_video_watch_seconds,
    updated_at = now()
  WHERE id = p_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: End post view
CREATE OR REPLACE FUNCTION end_post_view(
  p_view_id UUID,
  p_exit_method TEXT DEFAULT 'unknown'
)
RETURNS VOID AS $$
DECLARE
  v_session_id UUID;
  v_completion DECIMAL;
BEGIN
  -- End the view
  UPDATE user_post_views
  SET
    view_ended_at = now(),
    view_duration_seconds = EXTRACT(EPOCH FROM (now() - view_started_at))::INTEGER,
    exit_method = p_exit_method,
    updated_at = now()
  WHERE id = p_view_id
  RETURNING session_id, completion_percentage INTO v_session_id, v_completion;
  
  -- If completed (watched >=80% of slides), increment session counter
  IF v_completion >= 80 THEN
    UPDATE user_engagement_sessions
    SET posts_completed = posts_completed + 1
    WHERE id = v_session_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Refresh daily metrics (call from cron)
CREATE OR REPLACE FUNCTION refresh_daily_engagement_metrics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_engagement_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY dfs_conversion_funnel;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_engagement_sessions_updated_at
  BEFORE UPDATE ON user_engagement_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_post_views_updated_at
  BEFORE UPDATE ON user_post_views
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE user_engagement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_user_statistics ENABLE ROW LEVEL SECURITY;

-- User engagement sessions: users can only see their own
CREATE POLICY user_engagement_sessions_select_own
  ON user_engagement_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_engagement_sessions_insert_own
  ON user_engagement_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_engagement_sessions_update_own
  ON user_engagement_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- User post views: users can only see their own
CREATE POLICY user_post_views_select_own
  ON user_post_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_post_views_insert_own
  ON user_post_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_post_views_update_own
  ON user_post_views FOR UPDATE
  USING (auth.uid() = user_id);

-- Engagement events: users can only see their own
CREATE POLICY engagement_events_select_own
  ON engagement_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY engagement_events_insert_own
  ON engagement_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DFS user statistics: users can only see their own
CREATE POLICY dfs_user_statistics_select_own
  ON dfs_user_statistics FOR SELECT
  USING (auth.uid() = user_id);

-- Admin policies (assuming admin role check function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    CREATE POLICY user_engagement_sessions_admin_all
      ON user_engagement_sessions FOR ALL
      USING (is_admin());
    
    CREATE POLICY user_post_views_admin_all
      ON user_post_views FOR ALL
      USING (is_admin());
    
    CREATE POLICY engagement_events_admin_all
      ON engagement_events FOR ALL
      USING (is_admin());
    
    CREATE POLICY dfs_user_statistics_admin_all
      ON dfs_user_statistics FOR ALL
      USING (is_admin());
  END IF;
END $$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to service role
GRANT ALL ON user_engagement_sessions TO service_role;
GRANT ALL ON user_post_views TO service_role;
GRANT ALL ON engagement_events TO service_role;
GRANT ALL ON dfs_user_statistics TO service_role;

-- Grant read access to materialized views for all authenticated users
GRANT SELECT ON daily_engagement_metrics TO authenticated;
GRANT SELECT ON dfs_conversion_funnel TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_engagement_sessions IS 'Tracks user session duration and engagement for analytics';
COMMENT ON TABLE user_post_views IS 'Detailed view tracking per post with completion rates';
COMMENT ON TABLE engagement_events IS 'Granular event tracking for deep analytics';
COMMENT ON TABLE dfs_user_statistics IS 'Aggregated DFS performance stats per user';
COMMENT ON MATERIALIZED VIEW daily_engagement_metrics IS 'Daily aggregated engagement metrics for investor dashboards';
COMMENT ON MATERIALIZED VIEW dfs_conversion_funnel IS 'Conversion tracking from viewers to DFS players';

-- ============================================================================
-- END OF ENGAGEMENT TRACKING SYSTEM
-- ============================================================================

