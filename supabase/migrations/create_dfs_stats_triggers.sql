-- ============================================================================
-- DFS USER STATISTICS AUTO-UPDATE TRIGGERS
-- ============================================================================
-- Purpose: Automatically update dfs_user_statistics when entries are scored
-- This ensures real-time analytics for investor dashboards
-- ============================================================================

-- Function: Recalculate user DFS statistics
CREATE OR REPLACE FUNCTION recalculate_dfs_user_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_contests INTEGER;
  v_active_contests INTEGER;
  v_completed_contests INTEGER;
  v_total_fees DECIMAL(12, 2);
  v_total_winnings DECIMAL(12, 2);
  v_net_profit DECIMAL(12, 2);
  v_roi DECIMAL(10, 2);
  v_contests_won INTEGER;
  v_contests_cashed INTEGER;
  v_cash_rate DECIMAL(5, 2);
  v_win_rate DECIMAL(5, 2);
  v_avg_score DECIMAL(10, 2);
  v_best_score DECIMAL(10, 2);
  v_total_points DECIMAL(15, 2);
  v_avg_rank DECIMAL(10, 2);
  v_best_rank INTEGER;
  v_top_10 INTEGER;
  v_top_25_percent INTEGER;
  v_total_lineups INTEGER;
  v_last_contest TIMESTAMPTZ;
  v_last_prize TIMESTAMPTZ;
  v_first_contest TIMESTAMPTZ;
