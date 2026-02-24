/**
 * Player Spotlight section generator.
 *
 * Produces: hero → headline → video_carousel → player_highlight → prop_cards
 */

import { sortHighlightClipsChronological } from '../../../../utils/sortHighlightClips'
import { calculatePropResult } from '../../../../utils/playerPropsCalculator'
import { filterFullGameProps } from '../../../../utils/playerPropsFilter'
import { supabase } from '../../../../utils/supabase'
import type {
  HeroContent,
  HeadlineContent,
  PlayerHighlightContent,
  PropCardContent,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'
import { getPlayerHighlightClips } from './shared'

export async function generatePlayerSpotlightSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  const { draft, matchedGameData, spotlightPlayerId, spotlightHighlightCount = 5 } = ctx
  if (!spotlightPlayerId || matchedGameData.length === 0) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const data = matchedGameData[0]
  const gameId = data.gameId
  const gameDate = data.gameDate || draft.game_date || ''

  const playerStat = (data.playerStats || []).find(
    (p: any) => Number(p.personId || p.player_id) === spotlightPlayerId
  )
  const playerName = playerStat?.name || playerStat?.playerName ||
    (data.playByPlay || []).find((p: any) => p.personId === spotlightPlayerId)?.playerName ||
    `Player ${spotlightPlayerId}`
  const teamTricode = playerStat?.teamTricode || playerStat?.team_abbreviation || data.teamTricodes?.[0] || ''

  const clips = getPlayerHighlightClips(spotlightPlayerId, matchedGameData, Math.min(20, spotlightHighlightCount))
  const highlightClips = sortHighlightClipsChronological(clips.map(c => ({
    mp4: c.mp4!,
    description: c.description,
    action_type: c.actionType,
    period: c.period,
    clock: c.clock,
  })))

  const playerStats: Record<string, number> = playerStat
    ? { pts: playerStat.pts || 0, reb: playerStat.reb || 0, ast: playerStat.ast || 0, stl: playerStat.stl || 0, blk: playerStat.blk || 0, min: playerStat.min || 0 }
    : {}

  // Hero
  sections.push({
    id: nextSectionId(), section_type: 'hero', title: '',
    content: {
      image_url: '',
      gradient_overlay: true,
      badge: 'PLAYER SPOTLIGHT',
      team_tricode: teamTricode || null,
      player_name: playerName,
      player_stats: Object.keys(playerStats).length > 0 ? playerStats : undefined,
    } satisfies HeroContent,
    player_id: spotlightPlayerId, team_tricode: teamTricode || null,
  })

  // Headline
  sections.push({
    id: nextSectionId(), section_type: 'headline', title: '',
    content: {
      text: draft.title || data.matchup || `${playerName} — ${data.finalScore || ''}`,
      subtitle: draft.subtitle || data.finalScore || '',
    } satisfies HeadlineContent,
    player_id: spotlightPlayerId, team_tricode: null,
  })

  // Video carousel
  if (highlightClips.length > 0) {
    sections.push({
      id: nextSectionId(), section_type: 'video_carousel', title: 'Highlights',
      content: { clips: highlightClips },
      player_id: spotlightPlayerId, team_tricode: null,
    })
  }

  // Player highlight card
  sections.push({
    id: nextSectionId(), section_type: 'player_highlight', title: playerName,
    content: {
      player_id: spotlightPlayerId,
      name: playerName,
      team_tricode: teamTricode || null,
      stats: playerStats,
      video_url: highlightClips[0]?.mp4,
      video_clips: highlightClips.length ? highlightClips : undefined,
      data_overlays: [
        ...(playerStats.pts != null && playerStats.pts > 0 ? [{ label: 'PTS', value: String(playerStats.pts) }] : []),
        ...(playerStats.reb != null && playerStats.reb > 0 ? [{ label: 'REB', value: String(playerStats.reb) }] : []),
        ...(playerStats.ast != null && playerStats.ast > 0 ? [{ label: 'AST', value: String(playerStats.ast) }] : []),
      ],
    } satisfies PlayerHighlightContent,
    player_id: spotlightPlayerId, team_tricode: teamTricode || null,
  })

  // Prop cards (fetch from DB)
  try {
    const { data: nbaGame } = await supabase
      .from('nba_games')
      .select('game_date, home_team_tricode, away_team_tricode')
      .eq('game_id', gameId)
      .maybeSingle()

    if (nbaGame?.game_date) {
      const targetDate = nbaGame.game_date.split('T')[0]
      const home = nbaGame.home_team_tricode || ''
      const away = nbaGame.away_team_tricode || ''
      const { data: propsGame } = await supabase
        .from('player_props_games')
        .select('id')
        .eq('game_date', targetDate)
        .or(`home_team_tricode.eq.${home},away_team_tricode.eq.${home},home_team_tricode.eq.${away},away_team_tricode.eq.${away}`)
        .limit(1)
        .maybeSingle()

      if (propsGame) {
        const { data: allProps } = await supabase
          .from('player_props')
          .select('id, bet_type, line, bet_type_id, game_id, raw_odd_data')
          .eq('game_id', propsGame.id)
          .eq('nba_player_id', spotlightPlayerId)

        const fullGameProps = filterFullGameProps(allProps || [])
        const { data: boxscore } = await supabase
          .from('nba_boxscores')
          .select('pts, reb, ast, stl, blk, tov, fg3m, ftm')
          .eq('nba_player_id', spotlightPlayerId)
          .eq('game_id', gameId)
          .single()

        if (boxscore && fullGameProps.length > 0) {
          for (const prop of fullGameProps) {
            const result = calculatePropResult(prop.bet_type, prop.line ?? 0, boxscore)
            if (result) {
              sections.push({
                id: nextSectionId(),
                section_type: 'prop_card',
                title: '',
                content: {
                  player_id: spotlightPlayerId,
                  player_name: playerName,
                  bet_type: prop.bet_type,
                  line: prop.line ?? 0,
                  actual: result.actualValue,
                  result: result.result,
                } satisfies PropCardContent,
                player_id: spotlightPlayerId,
                team_tricode: null,
              })
            }
          }
        }
      }
    }
  } catch {
    // Omit props on error — non-critical
  }

  return sections
}
