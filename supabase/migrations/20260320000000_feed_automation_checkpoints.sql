-- Checkpoint flags for automated feed generation (Edge Functions + service role).
-- One row per NBA game: flip each *_batch_done only after that batch inserts succeed.
-- Clients do not write this table; service role bypasses RLS.

CREATE TABLE feed_automation_checkpoints (
  game_id text NOT NULL PRIMARY KEY
    CHECK (game_id ~ '^\d{10}$'),

  -- Optional: Storage object path in game-data bucket, e.g. 0022501002.json (root) or feed/0022501002.json
  json_storage_path text,

  player_spotlight_batch_done  boolean NOT NULL DEFAULT false,
  prop_results_batch_done      boolean NOT NULL DEFAULT false,
  game_recap_batch_done        boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_automation_checkpoints_storage_path
  ON feed_automation_checkpoints (json_storage_path)
  WHERE json_storage_path IS NOT NULL;

COMMENT ON TABLE feed_automation_checkpoints IS
  'Per-game flags for feed automation: set each *_batch_done true only after successful batch create for that post type. Written by Edge Functions (service role).';

COMMENT ON COLUMN feed_automation_checkpoints.game_id IS 'NBA game id (10 digits), matches feed_posts.game_id and JSON filenames.';
COMMENT ON COLUMN feed_automation_checkpoints.json_storage_path IS 'Object path under game-data bucket when JSON is loaded from Storage.';
COMMENT ON COLUMN feed_automation_checkpoints.player_spotlight_batch_done IS 'True after automated player spotlight batch completed for this game.';
COMMENT ON COLUMN feed_automation_checkpoints.prop_results_batch_done IS 'True after automated prop_results batch completed for this game.';
COMMENT ON COLUMN feed_automation_checkpoints.game_recap_batch_done IS 'True after automated game_recap batch completed for this game.';

-- Reuse feed updated_at trigger (defined in 20260213000000_feed_v2_schema.sql)
CREATE TRIGGER trg_feed_automation_checkpoints_updated_at
  BEFORE UPDATE ON feed_automation_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_feed_updated_at();

ALTER TABLE feed_automation_checkpoints ENABLE ROW LEVEL SECURITY;

-- No policies: anon/authenticated cannot read or write. Service role bypasses RLS.
