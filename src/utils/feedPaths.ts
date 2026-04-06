/**
 * Path helpers for /feed routes. Prop prediction *posts* use slugs prefixed with
 * `prop-predictions-…`; only the hub is exactly `/feed/prop-predictions`.
 */
export function isFeedPropPredictionsHubPath(pathname: string): boolean {
  return pathname === '/feed/prop-predictions' || pathname === '/feed/prop-predictions/'
}

/** Single-segment story URL: /feed/:slug (not /feed or the prop-predictions hub). */
export function isFeedStorySlugPath(pathname: string): boolean {
  return (
    /^\/feed\/[^/]+$/.test(pathname) &&
    pathname !== '/feed' &&
    pathname !== '/feed/' &&
    !isFeedPropPredictionsHubPath(pathname)
  )
}
