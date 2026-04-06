/**
 * Persistent feed shell: fixed header + drawer stay mounted when navigating
 * between feed list and post story. Only the content below (Outlet) changes.
 */

import { Outlet, useLocation } from 'react-router-dom'
import { FeedLayoutProvider, useFeedLayout } from '../../contexts/FeedLayoutContext'
import FeedModulesGrid from './FeedModulesGrid'
import { isFeedStorySlugPath } from '../../utils/feedPaths'

function FeedLayoutInner() {
  const location = useLocation()
  const { state } = useFeedLayout()
  const isPostStory = isFeedStorySlugPath(location.pathname)
  const flowContent = isPostStory
  const contentKey = `${location.pathname}${location.search}${location.hash}`

  return (
    <FeedModulesGrid
      filterDrawerContent={state.filterDrawerContent}
      feedTopBar={state.feedTopBar}
      activeFilters={state.activeFilters}
      onAddFilter={state.onAddFilter}
      onRemoveFilter={state.onRemoveFilter}
      onGameClick={state.onGameClick}
      hasGameHeader={state.hasGameHeader ?? false}
      flowContent={flowContent}
    >
      <div key={contentKey}>
        <Outlet />
      </div>
    </FeedModulesGrid>
  )
}

export default function FeedLayout() {
  return (
    <FeedLayoutProvider>
      <FeedLayoutInner />
    </FeedLayoutProvider>
  )
}
