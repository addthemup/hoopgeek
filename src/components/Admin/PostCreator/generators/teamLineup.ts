/**
 * Team of the Night / Team of the Week section generator.
 *
 * Produces: hero → headline → team_of_night_module | team_of_week_module → player_highlight per player
 * Module section uses same display component as the live feed modules.
 */

import type {
  HeroContent,
  HeadlineContent,
  PlayerHighlightContent,
  LineupPlayer,
  TeamOfNightModuleContent,
  TeamOfNightPlayerEntry,
  TeamOfWeekModuleContent,
  TeamOfWeekPlayerEntry,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext, ResolvedPlayer } from '../types'
import { nextSectionId, resetSectionIdCounter, formatSalary } from '../utils'
import { getPlayerHighlightClips } from './shared'

export async function generateTeamLineupSections(
  ctx: GeneratorContext,
  mode: 'totn' | 'totw'
): Promise<SectionDraft[]> {
  const { draft, resolvedPlayers, matchedGameData, totnPlayerClipCount = 3, totwPlayerClipCount = 3 } = ctx
  if (resolvedPlayers.length === 0) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const badgeText = mode === 'totn' ? 'TEAM OF THE NIGHT' : 'TEAM OF THE WEEK'
  const clipsPerPlayer = Math.min(10, Math.max(1, mode === 'totn' ? totnPlayerClipCount : totwPlayerClipCount))

  // Hero
  sections.push({
    id: nextSectionId(), section_type: 'hero', title: '',
    content: { image_url: '', gradient_overlay: true, badge: badgeText } satisfies HeroContent,
    player_id: null, team_tricode: null,
  })

  // Headline
  sections.push({
    id: nextSectionId(), section_type: 'headline', title: '',
    content: { text: draft.title, subtitle: draft.subtitle } satisfies HeadlineContent,
    player_id: null, team_tricode: null,
  })

  const toLineupPlayer = (p: ResolvedPlayer): LineupPlayer => {
    const clips = p.nba_player_id
      ? getPlayerHighlightClips(p.nba_player_id, matchedGameData, clipsPerPlayer).map(c => ({
          mp4: c.mp4!,
          description: c.description,
          action_type: c.actionType,
          period: c.period,
          clock: c.clock,
        }))
      : undefined
    return {
      player_id: p.nba_player_id || 0,
      name: p.name,
      fantasy_points: p.fantasy_points,
      salary: p.salary,
      team_tricode: p.team_abbreviation || '',
      position: p.position ?? undefined,
      jersey_number: p.jersey_number ?? undefined,
      video_clips: clips?.length ? clips : undefined,
    }
  }

  if (mode === 'totn') {
    const starters = resolvedPlayers.filter((p) => p.role === 'Starter')
    const bench = resolvedPlayers.filter((p) => p.role === 'Bench')
    const totnPlayers: TeamOfNightPlayerEntry[] = [
      ...starters.map((p, idx) => ({
        player_id: p.id,
        nba_player_id: p.nba_player_id ?? 0,
        player_name: p.name,
        team: p.team_abbreviation ?? '',
        player_position: p.position ?? '',
        jersey_number: String(p.jersey_number ?? ''),
        salary: p.salary,
        fantasy_points: p.fantasy_points,
        games_played: 1,
        lineup_order: idx + 1,
        lineup_unit: 'starters' as const,
        unit_position: idx + 1,
        weighted_points: p.fantasy_points * 1.0,
      })),
      ...bench.map((p, idx) => ({
        player_id: p.id,
        nba_player_id: p.nba_player_id ?? 0,
        player_name: p.name,
        team: p.team_abbreviation ?? '',
        player_position: p.position ?? '',
        jersey_number: String(p.jersey_number ?? ''),
        salary: p.salary,
        fantasy_points: p.fantasy_points,
        games_played: 1,
        lineup_order: starters.length + idx + 1,
        lineup_unit: 'bench' as const,
        unit_position: idx + 1,
        weighted_points: p.fantasy_points * (idx < 5 ? 0.75 : 0.5),
      })),
    ]
    sections.push({
      id: nextSectionId(),
      section_type: 'team_of_night_module',
      title: '',
      content: { players: totnPlayers, date: draft.subtitle || '' } satisfies TeamOfNightModuleContent,
      player_id: null,
      team_tricode: null,
    })
  } else {
    const totwPlayers: TeamOfWeekPlayerEntry[] = resolvedPlayers.map((p) => ({
      player_id: p.id,
      nba_player_id: p.nba_player_id ?? 0,
      player_name: p.name,
      team: p.team_abbreviation ?? '',
      player_position: p.position ?? '',
      jersey_number: String(p.jersey_number ?? ''),
      salary: p.salary,
      avg_fantasy_points: p.fantasy_points,
      games_played: 1,
    }))
    sections.push({
      id: nextSectionId(),
      section_type: 'team_of_week_module',
      title: '',
      content: {
        players: totwPlayers,
        week_name: draft.metadata?.week_name,
        start_date: draft.metadata?.start_date,
        end_date: draft.metadata?.end_date,
      } satisfies TeamOfWeekModuleContent,
      player_id: null,
      team_tricode: null,
    })
  }

  // Per-player highlight sections
  for (const player of resolvedPlayers) {
    let playerStats: Record<string, number> = {}

    if (matchedGameData.length > 0 && player.nba_player_id) {
      for (const gameData of matchedGameData) {
        const found = (gameData.playerStats || []).find(
          (ps: any) => Number(ps.personId || ps.player_id) === player.nba_player_id
        )
        if (found) {
          playerStats = {
            pts: found.pts || 0, reb: found.reb || 0, ast: found.ast || 0,
            stl: found.stl || 0, blk: found.blk || 0, min: found.min || 0,
          }
          break
        }
      }
    }

    const clips = player.nba_player_id
      ? getPlayerHighlightClips(player.nba_player_id, matchedGameData, clipsPerPlayer)
      : []
    const bestClip = clips[0]

    sections.push({
      id: nextSectionId(),
      section_type: 'player_highlight',
      title: player.name,
      content: {
        player_id: player.nba_player_id || 0,
        name: player.name,
        team_tricode: player.team_abbreviation || '',
        stats: playerStats,
        fantasy_points: player.fantasy_points,
        video_url: bestClip?.mp4 || undefined,
        video_clips: clips.map(c => ({
          mp4: c.mp4!,
          description: c.description,
          action_type: c.actionType,
          period: c.period,
          clock: c.clock,
        })),
        data_overlays: [
          { label: 'Fantasy Pts', value: player.fantasy_points.toFixed(1) },
          { label: 'Salary', value: formatSalary(player.salary) },
          ...(playerStats.pts ? [{ label: 'PTS', value: String(playerStats.pts) }] : []),
          ...(playerStats.reb ? [{ label: 'REB', value: String(playerStats.reb) }] : []),
          ...(playerStats.ast ? [{ label: 'AST', value: String(playerStats.ast) }] : []),
        ],
      } satisfies PlayerHighlightContent,
      player_id: player.nba_player_id || null,
      team_tricode: player.team_abbreviation || null,
    })
  }

  return sections
}
