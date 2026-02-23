-- Add Draft module to feed drawer (aggregate prospect rankings).
INSERT INTO feed_module_visibility (module_name, is_visible, display_order, grid_size, grid_size_mobile) VALUES
  ('draft', true, 12, 4, 12)
ON CONFLICT (module_name) DO NOTHING;
