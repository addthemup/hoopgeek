/**
 * Maps feed inset drawer modules to the four tabs (Home, Props, DFS, Draft).
 * Main feed stories are always on /feed/ — `feed_posts` is not a drawer module.
 */

export type FeedDrawerTabId = 'home' | 'props' | 'dfs' | 'draft';

/** Games carousel, standings, leaders, injuries, best games, favorite players */
export const FEED_DRAWER_HOME_MODULE_NAMES = new Set([
  'games_carousel',
  'leaders',
  'standings',
  'injuries',
  'best_games',
  'favorite_players',
]);

/** Prop predictions (split), slip builder, prop performance */
export const FEED_DRAWER_PROPS_MODULE_NAMES = new Set([
  'prop_predictions_over',
  'prop_predictions_under',
  'prop_predictions_team_confidence',
  'prop_predictions_player_confidence',
  'slip_builder',
  'prop_performance',
]);

/** Team of Night/Week combined (live + past TOTN + TOTW) + DFS pools */
export const FEED_DRAWER_DFS_MODULE_NAMES = new Set(['totn_totw', 'dfs_pools']);

export const FEED_DRAWER_DRAFT_MODULE_NAMES = new Set(['draft']);

export const FEED_DRAWER_MODULES_BY_TAB: Record<FeedDrawerTabId, Set<string>> = {
  home: FEED_DRAWER_HOME_MODULE_NAMES,
  props: FEED_DRAWER_PROPS_MODULE_NAMES,
  dfs: FEED_DRAWER_DFS_MODULE_NAMES,
  draft: FEED_DRAWER_DRAFT_MODULE_NAMES,
};

export function filterModulesForFeedDrawerTab<T extends { name: string }>(
  modules: T[],
  tab: FeedDrawerTabId
): T[] {
  const allowed = FEED_DRAWER_MODULES_BY_TAB[tab];
  return modules.filter((m) => allowed.has(m.name));
}

export function countVisibleModulesPerFeedDrawerTab(
  visibleModuleNames: Set<string>
): Record<FeedDrawerTabId, number> {
  const count = (set: Set<string>) => [...set].filter((n) => visibleModuleNames.has(n)).length;
  return {
    home: count(FEED_DRAWER_HOME_MODULE_NAMES),
    props: count(FEED_DRAWER_PROPS_MODULE_NAMES),
    dfs: count(FEED_DRAWER_DFS_MODULE_NAMES),
    draft: count(FEED_DRAWER_DRAFT_MODULE_NAMES),
  };
}
