-- Settings for the feed game drawer: when viewing a game from feed (/feed?game=), the drawer shows
-- filters + games carousel + game UI. These flags let admin hide the filters and/or games carousel
-- in that drawer.

CREATE TABLE IF NOT EXISTS game_drawer_feed_settings (
  id text PRIMARY KEY DEFAULT 'default',
  show_filters boolean NOT NULL DEFAULT true,
  show_games_carousel boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO game_drawer_feed_settings (id, show_filters, show_games_carousel)
VALUES ('default', true, true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE game_drawer_feed_settings IS 'When viewing a game from feed, drawer shows filters + carousel + game UI. These control visibility of filters and games carousel in that drawer.';
