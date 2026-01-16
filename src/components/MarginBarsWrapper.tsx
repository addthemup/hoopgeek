import { useLocation, useParams } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import MarginBars from './MarginBars';

/**
 * Wrapper component that always renders MarginBars on desktop
 * Determines what content to show based on current route
 */
export default function MarginBarsWrapper() {
  const location = useLocation();
  const params = useParams();
  const isDesktop = useMediaQuery('(min-width: 1500px)');

  if (!isDesktop) {
    return null;
  }

  // Determine route type
  const isHomeRoute = location.pathname === '/';
  const isTodayRoute = location.pathname === '/today' || location.pathname.startsWith('/dfs');
  const isFantasyRoute = location.pathname === '/fantasy' || location.pathname === '/dashboard';
  const isPlayerRoute = location.pathname.startsWith('/player/');
  const isTeamRoute = location.pathname.startsWith('/team/');

  // Hide margin bars on today, dfs, and fantasy routes
  if (isTodayRoute || isFantasyRoute) {
    return null;
  }

  // For home route, show conference standings
  if (isHomeRoute) {
    return (
      <>
        <MarginBars conference="West" position="left" />
        <MarginBars conference="East" position="right" />
      </>
    );
  }

  // For player route, show team roster on left, props/stats on right
  if (isPlayerRoute) {
    return (
      <>
        <MarginBars conference="West" position="left" />
        <MarginBars conference="East" position="right" />
      </>
    );
  }

  // For team route, show team roster on left, standings/stats on right
  if (isTeamRoute) {
    return (
      <>
        <MarginBars conference="West" position="left" />
        <MarginBars conference="East" position="right" />
      </>
    );
  }

  // Default: show conference standings for any other route
  return (
    <>
      <MarginBars conference="West" position="left" />
      <MarginBars conference="East" position="right" />
    </>
  );
}

