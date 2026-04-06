/**
 * Builds team_of_night / team_of_week sections (mirrors teamLineup.ts).
 */
import type { SectionRow } from '../prop_prediction/buildPropPredictionSnapshot.ts'
import type { GameData } from './gameDataFromRaw.ts'
import type { ResolvedPlayer } from './resolveTotPlayers.ts'
import { getPlayerHighlightClips } from './getPlayerHighlightClips.ts'

function formatSalary(salary: number): string {
  if (salary >= 1_000_000) return `$${(salary / 1_000_000).toFixed(1)}M`
  if (salary >= 1_000) return `$${(salary / 1_000).toFixed(0)}K`
  return `$${salary}`
}

export function buildTotLineupSections(
  mode: 'totn' | 'totw',
  resolvedPlayers: ResolvedPlayer[],
  matchedGameData: GameData[],
  opts: {
    title: string
    subtitle: string
    totnDate?: string
    week_name?: string
    start_date?: string
    end_date?: string
  },
  clipsPerPlayer: number,
): SectionRow[] {
  const badgeText = mode === 'totn' ? 'TEAM OF THE NIGHT' : 'TEAM OF THE WEEK'
  const sections: SectionRow[] = []

  sections.push({
    section_type: 'hero',
    title: '',
    content: { image_url: '', gradient_overlay: true, badge: badgeText },
    player_id: null,
    team_tricode: null,
  })

  sections.push({
    section_type: 'headline',
    title: '',
    content: { text: opts.title, subtitle: opts.subtitle },
    player_id: null,
    team_tricode: null,
  })

  if (mode === 'totn') {
    const starters = resolvedPlayers.filter((p) => p.role === 'Starter')
    const bench = resolvedPlayers.filter((p) => p.role === 'Bench')
    const totnPlayers = [
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
      section_type: 'team_of_night_module',
      title: '',
      content: { players: totnPlayers, date: opts.totnDate ?? '' },
      player_id: null,
      team_tricode: null,
    })
  } else {
    const totwPlayers = resolvedPlayers.map((p) => ({
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
      section_type: 'team_of_week_module',
      title: '',
      content: {
        players: totwPlayers,
        week_name: opts.week_name,
        start_date: opts.start_date,
        end_date: opts.end_date,
      },
      player_id: null,
      team_tricode: null,
    })
  }

  for (const player of resolvedPlayers) {
    let playerStats: Record<string, number> = {}
    if (matchedGameData.length > 0 && player.nba_player_id) {
      for (const gameData of matchedGameData) {
        const found = (gameData.playerStats || []).find(
          (ps) => Number((ps as Record<string, unknown>).personId ?? (ps as Record<string, unknown>).player_id) === player.nba_player_id,
        ) as Record<string, unknown> | undefined
        if (found) {
          playerStats = {
            pts: Number(found.pts ?? 0),
            reb: Number(found.reb ?? 0),
            ast: Number(found.ast ?? 0),
            stl: Number(found.stl ?? 0),
            blk: Number(found.blk ?? 0),
            min: Number(found.min ?? 0),
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
      section_type: 'player_highlight',
      title: player.name,
      content: {
        player_id: player.nba_player_id || 0,
        name: player.name,
        team_tricode: player.team_abbreviation || '',
        stats: playerStats,
        fantasy_points: player.fantasy_points,
        video_url: bestClip?.mp4 || undefined,
        video_clips: clips.map((c) => ({
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
      },
      player_id: player.nba_player_id || null,
      team_tricode: player.team_abbreviation || null,
    })
  }

  return sections
}
