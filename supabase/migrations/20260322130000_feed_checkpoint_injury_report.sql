ALTER TABLE feed_automation_checkpoints
  ADD COLUMN IF NOT EXISTS injury_report_batch_done boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN feed_automation_checkpoints.injury_report_batch_done IS
  'True after automated injury_report post was published for this game.';
