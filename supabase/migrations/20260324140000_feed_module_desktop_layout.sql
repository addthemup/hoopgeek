-- Per-module desktop drawer tile shape (2×2 carousel slides on /feed/).

ALTER TABLE feed_module_visibility
  ADD COLUMN IF NOT EXISTS desktop_layout text NOT NULL DEFAULT 'cell';

COMMENT ON COLUMN feed_module_visibility.desktop_layout IS
  'Desktop inset drawer: cell = 1 quadrant; tall = one column full height; wide = one row full width; full = entire slide.';

-- Sensible default for standings (tall column); others keep cell from default.
UPDATE feed_module_visibility SET desktop_layout = 'tall' WHERE module_name = 'standings';
