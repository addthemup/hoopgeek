import { Box } from '@mui/joy';
import { useMediaQuery } from '@mui/material';

/**
 * Persistent Avatar Bar Skeleton
 * Always visible across all pages. Page-specific avatar bars (GamesAvatarBar, DFSPoolsAvatarBar, etc.)
 * will render on top of this skeleton when they mount (z-index 1200 vs 1199).
 * When navigating away from pages with avatar bars, this skeleton remains visible.
 */
export default function PersistentAvatarBar() {
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileHeight = useMediaQuery('(max-height: 600px)');
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscapeMobile = isLandscape && isMobileHeight;

  // Don't render on mobile or mobile landscape
  if (isMobile || isLandscapeMobile) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: isLandscapeMobile ? '0px' : { xs: '49px', md: 'calc((100vh - 40px) / 16)' },
        left: 0,
        right: 0,
        zIndex: 1199, // Just below page avatar bars (1200) so they render on top when present
        borderBottom: { xs: '3px solid', md: 'none' },
        borderColor: 'divider',
        pt: 0,
        pb: { xs: 1, md: 1 },
        bgcolor: 'background.body',
        boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
        overflowY: 'hidden',
        margin: 0,
        ...(isLandscapeMobile && {
          maxWidth: '66.67%',
          minWidth: '66.67%',
          mx: 'auto',
          marginTop: 0,
        }),
      }}
    >
      <Box
        sx={{
          maxWidth: isLandscapeMobile
            ? '100%'
            : { xs: '100%', sm: 805, md: 1035 },
          minWidth: isLandscapeMobile
            ? '100%'
            : { xs: '100%', sm: 805, md: 1035 },
          mx: isLandscapeMobile
            ? 0
            : { xs: 'auto', sm: 'auto', md: 'calc(325px + (100% - 650px - 1035px) / 2)' },
          px: isLandscapeMobile ? 1 : { xs: 2, md: 2 },
          overflowY: 'hidden',
          margin: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            overflowY: 'hidden',
            pb: 0,
            position: 'relative',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        >
          {/* Always show 1 skeleton circle with persistent border (first one auto-loads) */}
          {[...Array(1)].map((_, index) => (
            <Box
              key={`persistent-skeleton-${index}`}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 'fit-content',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  width: { xs: 77, md: 83 },
                  height: { xs: 77, md: 83 },
                  border: '3px dashed',
                  borderColor: 'text.primary',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  bgcolor: '#000000',
                  position: 'relative',
                }}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

