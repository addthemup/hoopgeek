/**
 * Content width must match the top nav so content is never wider than the nav.
 * Nav uses max 1035px, min 805px (sm/md breakpoints).
 */
export const CONTENT_MAX_WIDTH = 1035
export const CONTENT_MIN_WIDTH = 805

/** Breakpoint values matching TopNavigation (805–1035). */
export const CONTENT_WIDTH_BREAKPOINTS = {
  xs: '100%' as const,
  sm: 805,
  md: 1035,
}

export const CONTENT_CONTAINER_SX = {
  maxWidth: CONTENT_MAX_WIDTH,
  mx: 'auto' as const,
  px: { xs: 2, sm: 2, md: 2 },
  width: '100%',
  boxSizing: 'border-box' as const,
}

/**
 * Joy Drawer `slotProps.content.sx` for inset shells (/feed, player, team, etc.).
 * Mobile keeps ~90vw; desktop matches main column width (see CONTENT_MAX_WIDTH) so the panel is not capped by size="md" (30% vw).
 */
export const INSET_DRAWER_CONTENT_SX = {
  bgcolor: 'transparent',
  p: { xs: 0, sm: 0, md: 3 },
  boxShadow: 'none',
  '@media (max-width: 900px)': {
    width: '90vw',
    maxWidth: '90vw',
    '--Drawer-horizontalSize': '90vw',
  },
  '@media (min-width: 901px)': {
    width: `min(${CONTENT_MAX_WIDTH}px, 100vw)`,
    maxWidth: `min(${CONTENT_MAX_WIDTH}px, 100vw)`,
    '--Drawer-horizontalSize': `min(${CONTENT_MAX_WIDTH}px, 100vw)`,
  },
}
