import React from 'react'
import { Outlet } from 'react-router-dom'
import FeedModulesGrid from './Feed/FeedModulesGrid'

/**
 * Global drawer shell for top-level section pages (Props/DFS/Draft).
 * This preserves the "one app, one drawer" feel while letting each section
 * render a full dedicated page.
 */
export default function AppDrawerLayout() {
  return (
    <FeedModulesGrid flowContent>
      <Outlet />
    </FeedModulesGrid>
  )
}

