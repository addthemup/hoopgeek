-- Validate integrity of persisted game highlight clips.
-- Usage: run in SQL editor after ingest jobs/backfills.

-- 1) Duplicate protection check
SELECT
  game_id,
  action_id,
  mp4_url,
  COUNT(*) AS duplicate_rows
FROM public.game_highlight_clips
GROUP BY game_id, action_id, mp4_url
HAVING COUNT(*) > 1
ORDER BY duplicate_rows DESC, game_id;

-- 2) Games with zero clips after a successful ingest run (potential issue)
WITH latest_success AS (
  SELECT DISTINCT ON (game_id)
    game_id,
    clips_extracted,
    clips_upserted,
    source_path,
    completed_at
  FROM public.game_highlight_ingest_runs
  WHERE status = 'success'
  ORDER BY game_id, completed_at DESC
)
SELECT
  s.game_id,
  s.source_path,
  s.clips_extracted,
  s.clips_upserted,
  COALESCE(c.clip_count, 0) AS stored_clip_count,
  s.completed_at
FROM latest_success s
LEFT JOIN (
  SELECT game_id, COUNT(*) AS clip_count
  FROM public.game_highlight_clips
  GROUP BY game_id
) c ON c.game_id = s.game_id
WHERE COALESCE(c.clip_count, 0) = 0
ORDER BY s.completed_at DESC;

-- 3) Recent run health snapshot
SELECT
  status,
  COUNT(*) AS run_count,
  MAX(completed_at) AS last_completed_at
FROM public.game_highlight_ingest_runs
WHERE created_at >= now() - interval '48 hours'
GROUP BY status
ORDER BY run_count DESC;
