-- Draft drawer: mock game progress module
INSERT INTO draft_module_visibility (module_name, is_visible, display_order) VALUES
  ('mock_progress', true, 2)
ON CONFLICT (module_name) DO NOTHING;

-- Shift my_board_summary after mock_progress if needed (optional manual tweak in admin UI)
