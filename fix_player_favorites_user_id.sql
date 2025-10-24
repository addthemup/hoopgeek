-- Add default for user_id to automatically use auth.uid()
ALTER TABLE public.player_favorites 
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Verify the change
\d player_favorites;

