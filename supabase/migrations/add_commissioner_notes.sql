-- Migration: Add commissioner_notes field to fantasy_leagues table
-- Date: 2025-10-19
-- Description: Adds a TEXT column to store commissioner notes that are visible to all league members

ALTER TABLE fantasy_leagues 
ADD COLUMN IF NOT EXISTS commissioner_notes TEXT;

-- Update the comment for documentation
COMMENT ON COLUMN fantasy_leagues.commissioner_notes IS 'Commissioner notes visible to all league members';

