/**
 * Sort highlight clips in chronological order (game time).
 * Use when building video_carousel content so slides appear in order of when they happened.
 */

import type { HighlightClip } from '../types/feed'

/**
 * Parse clock string to seconds remaining in the period (12:00 = 720, 0:00 = 0).
 * Supports "MM:SS" and NBA "PTxMyS" format.
 */
function clockToSecondsRemaining(clock: string | undefined): number {
  if (!clock || typeof clock !== 'string') return 0
  // NBA format: PT11M30.00S
  const nbaMatch = clock.match(/PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i)
  if (nbaMatch) {
    const minutes = nbaMatch[1] ? parseInt(nbaMatch[1], 10) : 0
    const seconds = nbaMatch[2] ? Math.floor(parseFloat(nbaMatch[2])) : 0
    return minutes * 60 + seconds
  }
  // Display format: 11:30 or 1:05
  const displayMatch = clock.trim().match(/^(\d+):(\d{2})$/)
  if (displayMatch) {
    const minutes = parseInt(displayMatch[1], 10)
    const seconds = parseInt(displayMatch[2], 10)
    return minutes * 60 + seconds
  }
  return 0
}

/**
 * Sort clips by game time: period ascending, then within period by clock descending
 * (earlier in period = higher clock = first in order).
 */
export function sortHighlightClipsChronological(clips: HighlightClip[]): HighlightClip[] {
  if (!clips?.length) return clips
  return [...clips].sort((a, b) => {
    const periodA = a.period ?? 0
    const periodB = b.period ?? 0
    if (periodA !== periodB) return periodA - periodB
    const secA = clockToSecondsRemaining(a.clock)
    const secB = clockToSecondsRemaining(b.clock)
    return secB - secA // descending: earlier in period (higher sec) first
  })
}
