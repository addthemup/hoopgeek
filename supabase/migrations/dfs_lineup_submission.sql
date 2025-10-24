-- DFS Lineup Submission System
-- This migration adds the functionality to submit and finalize DFS lineups

-- =============================================================================
-- 1. Add submission timestamp and status to dfs_entries
-- =============================================================================

-- Add columns to track submission and scoring
ALTER TABLE dfs_entries
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lineup_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_salary BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS projected_points DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_points DECIMAL,
ADD COLUMN IF NOT EXISTS final_rank INTEGER;

-- Add index for querying submitted entries
CREATE INDEX IF NOT EXISTS idx_dfs_entries_submitted 
  ON dfs_entries(pool_id, is_submitted) 
  WHERE is_submitted = TRUE;

-- =============================================================================
-- 2. Function to calculate and update entry totals
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_dfs_entry_totals(
  p_entry_id UUID
)
RETURNS TABLE(
  total_salary BIGINT,
  projected_points DECIMAL,
  player_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ps.salary), 0)::BIGINT as total_salary,
    COALESCE(SUM(ps.projected_points * lp.multiplier), 0)::DECIMAL as projected_points,
    COUNT(*)::INTEGER as player_count
  FROM dfs_lineup_positions lp
  JOIN dfs_player_salaries ps ON lp.player_id = ps.player_id AND lp.pool_id = ps.pool_id
  WHERE lp.entry_id = p_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Function to submit DFS lineup
-- =============================================================================

CREATE OR REPLACE FUNCTION submit_dfs_lineup(
  p_pool_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  entry_id UUID,
  total_salary BIGINT,
  projected_points DECIMAL
) AS $$
DECLARE
  v_entry_id UUID;
  v_pool_salary_cap BIGINT;
  v_pool_lock_time TIMESTAMPTZ;
  v_pool_status TEXT;
  v_total_salary BIGINT;
  v_projected_points DECIMAL;
  v_player_count INTEGER;
BEGIN
  -- Get pool details
  SELECT salary_cap, lock_time, status
  INTO v_pool_salary_cap, v_pool_lock_time, v_pool_status
  FROM dfs_pools
  WHERE id = p_pool_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Pool not found'::TEXT, NULL::UUID, 0::BIGINT, 0::DECIMAL;
    RETURN;
  END IF;

  -- Validate pool is still open
  IF v_pool_status != 'scheduled' THEN
    RETURN QUERY SELECT FALSE, 'Pool is no longer accepting entries'::TEXT, NULL::UUID, 0::BIGINT, 0::DECIMAL;
    RETURN;
  END IF;

  -- Validate not past lock time
  IF NOW() >= v_pool_lock_time THEN
    RETURN QUERY SELECT FALSE, 'Pool has locked, no more entries allowed'::TEXT, NULL::UUID, 0::BIGINT, 0::DECIMAL;
    RETURN;
  END IF;

  -- Get or find entry
  SELECT id INTO v_entry_id
  FROM dfs_entries
  WHERE pool_id = p_pool_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No lineup found for this pool'::TEXT, NULL::UUID, 0::BIGINT, 0::DECIMAL;
    RETURN;
  END IF;

  -- Check if already submitted
  IF EXISTS (SELECT 1 FROM dfs_entries WHERE id = v_entry_id AND is_submitted = TRUE) THEN
    RETURN QUERY SELECT FALSE, 'Lineup already submitted'::TEXT, v_entry_id, 0::BIGINT, 0::DECIMAL;
    RETURN;
  END IF;

  -- Calculate totals
  SELECT * INTO v_total_salary, v_projected_points, v_player_count
  FROM calculate_dfs_entry_totals(v_entry_id);

  -- Validate lineup is complete (10 players)
  IF v_player_count != 10 THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('Lineup incomplete: %s/10 players', v_player_count)::TEXT, 
      v_entry_id, 
      v_total_salary, 
      v_projected_points;
    RETURN;
  END IF;

  -- Validate salary cap
  IF v_total_salary > v_pool_salary_cap THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('Lineup exceeds salary cap: $%s / $%s', v_total_salary, v_pool_salary_cap)::TEXT, 
      v_entry_id, 
      v_total_salary, 
      v_projected_points;
    RETURN;
  END IF;

  -- Update entry with final totals and submission status
  UPDATE dfs_entries
  SET
    total_salary = v_total_salary,
    projected_points = v_projected_points,
    is_submitted = TRUE,
    submitted_at = NOW(),
    lineup_locked = TRUE
  WHERE id = v_entry_id;

  -- Increment pool entry count
  UPDATE dfs_pools
  SET current_entries = current_entries + 1
  WHERE id = p_pool_id;

  -- Success!
  RETURN QUERY SELECT 
    TRUE, 
    'Lineup submitted successfully!'::TEXT, 
    v_entry_id, 
    v_total_salary, 
    v_projected_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. Function to unsubmit lineup (for testing/editing)