BEGIN
  -- Get basic contest participation stats
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total_contests, v_active_contests, v_completed_contests
  FROM dfs_entries
  WHERE user_id = p_user_id;
  
  -- Get financial stats
  SELECT
    COALESCE(SUM(entry_fee_paid), 0),
    COALESCE(SUM(prize_amount), 0)
  INTO v_total_fees, v_total_winnings
  FROM dfs_entries
  WHERE user_id = p_user_id;
  
  v_net_profit := v_total_winnings - v_total_fees;
  v_roi := CASE WHEN v_total_fees > 0 
    THEN (v_net_profit / v_total_fees) * 100 
    ELSE NULL 
  END;
  
  -- Get performance stats (only completed contests)
  SELECT
    COUNT(*) FILTER (WHERE rank = 1),
    COUNT(*) FILTER (WHERE prize_amount > 0)
  INTO v_contests_won, v_contests_cashed
  FROM dfs_entries
  WHERE user_id = p_user_id
    AND status = 'completed';
  
  v_cash_rate := CASE WHEN v_completed_contests > 0
    THEN (v_contests_cashed::DECIMAL / v_completed_contests) * 100
    ELSE NULL
  END;
  
  v_win_rate := CASE WHEN v_completed_contests > 0
    THEN (v_contests_won::DECIMAL / v_completed_contests) * 100
    ELSE NULL
  END;
  
  -- Get scoring stats
  SELECT
    AVG(final_score),
    MAX(final_score),
    SUM(final_score)
  INTO v_avg_score, v_best_score, v_total_points
  FROM dfs_entries
  WHERE user_id = p_user_id
    AND final_score IS NOT NULL;
  
  -- Get ranking stats
  SELECT
    AVG(rank),
    MIN(rank),
    COUNT(*) FILTER (WHERE rank <= 10),
    COUNT(*) FILTER (WHERE percentile <= 25)
  INTO v_avg_rank, v_best_rank, v_top_10, v_top_25_percent
  FROM dfs_entries
  WHERE user_id = p_user_id
    AND rank IS NOT NULL;
  
  -- Get lineup count
  SELECT COUNT(*)
  INTO v_total_lineups
  FROM dfs_lineups
  WHERE user_id = p_user_id;
  
  -- Get dates
  SELECT
    MAX(created_at) FILTER (WHERE created_at IS NOT NULL),
    MAX(created_at) FILTER (WHERE prize_amount > 0),
    MIN(created_at)
  INTO v_last_contest, v_last_prize, v_first_contest
  FROM dfs_entries
  WHERE user_id = p_user_id;
  
  -- Upsert user statistics
  INSERT INTO dfs_user_statistics (
    user_id,
    total_contests_entered,
    active_contests,
    completed_contests,
    total_entry_fees_paid,
    total_winnings,
    net_profit_loss,
    roi_percentage,
    contests_won,
    contests_cashed,
    cash_rate,
    win_rate,
    avg_final_score,
    best_final_score,
    total_points_scored,
    avg_rank,
    best_rank,
    top_10_finishes,
    top_25_percent_finishes,
    total_lineups_created,
    last_contest_entered_at,
    last_prize_won_at,
    first_contest_at,
    last_updated_at
  ) VALUES (
    p_user_id,
    v_total_contests,
    v_active_contests,
    v_completed_contests,
    v_total_fees,
    v_total_winnings,
    v_net_profit,
    v_roi,
    v_contests_won,
    v_contests_cashed,
    v_cash_rate,
    v_win_rate,
    v_avg_score,
    v_best_score,
    v_total_points,
    v_avg_rank,
    v_best_rank,
    v_top_10,
    v_top_25_percent,
    v_total_lineups,
    v_last_contest,
    v_last_prize,
    v_first_contest,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_contests_entered = EXCLUDED.total_contests_entered,
    active_contests = EXCLUDED.active_contests,
    completed_contests = EXCLUDED.completed_contests,
    total_entry_fees_paid = EXCLUDED.total_entry_fees_paid,
    total_winnings = EXCLUDED.total_winnings,
    net_profit_loss = EXCLUDED.net_profit_loss,
    roi_percentage = EXCLUDED.roi_percentage,
    contests_won = EXCLUDED.contests_won,
    contests_cashed = EXCLUDED.contests_cashed,
    cash_rate = EXCLUDED.cash_rate,
    win_rate = EXCLUDED.win_rate,
    avg_final_score = EXCLUDED.avg_final_score,
    best_final_score = EXCLUDED.best_final_score,
    total_points_scored = EXCLUDED.total_points_scored,
    avg_rank = EXCLUDED.avg_rank,
    best_rank = EXCLUDED.best_rank,
    top_10_finishes = EXCLUDED.top_10_finishes,
    top_25_percent_finishes = EXCLUDED.top_25_percent_finishes,
    total_lineups_created = EXCLUDED.total_lineups_created,
    last_contest_entered_at = EXCLUDED.last_contest_entered_at,
    last_prize_won_at = EXCLUDED.last_prize_won_at,
    first_contest_at = EXCLUDED.first_contest_at,
    last_updated_at = now();
    
  RAISE NOTICE 'Updated DFS stats for user: %', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-update stats when entry is updated
CREATE OR REPLACE FUNCTION trigger_update_dfs_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate stats for the user (async via pg_notify for performance)
  PERFORM pg_notify('dfs_stats_update', NEW.user_id::text);
  
  -- For immediate updates on scoring completion
  IF (TG_OP = 'UPDATE' AND OLD.final_score IS NULL AND NEW.final_score IS NOT NULL) THEN
    PERFORM recalculate_dfs_user_stats(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_dfs_entry_stats_update ON dfs_entries;

-- Create trigger on dfs_entries
CREATE TRIGGER trigger_dfs_entry_stats_update
  AFTER INSERT OR UPDATE ON dfs_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_dfs_stats();

-- Also trigger when lineup is created
CREATE OR REPLACE FUNCTION trigger_lineup_created()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dfs_user_statistics
  SET 
    total_lineups_created = total_lineups_created + 1,
    last_updated_at = now()
  WHERE user_id = NEW.user_id;
  
  -- If stats row doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO dfs_user_statistics (user_id, total_lineups_created, first_contest_at)
    VALUES (NEW.user_id, 1, now())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lineup_created ON dfs_lineups;

CREATE TRIGGER trigger_lineup_created
  AFTER INSERT ON dfs_lineups
  FOR EACH ROW
  EXECUTE FUNCTION trigger_lineup_created();

-- ============================================================================
-- ADMIN FUNCTION: Recalculate ALL user stats (for backfill/fixes)
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_all_dfs_user_stats()
RETURNS TABLE(user_id UUID, stats_updated BOOLEAN) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN 
    SELECT DISTINCT e.user_id 
    FROM dfs_entries e
  LOOP
    BEGIN
      PERFORM recalculate_dfs_user_stats(v_user_id);
      user_id := v_user_id;
      stats_updated := TRUE;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      user_id := v_user_id;
      stats_updated := FALSE;
      RETURN NEXT;
      RAISE NOTICE 'Failed to update stats for user %: %', v_user_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION recalculate_dfs_user_stats TO service_role;
GRANT EXECUTE ON FUNCTION recalculate_all_dfs_user_stats TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION recalculate_dfs_user_stats IS 'Recalculates all DFS statistics for a single user';
COMMENT ON FUNCTION recalculate_all_dfs_user_stats IS 'Recalculates DFS statistics for ALL users (admin only)';
COMMENT ON FUNCTION trigger_update_dfs_stats IS 'Trigger function to auto-update DFS stats when entries change';
COMMENT ON FUNCTION trigger_lineup_created IS 'Trigger function to track lineup creation count';

-- ============================================================================
-- END OF DFS STATS TRIGGERS
-- ============================================================================

