-- Replace single prop_predictions drawer/profile module with four: Over, Under, Team confidence, Player confidence.
-- Idempotent: bump + insert only runs if prop_predictions_over is missing.

-- ─── Feed drawer ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feed_module_visibility WHERE module_name = 'prop_predictions_over') THEN
    UPDATE feed_module_visibility
    SET is_visible = false, display_order = 999
    WHERE module_name = 'prop_predictions';

    UPDATE feed_module_visibility
    SET display_order = display_order + 4
    WHERE display_order >= 2
      AND module_name NOT IN (
        'prop_predictions',
        'prop_predictions_over',
        'prop_predictions_under',
        'prop_predictions_team_confidence',
        'prop_predictions_player_confidence'
      );

    INSERT INTO feed_module_visibility (module_name, is_visible, display_order, grid_size, grid_size_mobile) VALUES
      ('prop_predictions_over', true, 2, 6, 12),
      ('prop_predictions_under', true, 3, 6, 12),
      ('prop_predictions_team_confidence', true, 4, 6, 12),
      ('prop_predictions_player_confidence', true, 5, 6, 12);
  ELSE
    UPDATE feed_module_visibility
    SET is_visible = false, display_order = 999
    WHERE module_name = 'prop_predictions';
  END IF;
END $$;

-- ─── Profile hub ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profile_module_visibility WHERE module_name = 'prop_predictions_over') THEN
    UPDATE profile_module_visibility
    SET is_visible = false, display_order = 999
    WHERE module_name = 'prop_predictions';

    UPDATE profile_module_visibility
    SET display_order = display_order + 4
    WHERE display_order >= 4
      AND module_name NOT IN (
        'prop_predictions',
        'prop_predictions_over',
        'prop_predictions_under',
        'prop_predictions_team_confidence',
        'prop_predictions_player_confidence'
      );

    INSERT INTO profile_module_visibility (module_name, is_visible, display_order, grid_size, grid_size_mobile) VALUES
      ('prop_predictions_over', true, 3, 12, 12),
      ('prop_predictions_under', true, 4, 12, 12),
      ('prop_predictions_team_confidence', true, 5, 12, 12),
      ('prop_predictions_player_confidence', true, 6, 12, 12);
  ELSE
    UPDATE profile_module_visibility
    SET is_visible = false, display_order = 999
    WHERE module_name = 'prop_predictions';
  END IF;
END $$;
