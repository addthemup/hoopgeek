import { Outlet, useLocation } from 'react-router-dom'
import { Box } from '@mui/joy'
import { useMediaQuery } from '@mui/material'
import PersistentAvatarBar from './PersistentAvatarBar'
import { UserSettingsProvider } from '../contexts/UserSettingsContext'

export default function Layout() {
  const location = useLocation()
  // Detect landscape mobile orientation to adjust spacing
  const isMobile = useMediaQuery('(max-width: 900px)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isLandscapeMobile = isMobile && isLandscape
  
  
  // Hide PersistentAvatarBar on all pages except feed (feed uses PostsStories instead)
  // Feed should be the only page with an avatar bar (PostsStories)
  const isPlayerPage = location.pathname.startsWith('/player/')
  const isSettingsPage = location.pathname === '/settings'
  const isLoginPage = location.pathname === '/login'
  const isAdminRoute = location.pathname.startsWith('/admin/')
  const isTodayRoute = location.pathname === '/today'
  const isDFSRoute = location.pathname.startsWith('/dfs')
  const isFantasyRoute = location.pathname === '/fantasy' || location.pathname === '/dashboard'
  const isGameRoute = location.pathname.startsWith('/game/')
  const isFeedRoute = location.pathname === '/feed' || location.pathname === '/feed/'
  // Hide PersistentAvatarBar on all routes - only feed page should have avatar bar (PostsStories)
  const shouldHideAvatarBar = true // Always hide PersistentAvatarBar - feed uses PostsStories instead

  return (
    <UserSettingsProvider>
      {/* Outer wrapper: fixed viewport height + scroll. Frames X–style touch/scroll behavior for better swipe and scroll. */}
      <Box sx={{
        height: '100vh',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0,
        // Native-feel scroll on mobile (momentum, no overscroll bounce-through)
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        touchAction: 'pan-y',
      }}>
        {!shouldHideAvatarBar && !isMobile && !isLandscapeMobile && <PersistentAvatarBar />}
        <Box component="main" sx={{
          flex: '1 1 auto',
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          overflowY: 'visible',
          marginTop: isLandscapeMobile ? '0px' : '0px',
          paddingBottom: { xs: '80px', md: 0 },
        }}>
          <Outlet key={location.key || location.pathname} />
        </Box>
      </Box>
    </UserSettingsProvider>
  )
}
