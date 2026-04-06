-- Main feed stories are always on /feed/; `feed_posts` is not a drawer module (see feedDrawerTabs).
DELETE FROM feed_module_visibility WHERE module_name = 'feed_posts';
