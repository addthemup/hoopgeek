/**
 * Mirrors playerAward.ts — builds sections for POW / POM.
 */
import type { SectionRow } from '../prop_prediction/buildPropPredictionSnapshot.ts'
import type { GameData } from './gameDataFromRaw.ts'
import type { ResolvedPlayer } from './resolveTotPlayers.ts'
import { getPlayerHighlightClips } from './getPlayerHighlightClips.ts'
import type { BoxScoreRow } from './fetchPlayerGameLog.ts'

function getMonthName(month?: number): string {
  if (!month) return ''
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return names[month] || ''
}

export function buildPlayerAwardSnapshot(
  mode: 'pow' | 'pom',
  player: ResolvedPlayer,
  awardRow: Record<string, unknown>,
  awardGameLog: BoxScoreRow[],
  matchedGameData: GameData[],
  coverImageUrl: string,
  awardHighlightCount: number,
): SectionRow[] {
  const playerId = player.nba_player_id ?? 0
  const isPOW = mode === 'pow'
  const badgeText = isPOW ? 'PLAYER OF THE WEEK' : 'PLAYER OF THE MONTH'
  const conference = String(awardRow.conference ?? '')
  const isTie = Boolean(awardRow.is_tie)

  const periodLabel = isPOW
    ? `Week of ${String(awardRow.week_start_date ?? '')}`
    : `${getMonthName(Number(awardRow.award_month))} ${awardRow.award_year ?? ''}`

  const gp = awardGameLog.length
  let totalPts = 0,
    totalReb = 0,
    totalAst = 0,
    totalStl = 0,
    totalBlk = 0,
    totalTov = 0
  let totalFgm = 0,
    totalFga = 0,
    totalFg3m = 0,
    totalFg3a = 0,
    totalFtm = 0,
    totalFta = 0

  for (const g of awardGameLog) {
    totalPts += Number(g.pts ?? 0)
    totalReb += Number(g.reb ?? 0)
    totalAst += Number(g.ast ?? 0)
    totalStl += Number(g.stl ?? 0)
    totalBlk += Number(g.blk ?? 0)
    totalTov += Number(g.tov ?? 0)
    totalFgm += Number(g.fgm ?? 0)
    totalFga += Number(g.fga ?? 0)
    totalFg3m += Number(g.fg3m ?? 0)
    totalFg3a += Number(g.fg3a ?? 0)
    totalFtm += Number(g.ftm ?? 0)
    totalFta += Number(g.fta ?? 0)
  }

  const safe = (num: number, den: number) => (den > 0 ? num / den : 0)
  const ppg = safe(totalPts, gp)
  const rpg = safe(totalReb, gp)
  const apg = safe(totalAst, gp)
  const spg = safe(totalStl, gp)
  const bpg = safe(totalBlk, gp)
  const topg = safe(totalTov, gp)
  const fgPct = safe(totalFgm, totalFga) * 100
  const fg3Pct = safe(totalFg3m, totalFg3a) * 100
  const ftPct = safe(totalFtm, totalFta) * 100

  const topClips =
    awardHighlightCount > 0 && playerId ? getPlayerHighlightClips(playerId, matchedGameData, awardHighlightCount) : []

  const highlightClips = topClips.map((p) => ({
    mp4: p.mp4!,
    description: p.description || undefined,
    action_type: p.actionType || undefined,
    period: p.period || undefined,
    clock: p.clock || undefined,
  }))

  const sections: SectionRow[] = []

  sections.push({
    section_type: 'hero',
    title: '',
    content: {
      image_url: coverImageUrl || '',
      gradient_overlay: true,
      badge: badgeText,
      team_tricode: player.team_abbreviation || undefined,
      player_name: player.name,
    },
    player_id: playerId,
    team_tricode: player.team_abbreviation || null,
  })

  sections.push({
    section_type: 'headline',
    title: '',
    content: {
      text: badgeText.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' '),
      subtitle: `${player.name} (${player.team_abbreviation || '?'})${conference ? ` — ${conference} Conference` : ''}`,
    },
    player_id: playerId,
    team_tricode: null,
  })

  if (gp > 0) {
    sections.push({
      section_type: 'player_highlight',
      title: `${player.name} — ${isPOW ? 'Week' : 'Month'} Averages`,
      content: {
        player_id: playerId,
        name: player.name,
        team_tricode: player.team_abbreviation || '',
        stats: {
          pts: parseFloat(ppg.toFixed(1)),
          reb: parseFloat(rpg.toFixed(1)),
          ast: parseFloat(apg.toFixed(1)),
          stl: parseFloat(spg.toFixed(1)),
          blk: parseFloat(bpg.toFixed(1)),
          fg_pct: parseFloat(fgPct.toFixed(1)) / 100,
          fg3_pct: parseFloat(fg3Pct.toFixed(1)) / 100,
          ft_pct: parseFloat(ftPct.toFixed(1)) / 100,
        },
        video_clips: highlightClips.length > 0 ? highlightClips : undefined,
        data_overlays: [
          { label: 'GP', value: String(gp) },
          { label: 'PPG', value: ppg.toFixed(1) },
          { label: 'RPG', value: rpg.toFixed(1) },
          { label: 'APG', value: apg.toFixed(1) },
          { label: 'FG%', value: `${fgPct.toFixed(1)}%` },
          { label: '3P%', value: `${fg3Pct.toFixed(1)}%` },
        ],
      },
      player_id: playerId,
      team_tricode: player.team_abbreviation || null,
    })
  } else {
    sections.push({
      section_type: 'player_highlight',
      title: player.name,
      content: {
        player_id: playerId,
        name: player.name,
        team_tricode: player.team_abbreviation || '',
        stats: {},
        video_clips: highlightClips.length > 0 ? highlightClips : undefined,
        data_overlays: [
          { label: 'Award', value: isPOW ? 'POW' : 'POM' },
          ...(conference ? [{ label: 'Conference', value: conference }] : []),
          ...(player.team_abbreviation ? [{ label: 'Team', value: player.team_abbreviation }] : []),
        ],
      },
      player_id: playerId,
      team_tricode: player.team_abbreviation || null,
    })
  }

  if (awardGameLog.length > 0) {
    const rows = awardGameLog.map((g) => ({
      game_date: g.game_date,
      matchup: g.matchup,
      min: g.min,
      pts: Number(g.pts ?? 0),
      reb: Number(g.reb ?? 0),
      ast: Number(g.ast ?? 0),
      stl: Number(g.stl ?? 0),
      blk: Number(g.blk ?? 0),
      tov: Number(g.tov ?? 0),
      fgm: Number(g.fgm ?? 0),
      fga: Number(g.fga ?? 0),
      fg3m: Number(g.fg3m ?? 0),
      fg3a: Number(g.fg3a ?? 0),
      ftm: Number(g.ftm ?? 0),
      fta: Number(g.fta ?? 0),
      plus_minus: g.plus_minus_points ?? null,
    }))

    sections.push({
      section_type: 'game_log',
      title: 'Game Log',
      content: {
        player_name: player.name,
        player_id: playerId,
        team_tricode: player.team_abbreviation || '',
        period_label: periodLabel,
        rows,
        averages: {
          gp,
          ppg: parseFloat(ppg.toFixed(1)),
          rpg: parseFloat(rpg.toFixed(1)),
          apg: parseFloat(apg.toFixed(1)),
          spg: parseFloat(spg.toFixed(1)),
          bpg: parseFloat(bpg.toFixed(1)),
          topg: parseFloat(topg.toFixed(1)),
          fg_pct: parseFloat(fgPct.toFixed(1)),
          fg3_pct: parseFloat(fg3Pct.toFixed(1)),
          ft_pct: parseFloat(ftPct.toFixed(1)),
        },
      },
      player_id: playerId,
      team_tricode: player.team_abbreviation || null,
    })
  }

  if (highlightClips.length > 0) {
    sections.push({
      section_type: 'video_carousel',
      title: `${player.name} — Top Highlights`,
      content: { clips: highlightClips },
      player_id: playerId,
      team_tricode: player.team_abbreviation || null,
    })
  }

  sections.push({
    section_type: 'pull_quote',
    title: '',
    content: {
      text: `${player.name} — ${badgeText}`,
      attribution: `${periodLabel}${isTie ? ' (co-winner)' : ''}`,
      icon: 'trophy',
      accent_color: isPOW ? '#34D399' : '#F472B6',
    },
    player_id: playerId,
    team_tricode: null,
  })

  const gamesSummary =
    awardGameLog.length > 0
      ? `\n\n**Games this ${isPOW ? 'week' : 'month'}:** ${awardGameLog.map((g) => `${g.matchup} (${g.pts}pts/${g.reb}reb/${g.ast}ast)`).join(' | ')}`
      : ''

  sections.push({
    section_type: 'rich_text',
    title: 'Analysis',
    content: {
      markdown: `## ${player.name}${gamesSummary}\n\n*Add analysis here — stats, highlights, what made this ${isPOW ? 'week' : 'month'} special.*`,
    },
    player_id: playerId,
    team_tricode: null,
  })

  return sections
}
