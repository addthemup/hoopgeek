-- Create player_favorites table
CREATE TABLE IF NOT EXISTS public.player_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.nba_players(id) ON DELETE CASCADE,
    notes TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, player_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_favorites_user_id ON public.player_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_player_favorites_player_id ON public.player_favorites(player_id);
CREATE INDEX IF NOT EXISTS idx_player_favorites_added_at ON public.player_favorites(added_at DESC);

-- Enable RLS
ALTER TABLE public.player_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
    ON public.player_favorites
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert their own favorites"
    ON public.player_favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own favorites
CREATE POLICY "Users can update their own favorites"
    ON public.player_favorites
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete their own favorites"
    ON public.player_favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.player_favorites IS 'Stores user favorite NBA players';

