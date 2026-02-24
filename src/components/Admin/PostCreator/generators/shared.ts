/**
 * Shared utilities for section generators.
 *
 * getPlayerHighlightClips: picks the best N mp4 clips for a player
 * from play-by-play data, scored by excitement (dunks > 3pts > blocks > etc).
 */

import type { PlayByPlayAction, GameData } from '../types'

export function getPlayerHighlightClips(
  playerId: number,
  allGameData: GameData[],
  maxClips = 3
): PlayByPlayAction[] {
  const allPlays: PlayByPlayAction[] = []
  for (const gd of allGameData) {
    for (const play of gd.playByPlay) {
      if (play.personId === playerId && play.mp4) {
        allPlays.push(play)
      }
    }
  }
  if (allPlays.length === 0) return []

  const scorePlay = (p: PlayByPlayAction): number => {
    let score = 0
    const action = (p.actionType || '').toLowerCase()
    const sub = (p.subType || '').toLowerCase()
    const desc = (p.description || '').toLowerCase()
    if (action === 'block') score += 8
    if (action === 'steal') score += 7
    if (sub === 'dunk' || desc.includes('dunk')) score += 10
    if (sub === 'alley oop' || desc.includes('alley oop')) score += 9
    if (action === '3pt' || sub === '3pt' || desc.includes('3pt')) score += 6
    if (p.shotResult === 'Made') score += 4
    if (p.isFieldGoal) score += 2
    if (p.period >= 4) score += 3
    return score
  }

  return allPlays
    .sort((a, b) => scorePlay(b) - scorePlay(a))
    .slice(0, maxClips)
}
