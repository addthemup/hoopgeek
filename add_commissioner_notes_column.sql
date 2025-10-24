-- Add commissioner_notes column to fantasy_leagues table
-- This allows commissioners to leave notes for all league members

ALTER TABLE fantasy_leagues
ADD COLUMN IF NOT EXISTS commissioner_notes TEXT;

COMMENT ON COLUMN fantasy_leagues.commissioner_notes IS 'Notes from the commissioner visible to all league members';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fantasy_leagues' 
AND column_name = 'commissioner_notes';

