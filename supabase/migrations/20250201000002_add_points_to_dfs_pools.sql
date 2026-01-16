-- ============================================================================
-- Add Points Configuration to DFS Pools
-- ============================================================================
-- This migration adds point configuration fields to dfs_pools and creates
-- functions to automatically award points when entries are submitted and
-- when pools are finalized.

-- ----------------------------------------------------------------------------
-- 1. Add Point Configuration Columns to dfs_pools
-- ----------------------------------------------------------------------------
ALTER TABLE dfs_pools
ADD COLUMN IF NOT EXISTS points_entry INTEGER DEFAULT 10, -- Points for entering
ADD COLUMN IF NOT EXISTS points_win INTEGER DEFAULT 100, -- Points for 1st place
ADD COLUMN IF NOT EXISTS points_placement JSONB DEFAULT '[]'::jsonb, -- Incremental points for placements
ADD COLUMN IF NOT EXISTS points_top_percent JSONB DEFAULT '[]'::jsonb, -- Points for top N%
ADD COLUMN IF NOT EXISTS points_enabled BOOLEAN DEFAULT TRUE; -- Enable/disable points for this pool

-- Example points_placement: [{"rank": 1, "points": 100}, {"rank": 2, "points": 75}, {"rank": 3, "points": 50}]
-- Example points_top_percent: [{"percent": 10, "points": 25}, {"percent": 25, "points": 10}]

-- Add constraints
ALTER TABLE dfs_pools
ADD CONSTRAINT valid_points_entry CHECK (points_entry >= 0),
ADD CONSTRAINT valid_points_win CHECK (points_win >= 0);

