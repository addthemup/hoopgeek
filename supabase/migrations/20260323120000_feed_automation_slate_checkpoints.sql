-- Slate-level automation flags (team_of_night, team_of_week, draft, POW/POM posts).
-- Keys align with feed_posts.source_ref for those post types. Per-game automation continues to use feed_automation_checkpoints.

CREATE TABLE feed_automation_slate_checkpoints (
  checkpoint_key text NOT NULL PRIMARY KEY,
  batch_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_automation_slate_checkpoints_batch_done
  ON feed_automation_slate_checkpoints (batch_done)
  WHERE batch_done = true;

COMMENT ON TABLE feed_automation_slate_checkpoints IS
  'Non-game feed automation: checkpoint_key matches feed_posts.source_ref (e.g. team_of_night:2026-03-21, draft:2025-26:2026-03-22).';

COMMENT ON COLUMN feed_automation_slate_checkpoints.checkpoint_key IS 'Stable id — typically same as feed_posts.source_ref for that automation.';
COMMENT ON COLUMN feed_automation_slate_checkpoints.batch_done IS 'True after Edge Function successfully published the post for this key.';

CREATE TRIGGER trg_feed_automation_slate_checkpoints_updated_at
  BEFORE UPDATE ON feed_automation_slate_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_feed_updated_at();

ALTER TABLE feed_automation_slate_checkpoints ENABLE ROW LEVEL SECURITY;
