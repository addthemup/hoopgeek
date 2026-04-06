-- Public share links for NBA mock drafts (unguessable token + opt-in is_shared).

ALTER TABLE user_mock_drafts
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

UPDATE user_mock_drafts SET share_token = gen_random_uuid() WHERE share_token IS NULL;

ALTER TABLE user_mock_drafts ALTER COLUMN share_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_mock_drafts_share_token ON user_mock_drafts (share_token);

COMMENT ON COLUMN user_mock_drafts.share_token IS 'Unguessable id for /mock-draft/:token; always set.';
COMMENT ON COLUMN user_mock_drafts.is_shared IS 'When true, anon may read this mock via share_token URL.';

-- Anyone can read shared mocks (OR with existing owner policy)
CREATE POLICY "Anyone can read shared mock drafts"
  ON user_mock_drafts FOR SELECT TO anon, authenticated
  USING (is_shared = true);

CREATE POLICY "Anyone can read picks for shared mock drafts"
  ON user_mock_draft_picks FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_mock_drafts m
      WHERE m.id = user_mock_draft_picks.user_mock_draft_id
        AND m.is_shared = true
    )
  );

CREATE POLICY "Anyone can read scores for shared mock drafts"
  ON mock_draft_scores FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_mock_drafts m
      WHERE m.user_id = mock_draft_scores.user_id
        AND m.draft_year = mock_draft_scores.draft_year
        AND m.is_shared = true
    )
  );
