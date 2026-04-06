-- Per-game flag: automated prop_prediction post created successfully (non-empty snapshot).

ALTER TABLE feed_automation_checkpoints
  ADD COLUMN IF NOT EXISTS prop_prediction_batch_done boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN feed_automation_checkpoints.prop_prediction_batch_done IS
  'True after automated prop prediction post was published for this game (feed_posts prop_prediction + prop_snapshot).';
