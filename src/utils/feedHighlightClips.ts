/**
 * Feed highlight clips utility
 *
 * Sole responsibility: given a post type and game data (from /feed/ JSON),
 * return applicable MP4 highlight clips for that post type. Game recaps
 * use the JSON's `score` and `story` to prioritize which plays to include.
 * Returned clips are always in chronological order (game time).
 */

import type { PostType } from '../types/feed'
import type { HighlightClip } from '../types/feed'
import { sortHighlightClipsChronological } from './sortHighlightClips'

/** Play with mp4 and metadata (matches game JSON playByPlay.allPlays shape) */
export interface PlayWithMp4 {
  mp4: string | null
  description?: string
  actionType?: string
  subType?: string
  period?: number
  clock?: string
  shotResult?: string | null
  isFieldGoal?: number
  pointsTotal?: number
  personId?: number | null
  playerName?: string | null
  teamTricode?: string | null
}

/** Minimal game data needed to pick highlights (from extractGameData / game JSON) */
export interface GameDataForHighlights {
  gameId: string
  scoreData: Record<string, any>  // score[gameId]: team_stats, lead_changes, dunk_stats, deep_shots, scoring_milestones, fun_score
  story: Record<string, any>      // matchup, final_score, advantages[]
  playByPlay: PlayWithMp4[]
}

const DEFAULT_MAX_CLIPS = 12

/** Normalize NBA clock string (e.g. PT11M30.00S) to display form (11:30) */
function formatClock(clock: string | undefined): string {
  if (!clock) return ''
  const match = clock.match(/PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i)
  if (!match) return clock
  const minutes = match[1] ? parseInt(match[1], 10) : 0
  const seconds = match[2] ? Math.floor(parseFloat(match[2])) : 0
  if (minutes === 0 && seconds === 0) return clock
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Score a single play for game-recap narrative relevance using score + story.
 * Higher = better for the recap carousel.
 */
function scorePlayForGameRecap(
  play: PlayWithMp4,
  scoreData: Record<string, any>,
  story: Record<string, any>
): number {
  let score = 0
  const action = (play.actionType || '').toLowerCase()
  const sub = (play.subType || '').toLowerCase()
  const desc = (play.description || '').toLowerCase()

  // Buzzer beaters / end-of-period (story often highlights these)
  const leadChanges = scoreData?.lead_changes || {}
  if (leadChanges.buzzer_beater && play.period >= 4) score += 20
  if (leadChanges.last_minute && play.period >= 4) score += 12
  if (leadChanges.last_5_minutes && play.period >= 4) score += 8

  // Dunks (score.dunk_stats is a focus)
  const dunkStats = scoreData?.dunk_stats || {}
  if ((dunkStats['Total Dunks'] || 0) > 0) {
    if (sub === 'dunk' || desc.includes('dunk')) score += 15
    if (desc.includes('alley oop') || sub === 'alley oop') score += 18
    if (desc.includes('putback')) score += 10
  }

  // Deep shots / 3PT (score.deep_shots)
  const deepShots = scoreData?.deep_shots || {}
  if ((deepShots.deep_threes > 0 || deepShots.four_pointers > 0) && (action === '3pt' || desc.includes('3pt') || desc.includes('3-pt'))) {
    if (play.shotResult === 'Made') score += 14
    else score += 4
  }

  // Blocks / steals (story.advantages often mention defense)
  const advantages = story?.advantages || []
  const hasBlockAdvantage = advantages.some((a: any) => (a.stat_name || '').toLowerCase().includes('block'))
  const hasStealAdvantage = advantages.some((a: any) => (a.stat_name || '').toLowerCase().includes('steal') || (a.stat_name || '').toLowerCase().includes('turnover'))
  if (action === 'block') score += hasBlockAdvantage ? 16 : 12
  if (action === 'steal') score += hasStealAdvantage ? 14 : 10

  // Made field goals
  if (play.shotResult === 'Made' && play.isFieldGoal) {
    score += 6
    if (play.pointsTotal >= 3) score += 4
  }

  // Period 4 / clutch
  if (play.period >= 4) score += 5
  if (play.period >= 3) score += 2

  // General excitement
  if (action === '2pt' && play.shotResult === 'Made') score += 3
  if (desc.includes('layup') && play.shotResult === 'Made') score += 2

  return score
}

/**
 * Get highlight clips applicable to the given post type from the game data.
 * Game recaps use score + story to prioritize plays; other types can be extended later.
 */
export function getHighlightClipsForPostType(
  postType: PostType,
  gameData: GameDataForHighlights,
  options: { maxClips?: number } = {}
): HighlightClip[] {
  const maxClips = options.maxClips ?? DEFAULT_MAX_CLIPS
  const playsWithMp4 = (gameData.playByPlay || []).filter((p): p is PlayWithMp4 & { mp4: string } => !!p.mp4)
  if (playsWithMp4.length === 0) return []

  if (postType === 'game_recap') {
    const scoreData = gameData.scoreData || {}
    const story = gameData.story || {}
    const scored = playsWithMp4.map((play) => ({
      play,
      score: scorePlayForGameRecap(play, scoreData, story),
    }))
    scored.sort((a, b) => b.score - a.score)
    const clips = scored.slice(0, maxClips).map(({ play }) => ({
      mp4: play.mp4,
      description: play.description || undefined,
      action_type: play.actionType || play.subType || undefined,
      period: play.period,
      clock: play.clock ? formatClock(play.clock) : undefined,
    }))
    return sortHighlightClipsChronological(clips)
  }

  // Other post types: return top plays by a simple excitement score (e.g. for player_spotlight later)
  const simpleScore = (p: PlayWithMp4) => {
    let s = 0
    const a = (p.actionType || '').toLowerCase()
    const d = (p.description || '').toLowerCase()
    if (a === 'block') s += 8
    if (a === 'steal') s += 6
    if (d.includes('dunk')) s += 10
    if (a === '3pt' && p.shotResult === 'Made') s += 6
    if (p.shotResult === 'Made' && p.isFieldGoal) s += 3
    if (p.period >= 4) s += 4
    return s
  }
  const sorted = [...playsWithMp4].sort((a, b) => simpleScore(b) - simpleScore(a))
  const clips = sorted.slice(0, maxClips).map((play) => ({
    mp4: play.mp4!,
    description: play.description || undefined,
    action_type: play.actionType || play.subType || undefined,
    period: play.period,
    clock: play.clock ? formatClock(play.clock) : undefined,
  }))
  return sortHighlightClipsChronological(clips)
}
