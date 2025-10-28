-- Debug: Check the structure of your feed post data

-- 1. View the raw feed_posts data
SELECT 
  id,
  title,
  post_type,
  game_id,
  jsonb_array_length(slides) as slide_count,
  slides->0 as first_slide,
  metadata
FROM feed_posts
WHERE status = 'published'
LIMIT 1;

-- 2. View the feed_content entry
SELECT 
  id,
  source_type,
  content_type,
  game_id,
  jsonb_array_length(video_script) as video_count,
  video_script->0 as first_video,
  story_data,
  fun_data
FROM feed_content
WHERE source_type = 'post'
LIMIT 1;

-- 3. Check what fields are in the first slide
SELECT 
  jsonb_object_keys(slides->0) as slide_fields
FROM feed_posts
WHERE status = 'published'
LIMIT 1;

