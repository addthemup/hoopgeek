-- Ensure live_player_stats.id has a default so the Cloudflare worker can INSERT
-- without sending id (worker only sends game_id, nba_player_id, player_name, etc.).
-- Without this, inserts from the worker fail with null value in column "id".
ALTER TABLE live_player_stats
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
