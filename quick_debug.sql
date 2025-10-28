-- Quick check: What does the actual data look like?
SELECT 
  id,
  game_id,
  content_type,
  source_type,
  jsonb_pretty(video_script) as slides_data
FROM feed_content
WHERE source_type = 'post'
LIMIT 1;

