-- ============================================================================
-- Fix submit_dfs_lineup functions to use correct column names
-- ============================================================================

-- Fix calculate_dfs_entry_totals function
CREATE OR REPLACE FUNCTION calculate_dfs_entry_totals(p_entry_id UUID)
RETURNS TABLE(
  total_salary BIGINT,
  projected_points DECIMAL,
  player_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(lp.player_salary), 0)::BIGINT as total_salary,
    COALESCE(SUM(ps.projected_points * lp.unit_multiplier), 0)::DECIMAL as projected_points,
    COUNT(*)::INTEGER as player_count
  FROM dfs_lineups l
  JOIN dfs_lineup_positions lp ON l.id = lp.lineup_id
  JOIN dfs_player_salaries ps ON lp.player_id = ps.player_id AND lp.pool_id = ps.pool_id
  WHERE l.entry_id = p_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_dfs_entry_totals IS
'Calculates total salary, projected points, and player count for an entry.
Uses player_salary from lineup_positions (denormalized) and unit_multiplier.';

