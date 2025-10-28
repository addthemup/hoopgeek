-- Update the sync function to include player_ids and team_tricodes
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION sync_post_to_feed_content()
RETURNS TRIGGER AS $$
DECLARE
  enriched_metadata JSONB;
BEGIN
  -- Only sync if status is 'published'
  IF NEW.status = 'published' THEN
    -- Enrich metadata with player_ids and team_tricodes
    enriched_metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'player_ids', NEW.player_ids,
      'team_tricodes', NEW.team_tricodes
    );
    
    -- Create or update feed_content entry
    INSERT INTO feed_content (
      source_type,
      source_id,
      content_type,
      game_id,
      game_date,
      story_data,
      fun_data,
      fun_score,
      video_script,
      total_plays,
      metadata,
      likes_count,
      comments_count,
      shares_count,
      views_count,
      feed_score
    ) VALUES (
      'post',
      NEW.id,
      NEW.post_type::TEXT,
      NEW.game_id,
      NEW.game_date,
      NEW.metadata->'story_data',
      NEW.metadata->'fun_data',
      (NEW.metadata->>'fun_score')::NUMERIC,
      NEW.slides,
      jsonb_array_length(NEW.slides),
      enriched_metadata, -- Include player_ids and team_tricodes
      NEW.likes_count,
      NEW.comments_count,
      NEW.shares_count,
      NEW.views_count,
      COALESCE(NEW.boost_score, 5.0)
    )
    ON CONFLICT (source_id) DO UPDATE
    SET
      content_type = EXCLUDED.content_type,
      game_id = EXCLUDED.game_id,
      game_date = EXCLUDED.game_date,
      story_data = EXCLUDED.story_data,
      fun_data = EXCLUDED.fun_data,
      fun_score = EXCLUDED.fun_score,
      video_script = EXCLUDED.video_script,
      total_plays = EXCLUDED.total_plays,
      metadata = EXCLUDED.metadata,
      likes_count = EXCLUDED.likes_count,
      comments_count = EXCLUDED.comments_count,
      shares_count = EXCLUDED.shares_count,
      views_count = EXCLUDED.views_count,
      feed_score = EXCLUDED.feed_score,
      updated_at = now();
  ELSIF OLD.status = 'published' AND NEW.status != 'published' THEN
    -- Remove from feed_content if unpublished
    DELETE FROM feed_content WHERE source_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'sync_post_to_feed_content';

