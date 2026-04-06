-- Run in Supabase SQL Editor. Diagnoses why game_recap / upcoming may lag other post types.
-- (Player spotlights scan Storage; recaps + many automations key off nba_games + slate date.)

-- A) Volume by post type (last 14 days)
SELECT
  post_type,
  COUNT(*) AS n,
  MAX(published_at) AS latest_published
FROM feed_posts
WHERE published_at >= NOW() - INTERVAL '14 days'
GROUP BY post_type
ORDER BY n DESC;

-- B) Today vs yesterday slate in America/New_York (what morning cron should target after fix)
SELECT
  (NOW() AT TIME ZONE 'America/New_York')::date AS today_et,
  (NOW() AT TIME ZONE 'America/New_York')::date - 1 AS yesterday_et;

-- C) nba_games rows for yesterday ET (calendar match via EST date of game_date timestamptz)
--    Mirrors edge fetchGamesForDate + isDateInEST filter.
WITH bounds AS (
  SELECT
    (NOW() AT TIME ZONE 'America/New_York')::date - 1 AS slate_et
)
SELECT COUNT(*) AS games_yesterday_et
FROM nba_games g, bounds b
WHERE (g.game_date AT TIME ZONE 'America/New_York')::date = b.slate_et
  AND g.home_team_tricode IS NOT NULL
  AND g.away_team_tricode IS NOT NULL
  AND g.home_team_tricode <> g.away_team_tricode;

-- D) Same for today ET (upcoming hourly uses this slate)
WITH bounds AS (
  SELECT (NOW() AT TIME ZONE 'America/New_York')::date AS slate_et
)
SELECT COUNT(*) AS games_today_et
FROM nba_games g, bounds b
WHERE (g.game_date AT TIME ZONE 'America/New_York')::date = b.slate_et
  AND g.home_team_tricode IS NOT NULL
  AND g.away_team_tricode IS NOT NULL
  AND g.home_team_tricode <> g.away_team_tricode;

-- E) Missing recaps: yesterday ET games in nba_games with no published game_recap
WITH bounds AS (
  SELECT (NOW() AT TIME ZONE 'America/New_York')::date - 1 AS slate_et
),
slate_games AS (
  SELECT g.game_id
  FROM nba_games g, bounds b
  WHERE (g.game_date AT TIME ZONE 'America/New_York')::date = b.slate_et
    AND g.home_team_tricode IS NOT NULL
    AND g.away_team_tricode IS NOT NULL
)
SELECT s.game_id
FROM slate_games s
WHERE NOT EXISTS (
  SELECT 1
  FROM feed_posts p
  WHERE p.post_type = 'game_recap'
    AND p.status = 'published'
    AND p.game_id = s.game_id
)
ORDER BY s.game_id
LIMIT 50;

-- F) Missing upcoming: today ET slate games with no published upcoming
WITH bounds AS (
  SELECT (NOW() AT TIME ZONE 'America/New_York')::date AS slate_et
),
slate_games AS (
  SELECT g.game_id
  FROM nba_games g, bounds b
  WHERE (g.game_date AT TIME ZONE 'America/New_York')::date = b.slate_et
    AND g.home_team_tricode IS NOT NULL
    AND g.away_team_tricode IS NOT NULL
)
SELECT s.game_id
FROM slate_games s
WHERE NOT EXISTS (
  SELECT 1
  FROM feed_posts p
  WHERE p.post_type = 'upcoming'
    AND p.status = 'published'
    AND p.game_id = s.game_id
)
ORDER BY s.game_id
LIMIT 50;

-- G) pg_cron health for feed-chain jobs (if extension enabled)
SELECT
  j.jobname,
  d.status,
  d.start_time,
  d.end_time,
  LEFT(d.return_message, 200) AS return_message_head
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname LIKE 'feed-chain-%'
ORDER BY d.start_time DESC
LIMIT 50;
