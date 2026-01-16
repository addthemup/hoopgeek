-- ============================================================================
-- FIX DFS LINEUP POSITION CONSTRAINTS
-- ============================================================================
-- The original constraint was too restrictive - some pools have rotation_count = 5
-- and bench_count = 3, but the constraint only allowed rotation 1-3 and bench 1-2
-- ============================================================================

-- Drop the old constraint
ALTER TABLE dfs_lineup_positions 
DROP CONSTRAINT IF EXISTS valid_unit_position;

-- Add new, more flexible constraint
ALTER TABLE dfs_lineup_positions
ADD CONSTRAINT valid_unit_position CHECK (
  (unit = 'starters' AND unit_position BETWEEN 1 AND 5) OR
  (unit = 'rotation' AND unit_position BETWEEN 1 AND 5) OR
  (unit = 'bench' AND unit_position BETWEEN 1 AND 3)
);

COMMENT ON CONSTRAINT valid_unit_position ON dfs_lineup_positions IS 
'Validates unit_position based on unit type. Starters: 1-5, Rotation: 1-5, Bench: 1-3';