-- =============================================================================

CREATE OR REPLACE FUNCTION unsubmit_dfs_lineup(
  p_pool_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_entry_id UUID;
  v_pool_lock_time TIMESTAMPTZ;
  v_is_submitted BOOLEAN;
BEGIN
  -- Get pool lock time
  SELECT lock_time INTO v_pool_lock_time
  FROM dfs_pools
  WHERE id = p_pool_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Pool not found'::TEXT;
    RETURN;
  END IF;

  -- Validate not past lock time
  IF NOW() >= v_pool_lock_time THEN
    RETURN QUERY SELECT FALSE, 'Pool has locked, cannot edit lineup'::TEXT;
    RETURN;
  END IF;

  -- Get entry
  SELECT id, is_submitted INTO v_entry_id, v_is_submitted
  FROM dfs_entries
  WHERE pool_id = p_pool_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No entry found'::TEXT;
    RETURN;
  END IF;

  IF NOT v_is_submitted THEN
    RETURN QUERY SELECT FALSE, 'Lineup was not submitted'::TEXT;
    RETURN;
  END IF;

  -- Unsubmit the entry
  UPDATE dfs_entries
  SET
    is_submitted = FALSE,
    submitted_at = NULL,
    lineup_locked = FALSE
  WHERE id = v_entry_id;

  -- Decrement pool entry count
  UPDATE dfs_pools
  SET current_entries = GREATEST(0, current_entries - 1)
  WHERE id = p_pool_id;

  RETURN QUERY SELECT TRUE, 'Lineup unsubmitted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. View for user's submitted entries
-- =============================================================================

CREATE OR REPLACE VIEW dfs_user_submitted_entries AS
SELECT
  e.id as entry_id,
  e.user_id,
  e.pool_id,
  p.name as pool_name,
  p.slate_name,
  p.slate_date,
  p.entry_fee,
  e.total_salary,
  e.projected_points,
  e.final_points,
  e.final_rank,
  e.submitted_at,
  e.is_submitted,
  p.lock_time,
  p.end_time,
  p.status as pool_status,
  CASE
    WHEN p.status = 'final' AND e.final_rank IS NOT NULL THEN 'final'
    WHEN p.status IN ('live', 'scoring') THEN 'in_progress'
    WHEN p.status IN ('scheduled', 'filling', 'guaranteed') THEN 'pending'
    WHEN p.status = 'cancelled' THEN 'cancelled'
    ELSE 'unknown'
  END as entry_status
FROM dfs_entries e
JOIN dfs_pools p ON e.pool_id = p.id
WHERE e.is_submitted = TRUE
ORDER BY e.submitted_at DESC;

-- =============================================================================
-- 6. Grant permissions
-- =============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION calculate_dfs_entry_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_dfs_lineup(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unsubmit_dfs_lineup(UUID, UUID) TO authenticated;

-- Grant select on view to authenticated users
GRANT SELECT ON dfs_user_submitted_entries TO authenticated;

-- =============================================================================
-- 7. RLS Policies (if not already covered)
-- =============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own entries" ON dfs_entries;
DROP POLICY IF EXISTS "Users can update own unsubmitted entries" ON dfs_entries;

-- Allow users to view their own entries
CREATE POLICY "Users can view own entries" ON dfs_entries
  FOR SELECT USING (user_id = auth.uid());

-- Allow users to update their own unsubmitted entries
CREATE POLICY "Users can update own unsubmitted entries" ON dfs_entries
  FOR UPDATE USING (user_id = auth.uid() AND is_submitted = FALSE);

-- =============================================================================
-- Verification
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ DFS Lineup Submission System installed successfully';
  RAISE NOTICE '📋 Functions created:';
  RAISE NOTICE '   - calculate_dfs_entry_totals()';
  RAISE NOTICE '   - submit_dfs_lineup()';
  RAISE NOTICE '   - unsubmit_dfs_lineup()';
  RAISE NOTICE '🎯 Ready to submit lineups!';
END $$;

