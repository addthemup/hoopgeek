import { Outlet, useLocation } from 'react-router-dom'
import { Box } from '@/components/ui/box'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import PersistentAvatarBar from './PersistentAvatarBar'
import { UserSettingsProvider } from '../contexts/UserSettingsContext'

export default function Layout() {
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 900px)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isLandscapeMobile = isMobile && isLandscape

  const isPlayerPage = location.pathname.startsWith('/player/')
  const isLoginPage = location.pathname === '/login'
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
  const isDFSRoute = location.pathname.startsWith('/dfs')
  const isFantasyRoute = location.pathname === '/fantasy' || location.pathname === '/dashboard'
  const isGameRoute = location.pathname.startsWith('/game/')
  const isFeedRoute = location.pathname === '/' || location.pathname === '/feed' || location.pathname.startsWith('/feed/')
  const isPostByUuid = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(location.pathname)
  const isFeedLayout = isFeedRoute || isGameRoute || location.pathname.startsWith('/props') || location.pathname.startsWith('/dfs') || location.pathname.startsWith('/draft') || isPostByUuid
  /** Fixed viewport height so inner content can scroll (feed, admin, nested admin routes) */
  const isFixedViewportLayout = isFeedLayout || isAdminRoute
  const shouldHideAvatarBar = true

  return (
    <UserSettingsProvider>
      <Box
        className={`w-full max-w-full flex flex-col m-0 p-0 touch-pan-y ${isFixedViewportLayout ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden overflow-y-auto'}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        }}
      >
        {!shouldHideAvatarBar && !isMobile && !isLandscapeMobile && <PersistentAvatarBar />}
        <Box
          component="main"
          className={`w-full max-w-full overflow-x-hidden pb-20 md:pb-0 ${isFixedViewportLayout ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 overflow-y-visible'}`}
        >
          {isFeedLayout ? (
            <div className="feed-layout">
              {/* Stable outlet: do not key by location — tab switches (/ ↔ /props ↔ /dfs ↔ /draft)
                  must NOT remount FeedLayout/FeedModulesGrid or the drawer closes then re-opens. */}
              <Outlet />
            </div>
          ) : (
            <Outlet key={location.key || location.pathname} />
          )}
        </Box>
      </Box>
    </UserSettingsProvider>
  )
}
