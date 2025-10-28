-- Check if feed posts were created
SELECT 
  id,
  status,
  title,
  post_type,
  game_id,
  published_at,
  created_at
FROM feed_posts
ORDER BY created_at DESC
LIMIT 5;

-- Check if feed_content was synced
SELECT 
  id,
  source_type,
  source_id,
  content_type,
  game_id,
  game_date,
  feed_score,
  created_at
FROM feed_content
ORDER BY created_at DESC
LIMIT 5;

-- Check if the trigger and function exist
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'sync_feed_content_on_publish';

-- Manually sync any published posts that might be missing from feed_content
-- This will catch any posts that were created before the trigger was set up
DO $$
DECLARE
  post_record RECORD;
BEGIN
  FOR post_record IN 
    SELECT * FROM feed_posts 
    WHERE status = 'published' 
    AND NOT EXISTS (
      SELECT 1 FROM feed_content 
      WHERE source_id = feed_posts.id
    )
  LOOP
    -- Call the sync function for each published post missing from feed_content
    PERFORM sync_feed_content_from_post(post_record);
  END LOOP;
END $$;

-- Verify feed_content was populated
SELECT 
  COUNT(*) as total_content,
  source_type,
  content_type
FROM feed_content
GROUP BY source_type, content_type;

