-- Migration: Create game-data storage bucket for JSON game files
-- This bucket stores scraped game JSON files temporarily before processing

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-data', 'game-data', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for the bucket
-- Allow service role to read/write (for edge functions)
CREATE POLICY IF NOT EXISTS "Service role can read game-data"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'game-data');

CREATE POLICY IF NOT EXISTS "Service role can write game-data"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'game-data');

CREATE POLICY IF NOT EXISTS "Service role can delete game-data"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'game-data');

