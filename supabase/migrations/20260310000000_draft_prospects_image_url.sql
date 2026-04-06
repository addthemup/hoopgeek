-- Add player image URL to draft prospects (e.g. ESPN, European team headshot).
ALTER TABLE draft_prospects
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN draft_prospects.image_url IS 'URL to player headshot, e.g. from ESPN or current team.';
