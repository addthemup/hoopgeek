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
      <Box sx={{ 
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0,
      }}>
        <TopNavigation />
        {/* Persistent Avatar Bar Skeleton - Hidden on player page, settings, admin routes, mobile, and mobile landscape */}
        {!shouldHideAvatarBar && !isMobile && !isLandscapeMobile && <PersistentAvatarBar />}
        {/* MarginBars - Always rendered on desktop for all routes */}
        <MarginBarsWrapper />
        <Box component="main" sx={{ 
          flex: 1,
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          marginTop: isLandscapeMobile ? '0px' : '0px', // No margin when nav bar is hidden in landscape mobile
          paddingBottom: { xs: '80px', md: 0 }, // Add bottom padding on mobile for bottom nav
        }}>
          <Outlet key={location.key || location.pathname} />
        </Box>
      </Box>
    </UserSettingsProvider>
  )
}
