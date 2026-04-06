import { useState, useEffect } from 'react'

/**
 * Match a media query string (e.g. '(max-width: 900px)', '(orientation: landscape)').
 * Use this instead of @mui/material useMediaQuery when migrating to Kibo.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)
    const handler = () => setMatches(media.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [query])

  return matches
}
