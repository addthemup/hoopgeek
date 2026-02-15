import { Outlet, useLocation } from 'react-router-dom'
import { Box } from '@mui/joy'
import { useMediaQuery } from '@mui/material'
import { useEffect } from 'react'
import TopNavigation from './TopNavigation'
import MarginBarsWrapper from './MarginBarsWrapper'
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
      {/* Outer wrapper: fixed viewport height + scroll. Scroll works whether cursor is over nav or page content. */}
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
      }}>
        <TopNavigation />
        {!shouldHideAvatarBar && !isMobile && !isLandscapeMobile && <PersistentAvatarBar />}
        <MarginBarsWrapper />
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
