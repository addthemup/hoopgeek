import { Box, Typography } from '@mui/joy';
import { useMediaQuery } from '@mui/material';
import { useMarginBars } from '../contexts/MarginBarsContext';

export default function MarginBarsTabs() {
  const isDesktop = useMediaQuery('(min-width: 1500px)');
  const { activeView, setActiveView } = useMarginBars();

  if (!isDesktop) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 0,
        top: '63px', // Below nav bar
        width: '50px',
        height: 'auto',
        zIndex: 10000, // Above everything
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 0,
        pt: 1,
        pointerEvents: 'none', // Allow clicks to pass through container
      }}
    >
      {/* Standings Tab - Top, hanging off right edge */}
      <Box
        onClick={() => setActiveView('standings')}
        sx={{
          position: 'relative',
          width: '36px',
          height: '70px',
          bgcolor: activeView === 'standings' 
            ? 'rgba(255, 215, 0, 0.2)' 
            : 'rgba(255, 255, 255, 0.08)',
          border: `2px solid ${activeView === 'standings' ? '#FFD700' : 'rgba(255, 255, 255, 0.3)'}`,
          borderLeft: 'none',
          borderRight: `3px solid ${activeView === 'standings' ? '#FFD700' : 'rgba(255, 255, 255, 0.3)'}`,
          borderRadius: '0 10px 10px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          transform: activeView === 'standings' ? 'translateX(-3px)' : 'translateX(0)',
          zIndex: activeView === 'standings' ? 3 : 2,
          boxShadow: activeView === 'standings' 
            ? '-3px 0 12px rgba(255, 215, 0, 0.4), inset -2px 0 4px rgba(255, 215, 0, 0.1)' 
            : '-2px 0 6px rgba(0, 0, 0, 0.4), inset -1px 0 2px rgba(0, 0, 0, 0.2)',
          pointerEvents: 'auto', // Enable clicks on tab
          '&:hover': {
            bgcolor: activeView === 'standings' 
              ? 'rgba(255, 215, 0, 0.25)' 
              : 'rgba(255, 255, 255, 0.12)',
            transform: 'translateX(-3px)',
            borderColor: '#FFD700',
            boxShadow: '-3px 0 12px rgba(255, 215, 0, 0.5)',
          },
        }}
      >
        <Typography
          sx={{
            fontSize: '0.6rem',
            fontWeight: 800,
            color: activeView === 'standings' ? '#FFD700' : 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            textShadow: activeView === 'standings' 
              ? '0 0 8px rgba(255, 215, 0, 0.5)' 
              : 'none',
          }}
        >
          STAND
        </Typography>
      </Box>

      {/* Leaders Tab - Staggered lower, extends further out */}
      <Box
        onClick={() => setActiveView('leaders')}
        sx={{
          position: 'relative',
          width: '36px',
          height: '70px',
          mt: '8px', // Staggered - positioned lower
          mr: '6px', // Staggered - extends further to the right
          bgcolor: activeView === 'leaders' 
            ? 'rgba(255, 215, 0, 0.2)' 
            : 'rgba(255, 255, 255, 0.08)',
          border: `2px solid ${activeView === 'leaders' ? '#FFD700' : 'rgba(255, 255, 255, 0.3)'}`,
          borderLeft: 'none',
          borderRight: `3px solid ${activeView === 'leaders' ? '#FFD700' : 'rgba(255, 255, 255, 0.3)'}`,
          borderRadius: '0 10px 10px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          transform: activeView === 'leaders' ? 'translateX(-3px)' : 'translateX(0)',
          zIndex: activeView === 'leaders' ? 3 : 2,
          boxShadow: activeView === 'leaders' 
            ? '-3px 0 12px rgba(255, 215, 0, 0.4), inset -2px 0 4px rgba(255, 215, 0, 0.1)' 
            : '-2px 0 6px rgba(0, 0, 0, 0.4), inset -1px 0 2px rgba(0, 0, 0, 0.2)',
          pointerEvents: 'auto', // Enable clicks on tab
          '&:hover': {
            bgcolor: activeView === 'leaders' 
              ? 'rgba(255, 215, 0, 0.25)' 
              : 'rgba(255, 255, 255, 0.12)',
            transform: 'translateX(-3px)',
            borderColor: '#FFD700',
            boxShadow: '-3px 0 12px rgba(255, 215, 0, 0.5)',
          },
        }}
      >
        <Typography
          sx={{
            fontSize: '0.6rem',
            fontWeight: 800,
            color: activeView === 'leaders' ? '#FFD700' : 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            textShadow: activeView === 'leaders' 
              ? '0 0 8px rgba(255, 215, 0, 0.5)' 
              : 'none',
          }}
        >
          LEAD
        </Typography>
      </Box>

      {/* Players of the Night Tab - Staggered even lower, extends furthest out */}
      <Box
        onClick={() => setActiveView('players-of-the-night')}
        sx={{
          position: 'relative',
          width: '36px',
          height: '70px',
          mt: '8px', // Staggered - positioned even lower
          mr: '12px', // Staggered - extends furthest to the right
          bgcolor: activeView === 'players-of-the-night' 
            ? 'rgba(255, 215, 0, 0.2)' 
            : 'rgba(255, 255, 255, 0.08)',
          border: `2px solid ${activeView === 'players-of-the-night' ? '#FFD700' : 'rgba(255, 255, 255, 0.3)'}`,
          borderLeft: 'none',
          borderRight: `3px solid ${activeView === 'players-of-the-night' ? '#FFD700' : 'rgba(255, 255, 255, 0.3)'}`,
          borderRadius: '0 10px 10px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          transform: activeView === 'players-of-the-night' ? 'translateX(-3px)' : 'translateX(0)',
          zIndex: activeView === 'players-of-the-night' ? 4 : 1,
          boxShadow: activeView === 'players-of-the-night' 
            ? '-3px 0 12px rgba(255, 215, 0, 0.4), inset -2px 0 4px rgba(255, 215, 0, 0.1)' 
            : '-2px 0 6px rgba(0, 0, 0, 0.4), inset -1px 0 2px rgba(0, 0, 0, 0.2)',
          pointerEvents: 'auto', // Enable clicks on tab
          '&:hover': {
            bgcolor: activeView === 'players-of-the-night' 
              ? 'rgba(255, 215, 0, 0.25)' 
              : 'rgba(255, 255, 255, 0.12)',
            transform: 'translateX(-3px)',
            borderColor: '#FFD700',
            boxShadow: '-3px 0 12px rgba(255, 215, 0, 0.5)',
          },
        }}
      >
        <Typography
          sx={{
            fontSize: '0.6rem',
            fontWeight: 800,
            color: activeView === 'players-of-the-night' ? '#FFD700' : 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            textShadow: activeView === 'players-of-the-night' 
              ? '0 0 8px rgba(255, 215, 0, 0.5)' 
              : 'none',
          }}
        >
          🔥
        </Typography>
      </Box>
    </Box>
  );
}

