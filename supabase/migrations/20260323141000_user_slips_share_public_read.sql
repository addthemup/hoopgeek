-- Shareable bet slips: unguessable token + opt-in public read for /slip/:token

ALTER TABLE user_slips
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

UPDATE user_slips SET share_token = gen_random_uuid() WHERE share_token IS NULL;

ALTER TABLE user_slips ALTER COLUMN share_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_slips_share_token ON user_slips (share_token);

COMMENT ON COLUMN user_slips.share_token IS 'Public share URL uses /slip/:token when is_shared.';
COMMENT ON COLUMN user_slips.is_shared IS 'When true, anon may read slip + legs via share_token.';

CREATE POLICY "Anyone can read shared slips"
  ON user_slips FOR SELECT TO anon, authenticated
  USING (is_shared = true);

CREATE POLICY "Anyone can read legs of shared slips"
  ON slip_legs FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_slips s
      WHERE s.id = slip_legs.slip_id AND s.is_shared = true
    )
  );
