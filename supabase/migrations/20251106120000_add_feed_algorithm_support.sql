-- ============================================================================
-- FEED ALGORITHM SUPPORT
-- ============================================================================
-- Adds views and functions to support the advanced feed algorithm:
-- 1. DFS context by game date (players/teams user had in DFS)
-- 2. Post frequency tracking (how many times shown to user)
-- 3. User behavior patterns (preferences, completion rates)
-- ============================================================================

-- ============================================================================
-- VIEW: User DFS Context by Game Date
-- ============================================================================
-- Returns all players and teams a user had in DFS lineups, grouped by game_date
-- Includes performance data (fantasy points, won/lost)
-- ============================================================================

CREATE OR REPLACE VIEW user_dfs_context_by_date AS
WITH player_data AS (
  SELECT 
    de.user_id,
    DATE(dpg.game_date) as game_date,
    dlp.nba_player_id,
    dlp.player_team,
    COALESCE(dlp.raw_fantasy_points, 0) as fantasy_points,
    COALESCE(dlp.weighted_points, 0) as weighted_points,
    de.id as entry_id
  FROM dfs_entries de
  INNER JOIN dfs_lineups dl ON dl.entry_id = de.id
  INNER JOIN dfs_lineup_positions dlp ON dlp.lineup_id = dl.id
  INNER JOIN dfs_pool_games dpg ON dpg.pool_id = dlp.pool_id
  WHERE de.is_submitted = TRUE
    AND de.user_id IS NOT NULL
    AND dlp.nba_player_id IS NOT NULL
),
player_aggregated AS (
  SELECT 
    user_id,
    game_date,
    nba_player_id,
    player_team,
    MAX(fantasy_points) as max_fantasy_points,
    MAX(weighted_points) as max_weighted_points,
    COUNT(DISTINCT entry_id) as entry_count
  FROM player_data
  GROUP BY user_id, game_date, nba_player_id, player_team
)
SELECT 
  user_id,
  game_date,
  ARRAY_AGG(DISTINCT nba_player_id) FILTER (WHERE nba_player_id IS NOT NULL) as player_ids,
  ARRAY_AGG(DISTINCT player_team) FILTER (WHERE player_team IS NOT NULL) as team_tricodes,
  -- Performance data per player
  jsonb_object_agg(
    nba_player_id::text,
    jsonb_build_object(
      'fantasyPoints', max_fantasy_points,
      'weightedPoints', max_weighted_points,
      'entryCount', entry_count
    )
  ) FILTER (WHERE nba_player_id IS NOT NULL) as player_performance
FROM player_aggregated
GROUP BY user_id, game_date;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_dfs_entries_user_submitted 
  ON dfs_entries(user_id, is_submitted) 
  WHERE is_submitted = TRUE;

-- Note: Can't use DATE() function in index as it's not IMMUTABLE
-- Instead, we'll rely on the existing indexes and add a computed column if needed
-- For now, the game_date index on the base column should be sufficient
-- CREATE INDEX IF NOT EXISTS idx_dfs_pool_games_date 
--   ON dfs_pool_games(DATE(game_date));

COMMENT ON VIEW user_dfs_context_by_date IS 
'Returns DFS context (players/teams) for each user by game date. 
Used by feed algorithm to boost posts featuring players user had in DFS.';

