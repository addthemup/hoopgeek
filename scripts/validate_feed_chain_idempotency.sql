-- Validate full feed automation chain behavior:
-- 1) chain jobs are installed
-- 2) no duplicate source_ref rows for chain post types
-- 3) checkpoint coverage and readiness
-- 4) recent run health

-- 1) Cron jobs
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'feed-chain-%'
ORDER BY jobname;

-- 2) Duplicate guard: source_ref should be unique per post type/date/game
SELECT
  post_type,
  source_ref,
  COUNT(*) AS duplicate_count
FROM feed_posts
WHERE post_type IN (
  'player_spotlight',
  'prop_results',
  'game_recap',
  'team_of_night',
  'prop_prediction',
  'injury_report',
  'upcoming'
)
GROUP BY post_type, source_ref
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, post_type, source_ref;

-- 3) Daily post creation snapshot (last 7 days)
SELECT
  (published_at AT TIME ZONE 'America/New_York')::date AS et_day,
  post_type,
  COUNT(*) AS post_count
FROM feed_posts
WHERE post_type IN (
  'player_spotlight',
  'prop_results',
  'game_recap',
  'team_of_night',
  'prop_prediction',
  'injury_report',
  'upcoming'
)
  AND published_at >= NOW() - INTERVAL '7 days'
GROUP BY et_day, post_type
ORDER BY et_day DESC, post_type;

-- 4) Checkpoint status for recent games
SELECT
  c.game_id,
  c.game_date,
  c.player_spotlight_batch_done,
  c.prop_results_batch_done,
  c.prop_prediction_batch_done,
  c.injury_report_batch_done
FROM feed_automation_checkpoints c
ORDER BY c.game_date DESC, c.game_id DESC
LIMIT 200;

-- 5) Recent feed-chain cron outcomes
SELECT
  j.jobname,
  d.status,
  d.start_time,
  d.end_time,
  d.return_message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname LIKE 'feed-chain-%'
ORDER BY d.start_time DESC
LIMIT 200;

