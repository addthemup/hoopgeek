-- Manually sync all existing published posts to feed_content
-- Run this after creating the trigger

DO $$
DECLARE
  post_record RECORD;
BEGIN
  FOR post_record IN 
    SELECT * FROM feed_posts 
    WHERE status = 'published'
  LOOP
    -- Create or update feed_content entry for each published post
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
      post_record.id,
      post_record.post_type::TEXT,
      post_record.game_id,
      post_record.game_date,
      post_record.metadata->'story_data',
      post_record.metadata->'fun_data',
      (post_record.metadata->>'fun_score')::NUMERIC,
      post_record.slides,
      jsonb_array_length(post_record.slides),
      post_record.metadata,
      post_record.likes_count,
      post_record.comments_count,
      post_record.shares_count,
      post_record.views_count,
      COALESCE(post_record.boost_score, 5.0)
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
      
    RAISE NOTICE 'Synced post: %', post_record.title;
  END LOOP;
END $$;

-- Verify the sync worked
SELECT 
  'feed_posts' as table_name,
  COUNT(*) as count
FROM feed_posts
WHERE status = 'published'
UNION ALL
SELECT 
  'feed_content (posts)' as table_name,
  COUNT(*) as count
FROM feed_content
WHERE source_type = 'post';