-- ============================================================================
-- FUNCTION: Get User DFS Context for Feed Algorithm
-- ============================================================================
-- Returns a JSONB object mapping game_date -> DFS context
-- Format: { "2024-11-06": { "playerIds": [123, 456], "teamTricodes": ["LAL", "BOS"], ... } }
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_dfs_context_for_feed(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_context RECORD;
  v_player_perf JSONB;
BEGIN
  FOR v_context IN
    WITH player_data AS (
      SELECT 
        DATE(dpg.game_date)::date as game_date,
        dlp.nba_player_id,
        dlp.player_team,
        COALESCE(dlp.raw_fantasy_points, 0) as fantasy_points,
        de.id as entry_id,
        de.pool_id,
        de.final_rank,
        (SELECT COUNT(*)::INTEGER FROM dfs_entries WHERE pool_id = de.pool_id AND is_submitted = TRUE) as total_entries
      FROM dfs_entries de
      INNER JOIN dfs_lineups dl ON dl.entry_id = de.id
      INNER JOIN dfs_lineup_positions dlp ON dlp.lineup_id = dl.id
      INNER JOIN dfs_pool_games dpg ON dpg.pool_id = dlp.pool_id
      WHERE de.user_id = p_user_id
        AND de.is_submitted = TRUE
        AND dpg.game_date >= CURRENT_DATE - INTERVAL '30 days'
        AND dlp.nba_player_id IS NOT NULL
    ),
    player_aggregated AS (
      SELECT 
        game_date,
        nba_player_id,
        player_team,
        MAX(fantasy_points) as max_fantasy_points,
        BOOL_OR(
          final_rank IS NOT NULL 
          AND total_entries > 0 
          AND final_rank <= GREATEST(total_entries / 10, 1)
        ) as won,
        COUNT(DISTINCT entry_id) as entry_count
      FROM player_data
      GROUP BY game_date, nba_player_id, player_team
    ),
    aggregated AS (
      SELECT 
        game_date,
        ARRAY_AGG(DISTINCT nba_player_id) FILTER (WHERE nba_player_id IS NOT NULL) as player_ids,
        ARRAY_AGG(DISTINCT player_team) FILTER (WHERE player_team IS NOT NULL) as team_tricodes,
        jsonb_object_agg(
          nba_player_id::text,
          jsonb_build_object(
            'fantasyPoints', max_fantasy_points,
            'won', won,
            'entryCount', entry_count
          )
        ) FILTER (WHERE nba_player_id IS NOT NULL) as player_performance
      FROM player_aggregated
      GROUP BY game_date
    )
    SELECT 
      game_date::text,
      player_ids,
      team_tricodes,
      player_performance
    FROM aggregated
  LOOP
    v_result := v_result || jsonb_build_object(
      v_context.game_date,
      jsonb_build_object(
        'playerIds', COALESCE(v_context.player_ids, ARRAY[]::INTEGER[]),
        'teamTricodes', COALESCE(v_context.team_tricodes, ARRAY[]::TEXT[]),
        'playerPerformance', COALESCE(v_context.player_performance, '{}'::jsonb)
      )
    );
  END LOOP;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_dfs_context_for_feed IS 
'Returns user DFS context (players/teams by game date) for feed algorithm.
Returns JSONB mapping game_date -> context with playerIds, teamTricodes, and performance.';

-- ============================================================================
-- VIEW: Post Frequency by User
-- ============================================================================
-- Counts how many times each post has been shown/viewed by each user
-- ============================================================================

CREATE OR REPLACE VIEW user_post_frequencies AS
SELECT 
  upv.user_id,
  upv.post_id,
  COUNT(*) as times_shown,
  MAX(upv.view_started_at) as last_shown_at,
  AVG(upv.completion_percentage) as avg_completion_rate,
  AVG(upv.view_duration_seconds) as avg_view_duration
FROM user_post_views upv
WHERE upv.user_id IS NOT NULL
GROUP BY upv.user_id, upv.post_id;

CREATE INDEX IF NOT EXISTS idx_user_post_views_user_post 
  ON user_post_views(user_id, post_id, view_started_at DESC);

COMMENT ON VIEW user_post_frequencies IS 
'Tracks how many times each post has been shown to each user.
Used by feed algorithm to prevent showing same post too frequently.';

-- ============================================================================
-- FUNCTION: Get User Post Frequencies for Feed Algorithm
-- ============================================================================
-- Returns a JSONB object mapping post_id -> frequency data
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_post_frequencies(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_freq RECORD;
BEGIN
  FOR v_freq IN
    SELECT 
      post_id::text,
      jsonb_build_object(
        'timesShown', COUNT(*),
        'lastShownAt', EXTRACT(EPOCH FROM MAX(view_started_at))::BIGINT * 1000, -- Convert to milliseconds
        'avgCompletionRate', AVG(completion_percentage),
        'avgViewDuration', AVG(view_duration_seconds)
      ) as frequency_data
    FROM user_post_views
    WHERE user_id = p_user_id
      AND view_started_at >= CURRENT_TIMESTAMP - INTERVAL '90 days' -- Only recent views
    GROUP BY post_id
  LOOP
    v_result := v_result || jsonb_build_object(v_freq.post_id, v_freq.frequency_data);
  END LOOP;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_post_frequencies IS 
'Returns post frequency data for a user (how many times shown, last shown, etc).
Used by feed algorithm to prevent repetition.';

-- ============================================================================
-- VIEW: User Feed Behavior Patterns
-- ============================================================================
-- Aggregates user behavior data for feed personalization
-- ============================================================================

CREATE OR REPLACE VIEW user_feed_behavior AS
SELECT 
  upv.user_id,
  -- Post type preference (which type they view more)
  CASE 
    WHEN COUNT(*) FILTER (WHERE fp.post_type = 'fun_score') > COUNT(*) FILTER (WHERE fp.post_type = 'player_spotlight')
    THEN 'fun_score'
    WHEN COUNT(*) FILTER (WHERE fp.post_type = 'player_spotlight') > COUNT(*) FILTER (WHERE fp.post_type = 'fun_score')
    THEN 'player_spotlight'
    ELSE NULL
  END as preferred_post_type,
  -- Average metrics
  AVG(upv.view_duration_seconds) as avg_time_spent,
  AVG(upv.completion_percentage) as avg_completion_rate,
  -- Engagement metrics
  COUNT(*) FILTER (WHERE upv.did_like = TRUE) as total_likes,
  COUNT(*) FILTER (WHERE upv.did_comment = TRUE) as total_comments,
  COUNT(*) FILTER (WHERE upv.did_share = TRUE) as total_shares,
  -- View patterns
  COUNT(*) as total_views,
  COUNT(DISTINCT DATE(upv.view_started_at)) as active_days
FROM user_post_views upv
INNER JOIN feed_posts fp ON fp.id = upv.post_id
WHERE upv.user_id IS NOT NULL
  AND upv.view_started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' -- Last 30 days
GROUP BY upv.user_id;

COMMENT ON VIEW user_feed_behavior IS 
'Aggregates user behavior patterns for feed personalization.
Includes preferred post type, average viewing time, completion rates, etc.';

-- ============================================================================
-- FUNCTION: Get User Behavior for Feed Algorithm
-- ============================================================================
-- Returns user behavior data as JSONB
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_feed_behavior(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'preferredPostType', ufb.preferred_post_type,
    'avgTimeSpent', ufb.avg_time_spent,
    'completionRate', ufb.avg_completion_rate,
    'totalLikes', ufb.total_likes,
    'totalComments', ufb.total_comments,
    'totalShares', ufb.total_shares,
    'totalViews', ufb.total_views,
    'activeDays', ufb.active_days
  )
  INTO v_result
  FROM user_feed_behavior ufb
  WHERE ufb.user_id = p_user_id;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_feed_behavior IS 
'Returns user behavior patterns for feed algorithm personalization.
Includes preferred post type, viewing habits, engagement patterns.';

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Users can read their own DFS context
ALTER VIEW user_dfs_context_by_date SET (security_invoker = true);

-- Users can read their own post frequencies
ALTER VIEW user_post_frequencies SET (security_invoker = true);

-- Users can read their own behavior data
ALTER VIEW user_feed_behavior SET (security_invoker = true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON user_dfs_context_by_date TO authenticated;
GRANT SELECT ON user_post_frequencies TO authenticated;
GRANT SELECT ON user_feed_behavior TO authenticated;

GRANT EXECUTE ON FUNCTION get_user_dfs_context_for_feed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_post_frequencies(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_feed_behavior(UUID) TO authenticated;