-- ----------------------------------------------------------------------------
-- 2. Function to Award Entry Points
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_entry_points(
  p_entry_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_entry RECORD;
  v_pool RECORD;
  v_points INTEGER;
BEGIN
  -- Get entry details
  SELECT * INTO v_entry
  FROM dfs_entries
  WHERE id = p_entry_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get pool details
  SELECT * INTO v_pool
  FROM dfs_pools
  WHERE id = v_entry.pool_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if points are enabled for this pool
  IF NOT v_pool.points_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Check if entry is submitted
  IF NOT v_entry.is_submitted THEN
    RETURN FALSE;
  END IF;
  
  -- Check if points already awarded for this entry
  IF EXISTS (
    SELECT 1 FROM dfs_point_transactions
    WHERE entry_id = p_entry_id
    AND transaction_type = 'entry'
  ) THEN
    RETURN FALSE; -- Already awarded
  END IF;
  
  -- Award entry points
  v_points := COALESCE(v_pool.points_entry, 10);
  
  PERFORM award_dfs_points(
    v_entry.user_id,
    v_points,
    'entry',
    'Entry points for pool: ' || v_pool.name,
    v_pool.id,
    p_entry_id,
    NULL,
    NULL,
    NULL,
    jsonb_build_object('pool_name', v_pool.name)
  );
  
  -- Update user stats
  UPDATE dfs_user_points
  SET total_entries = total_entries + 1
  WHERE user_id = v_entry.user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. Function to Award Placement Points
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_placement_points(
  p_entry_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_entry RECORD;
  v_pool RECORD;
  v_points INTEGER := 0;
  v_placement_points INTEGER := 0;
  v_top_percent_points INTEGER := 0;
  v_placement_tier TEXT;
  v_placement_config JSONB;
  v_percent_config JSONB;
BEGIN
  -- Get entry details
  SELECT * INTO v_entry
  FROM dfs_entries
  WHERE id = p_entry_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get pool details
  SELECT * INTO v_pool
  FROM dfs_pools
  WHERE id = v_entry.pool_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if points are enabled
  IF NOT v_pool.points_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Check if entry has a rank
  IF v_entry.rank IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if points already awarded for this placement
  IF EXISTS (
    SELECT 1 FROM dfs_point_transactions
    WHERE entry_id = p_entry_id
    AND transaction_type = 'placement'
  ) THEN
    RETURN FALSE; -- Already awarded
  END IF;
  
  -- Calculate points from placement config (rank-based)
  IF v_pool.points_placement IS NOT NULL AND jsonb_array_length(v_pool.points_placement) > 0 THEN
    -- Check each placement tier
    FOR v_placement_config IN SELECT * FROM jsonb_array_elements(v_pool.points_placement)
    LOOP
      IF (v_placement_config->>'rank')::INTEGER = v_entry.rank THEN
        v_placement_points := (v_placement_config->>'points')::INTEGER;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- If 1st place and no placement config, use points_win
  IF v_entry.rank = 1 AND v_placement_points = 0 THEN
    v_placement_points := COALESCE(v_pool.points_win, 100);
    v_placement_tier := '1st';
  ELSIF v_entry.rank = 2 THEN
    v_placement_tier := '2nd';
  ELSIF v_entry.rank = 3 THEN
    v_placement_tier := '3rd';
  ELSE
    v_placement_tier := v_entry.rank::TEXT || 'th';
  END IF;
  
  -- Calculate points from top percent config
  IF v_pool.points_top_percent IS NOT NULL AND jsonb_array_length(v_pool.points_top_percent) > 0 THEN
    -- Check each percent tier
    FOR v_percent_config IN SELECT * FROM jsonb_array_elements(v_pool.points_top_percent)
    LOOP
      DECLARE
        v_percent DECIMAL;
      BEGIN
        v_percent := (v_percent_config->>'percent')::DECIMAL;
        IF v_entry.percentile IS NOT NULL AND v_entry.percentile <= v_percent THEN
          v_top_percent_points := GREATEST(v_top_percent_points, (v_percent_config->>'points')::INTEGER);
        END IF;
      END;
    END LOOP;
  END IF;
  
  -- Use the higher of placement or percent points
  v_points := GREATEST(v_placement_points, v_top_percent_points);
  
  -- Award points if any
  IF v_points > 0 THEN
    PERFORM award_dfs_points(
      v_entry.user_id,
      v_points,
      'placement',
      'Placement points for pool: ' || v_pool.name || ' (Rank: ' || v_entry.rank || ')',
      v_pool.id,
      p_entry_id,
      v_entry.rank,
      v_entry.percentile,
      v_placement_tier,
      jsonb_build_object(
        'pool_name', v_pool.name,
        'rank', v_entry.rank,
        'percentile', v_entry.percentile
      )
    );
    
    -- Update user stats
    IF v_entry.rank = 1 THEN
      UPDATE dfs_user_points
      SET total_wins = total_wins + 1
      WHERE user_id = v_entry.user_id;
    END IF;
    
    IF v_entry.rank <= 10 THEN
      UPDATE dfs_user_points
      SET total_top_10 = total_top_10 + 1
      WHERE user_id = v_entry.user_id;
    END IF;
    
    IF v_entry.rank <= 25 THEN
      UPDATE dfs_user_points
      SET total_top_25 = total_top_25 + 1
      WHERE user_id = v_entry.user_id;
    END IF;
    
    -- Check for achievements
    PERFORM check_and_award_achievements(v_entry.user_id);
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. Trigger to Award Entry Points on Submission
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_award_entry_points()
RETURNS TRIGGER AS $$
BEGIN
  -- When entry is submitted, award entry points
  IF NEW.is_submitted = TRUE AND (OLD.is_submitted IS NULL OR OLD.is_submitted = FALSE) THEN
    PERFORM award_entry_points(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_award_entry_points_on_submit
  AFTER UPDATE OF is_submitted ON dfs_entries
  FOR EACH ROW
  WHEN (NEW.is_submitted = TRUE AND (OLD.is_submitted IS NULL OR OLD.is_submitted = FALSE))
  EXECUTE FUNCTION trigger_award_entry_points();

-- ----------------------------------------------------------------------------
-- 5. Trigger to Award Placement Points on Rank Update
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_award_placement_points()
RETURNS TRIGGER AS $$
BEGIN
  -- When rank is set and entry is submitted, award placement points
  IF NEW.rank IS NOT NULL AND NEW.is_submitted = TRUE THEN
    -- Only award if rank was just set (was NULL before)
    IF OLD.rank IS NULL THEN
      PERFORM award_placement_points(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_award_placement_points_on_rank
  AFTER UPDATE OF rank ON dfs_entries
  FOR EACH ROW
  WHEN (NEW.rank IS NOT NULL AND OLD.rank IS NULL AND NEW.is_submitted = TRUE)
  EXECUTE FUNCTION trigger_award_placement_points();

-- ----------------------------------------------------------------------------
-- 6. Function to Initialize User Points (called when user first enters a pool)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initialize_user_points(
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Create user points record if it doesn't exist
  INSERT INTO dfs_user_points (user_id, total_points, lifetime_points)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 7. Update submit_dfs_lineup function to initialize points
-- ----------------------------------------------------------------------------
-- This will be handled by the trigger, but we can also call it explicitly
-- in the submit function if needed

