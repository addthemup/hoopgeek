-- ============================================================================
-- Mark Old Pool Entries as Submitted
-- ============================================================================
-- Updates all DFS entries in pools before 2025-12-15 to be submitted
-- This is for testing purposes
-- ============================================================================

UPDATE dfs_entries
SET 
  is_submitted = TRUE,
  submitted_at = COALESCE(submitted_at, created_at, NOW()),
  lineup_locked = TRUE,
  updated_at = NOW()
WHERE 
  pool_id IN (
    SELECT id 
    FROM dfs_pools 
    WHERE slate_date < '2025-12-15'::DATE
  )
  AND (is_submitted IS NULL OR is_submitted = FALSE);

-- Show how many entries were updated
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM dfs_entries
  WHERE 
    pool_id IN (
      SELECT id 
      FROM dfs_pools 
      WHERE slate_date < '2025-12-15'::DATE
    )
    AND is_submitted = TRUE;
  
  RAISE NOTICE '✅ Updated entries to submitted status. Total submitted entries in old pools: %', v_updated_count;
END $$;

