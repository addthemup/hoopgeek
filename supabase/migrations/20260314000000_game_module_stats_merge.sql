-- Merge basic_stats and advanced_stats into a single "stats" module (with Basic/Advanced tabs in UI).
-- Removes basic_stats and advanced_stats, adds stats, reorders display_order.

DELETE FROM game_module_visibility WHERE module_name IN ('basic_stats', 'advanced_stats');

INSERT INTO game_module_visibility (module_name, is_visible, display_order) VALUES
  ('stats', true, 0)
ON CONFLICT (module_name) DO UPDATE SET is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;

UPDATE game_module_visibility SET display_order = 1 WHERE module_name = 'team_comparison';
UPDATE game_module_visibility SET display_order = 2 WHERE module_name = 'props';
UPDATE game_module_visibility SET display_order = 3 WHERE module_name = 'hit_rates';

COMMENT ON TABLE game_module_visibility IS 'Which modules show in the game page drawer and their order. stats = Basic + Advanced tabs.';
