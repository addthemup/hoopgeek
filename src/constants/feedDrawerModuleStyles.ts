/**
 * Compact table styling for /feed drawer modules — aligned with Leaders + Injuries
 * (dense rows, smaller header/body padding, readable small type).
 */
export const FEED_DRAWER_TABLE_SX = {
  bgcolor: '#1a1a1a',
  '& thead th': {
    py: 0.75,
    px: 0.75,
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '0.75rem',
    lineHeight: 1.2,
    textAlign: 'left' as const,
    verticalAlign: 'middle',
    bgcolor: '#1a1a1a',
  },
  '& tbody td': {
    py: 0.75,
    px: 0.75,
    fontSize: '0.8125rem',
    lineHeight: 1.25,
    bgcolor: '#1a1a1a',
    verticalAlign: 'middle',
  },
  '& tbody tr:hover td': { bgcolor: 'rgba(255,255,255,0.06)' },
} as const;

/** Player headshot in dense prop / performance tables */
export const FEED_DRAWER_AVATAR_PLAYER = { width: 32, height: 32 } as const;

/** Slightly larger avatar for favorite players row */
export const FEED_DRAWER_AVATAR_FAVORITE = { width: 40, height: 40 } as const;
