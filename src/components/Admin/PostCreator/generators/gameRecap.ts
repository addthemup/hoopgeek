/**
 * Game Recap section generator.
 *
 * Produces: hero → video_carousel → stat_comparisons → player_highlights → pull_quote (fun score)
 */

import { getHighlightClipsForPostType } from '../../../../utils/feedHighlightClips'
import { sortHighlightClipsChronological } from '../../../../utils/sortHighlightClips'
import type {
  HeroContent,
  StatComparisonContent,
  PlayerHighlightContent,
  PullQuoteContent,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext, PlayByPlayAction, GameData } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'
import { getPlayerHighlightClips } from './shared'

export async function generateGameRecapSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  const { draft, matchedGameData, recapHighlightCount = 8, recapPlayerClipCount = 3 } = ctx
  if (matchedGameData.length === 0) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const data = matchedGameData[0]

  // Hero
  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: '',
      gradient_overlay: true,
      badge: 'Game Recap',
      team_tricode: data.teamTricodes[0] || '',
      score_line: data.finalScore || undefined,
      team_tricodes: data.teamTricodes?.length >= 2 ? data.teamTricodes : undefined,
    } satisfies HeroContent,
    player_id: null,
    team_tricode: data.teamTricodes[0] || null,
  })

  // Video carousel from score + story
  const recapClipCount = getHighlightClipsForPostType('game_recap', {
    gameId: data.gameId,
    scoreData: data.scoreData || {},
    story: data.story || {},
    playByPlay: data.playByPlay || [],
  }, { maxClips: 999 }).length

  const recapClips = getHighlightClipsForPostType('game_recap', {
    gameId: data.gameId,
    scoreData: data.scoreData || {},
    story: data.story || {},
    playByPlay: data.playByPlay || [],
  }, { maxClips: Math.min(recapClipCount, Math.max(1, recapHighlightCount)) })

  if (recapClips.length > 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'video_carousel',
      title: 'Highlights',
      content: { clips: recapClips },
      player_id: null,
      team_tricode: null,
    })
  }

  // Stat comparisons from story advantages
  if (data.story?.advantages?.length) {
    for (const adv of data.story.advantages.slice(0, 4)) {
      sections.push({
        id: nextSectionId(),
        section_type: 'stat_comparison',
        title: adv.stat_name,
        content: {
          title: adv.stat_name,
          stat_name: adv.stat_name,
          teams: [
            { tricode: adv.teamTricode || data.teamTricodes[0] || '', value: adv.value1 },
            { tricode: data.teamTricodes.find((t: string) => t !== adv.teamTricode) || data.teamTricodes[1] || '', value: adv.value2 },
          ],
          diff: adv.diff,
        } satisfies StatComparisonContent,
        player_id: null,
        team_tricode: null,
      })
    }
  }

  // Top 5 player highlights with per-player slideshows
  const topPlayers = (data.playerStats || [])
    .filter((p: any) => p.pts != null)
    .sort((a: any, b: any) => (b.pts || 0) - (a.pts || 0))
    .slice(0, 5)

  const playerClipCount = Math.min(10, Math.max(1, recapPlayerClipCount))
  for (const p of topPlayers) {
    const playerId = Number(p.personId || p.player_id)
    const rawClips = getPlayerHighlightClips(playerId, matchedGameData, playerClipCount)
    const playerClips = rawClips.length > 0
      ? sortHighlightClipsChronological(rawClips.map((c) => ({
          mp4: c.mp4!,
          description: c.description,
          action_type: c.actionType || c.subType,
          period: c.period,
          clock: c.clock,
        })))
      : []
    const bestClip = playerClips[0]

    sections.push({
      id: nextSectionId(),
      section_type: 'player_highlight',
      title: p.name || p.playerName || 'Player',
      content: {
        player_id: playerId,
        name: p.name || p.playerName || 'Player',
        team_tricode: p.teamTricode || p.team_abbreviation || '',
        stats: {
          pts: p.pts || 0, reb: p.reb || 0, ast: p.ast || 0,
          stl: p.stl || 0, blk: p.blk || 0, min: p.min || 0,
        },
        fantasy_points: p.fantasyPoints || p.fantasy_points || undefined,
        ...(bestClip ? {
          video_url: bestClip.mp4,
          video_thumbnail: bestClip.mp4.replace('.mp4', '_thumbnail.jpg'),
          video_clips: playerClips.length ? playerClips : undefined,
        } : {}),
      } satisfies PlayerHighlightContent,
      player_id: playerId || null,
      team_tricode: p.teamTricode || p.team_abbreviation || null,
    })
  }

  // Fun score pull quote
  if (data.funScore) {
    sections.push({
      id: nextSectionId(),
      section_type: 'pull_quote',
      title: '',
      content: {
        text: `Fun Score: ${data.funScore}`,
        attribution: 'HoopGeek Algorithm',
        icon: data.funScore >= 80 ? 'fire' : data.funScore >= 60 ? 'trophy' : 'chart',
      } satisfies PullQuoteContent,
      player_id: null,
      team_tricode: null,
    })
  }

  return sections
}
