-- Add OG Image Generation to Feed Post Creation
-- This trigger/function generates OG images when posts are published

-- Create a function to call the Python script for OG image generation
-- Note: This requires setting up a webhook or using Supabase Edge Functions
-- For now, we'll create a function that can be called from the application

-- Create a function that marks posts needing OG image generation
CREATE OR REPLACE FUNCTION queue_og_image_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate OG images for published posts with sufficient data
  IF NEW.status = 'published' AND (
    (NEW.team_tricodes IS NOT NULL AND array_length(NEW.team_tricodes, 1) >= 2) OR
    (NEW.player_ids IS NOT NULL AND array_length(NEW.player_ids, 1) > 0)
  ) THEN
    -- The actual generation will be handled by the application
    -- or a Supabase Edge Function that watches for this
    -- For now, we just ensure share_image_url is set if thumbnail exists
    IF NEW.share_image_url IS NULL AND NEW.thumbnail_url IS NOT NULL THEN
      NEW.share_image_url := NEW.thumbnail_url;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to queue OG image generation
DROP TRIGGER IF EXISTS trigger_queue_og_image ON feed_posts;
CREATE TRIGGER trigger_queue_og_image
  BEFORE INSERT OR UPDATE ON feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION queue_og_image_generation();

-- Function to update share_image_url after OG image is generated
CREATE OR REPLACE FUNCTION update_post_og_image(
  post_id UUID,
  og_image_url TEXT
)
RETURNS feed_posts AS $$
DECLARE
  updated_post feed_posts;
BEGIN
  UPDATE feed_posts
  SET share_image_url = og_image_url,
      updated_at = now()
  WHERE id = post_id
  RETURNING * INTO updated_post;
  
  RETURN updated_post;
END;
$$ LANGUAGE plpgsql;

