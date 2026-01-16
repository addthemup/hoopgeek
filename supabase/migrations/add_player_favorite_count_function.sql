-- Function to get the total count of users who favorited a player
-- This function bypasses RLS using SECURITY DEFINER to return public aggregate data
CREATE OR REPLACE FUNCTION public.get_player_favorite_count(p_player_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.player_favorites
  WHERE player_id = p_player_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.get_player_favorite_count IS 'Returns the total count of users who favorited a player. Public function that bypasses RLS.';



