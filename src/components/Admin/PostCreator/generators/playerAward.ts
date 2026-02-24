/**
 * Player of the Week / Player of the Month section generator.
 *
 * Uses awardGameLog (nba_boxscores rows) + matchedGameData (local JSON files
 * with play-by-play & mp4 URLs) from the GeneratorContext to build:
 *
 *   hero → headline → averages player_highlight (with video_clips) →
 *   game_log table → video_carousel → pull_quote → rich_text
 */

import type {
  HeroContent,
  HeadlineContent,
  PlayerHighlightContent,
  PullQuoteContent,
  GameLogContent,
  GameLogRow,
  VideoCarouselContent,
  HighlightClip,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'
import { getPlayerHighlightClips } from './shared'

export async function generatePlayerAwardSections(
  ctx: GeneratorContext,
  mode: 'pow' | 'pom'
): Promise<SectionDraft[]> {
  const {
    draft, resolvedPlayers, awardGameLog = [], matchedGameData,
    awardHighlightCount = 3,
  } = ctx
  if (resolvedPlayers.length === 0) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const player = resolvedPlayers[0]
  const playerId = player.nba_player_id ?? 0

  const isPOW = mode === 'pow'
  const badgeText = isPOW ? 'PLAYER OF THE WEEK' : 'PLAYER OF THE MONTH'
  const awardRow = isPOW ? draft.metadata.pow_row : draft.metadata.pom_row
  const conference = awardRow?.conference || ''
  const isTie = awardRow?.is_tie || false

  const periodLabel = isPOW
    ? `Week of ${awardRow?.week_start_date || draft.game_date || '?'}`
    : `${getMonthName(awardRow?.award_month)} ${awardRow?.award_year || ''}`

  // ── Compute averages from game log ────────────────────────

  const gp = awardGameLog.length
  let totalPts = 0, totalReb = 0, totalAst = 0, totalStl = 0, totalBlk = 0, totalTov = 0
  let totalFgm = 0, totalFga = 0, totalFg3m = 0, totalFg3a = 0, totalFtm = 0, totalFta = 0

  for (const g of awardGameLog) {
    totalPts += g.pts ?? 0
    totalReb += g.reb ?? 0
    totalAst += g.ast ?? 0
    totalStl += g.stl ?? 0
    totalBlk += g.blk ?? 0
    totalTov += g.tov ?? 0
    totalFgm += g.fgm ?? 0
    totalFga += g.fga ?? 0
    totalFg3m += g.fg3m ?? 0
    totalFg3a += g.fg3a ?? 0
    totalFtm += g.ftm ?? 0
    totalFta += g.fta ?? 0
  }

  const safe = (num: number, den: number) => den > 0 ? num / den : 0
  const ppg = safe(totalPts, gp)
  const rpg = safe(totalReb, gp)
  const apg = safe(totalAst, gp)
  const spg = safe(totalStl, gp)
  const bpg = safe(totalBlk, gp)
  const topg = safe(totalTov, gp)
  const fgPct = safe(totalFgm, totalFga) * 100
  const fg3Pct = safe(totalFg3m, totalFg3a) * 100
  const ftPct = safe(totalFtm, totalFta) * 100

  // ── Collect best highlight clips from JSON game data ──────

  const topClips = awardHighlightCount > 0
    ? getPlayerHighlightClips(playerId, matchedGameData, awardHighlightCount)
    : []

  const highlightClips: HighlightClip[] = topClips.map(p => ({
    mp4: p.mp4!,
    description: p.description || undefined,
    action_type: p.actionType || undefined,
    period: p.period || undefined,
    clock: p.clock || undefined,
  }))

  // ── 1. Hero ───────────────────────────────────────────────

  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: draft.cover_image_url || '',
      gradient_overlay: true,
      badge: badgeText,
      team_tricode: player.team_abbreviation || undefined,
      player_name: player.name,
    } satisfies HeroContent,
    player_id: playerId,
    team_tricode: player.team_abbreviation || null,
  })

  // ── 2. Headline ───────────────────────────────────────────

  sections.push({
    id: nextSectionId(),
    section_type: 'headline',
    title: '',
    content: {
      text: draft.title || badgeText.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' '),
      subtitle: draft.subtitle || `${player.name} (${player.team_abbreviation || '?'})${conference ? ` — ${conference} Conference` : ''}`,
    } satisfies HeadlineContent,
    player_id: playerId,
    team_tricode: null,
  })

  // ── 3. Averages player_highlight card (with video clips) ──

  if (gp > 0) {
    sections.push({
      id: nextSectionId(),
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
      } satisfies PlayerHighlightContent,
      player_id: playerId,
      team_tricode: player.team_abbreviation || null,
    })
  } else {
    sections.push({
      id: nextSectionId(),
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
      } satisfies PlayerHighlightContent,
      player_id: playerId,
      team_tricode: player.team_abbreviation || null,
    })
  }

  // ── 4. Game log table ─────────────────────────────────────

  if (awardGameLog.length > 0) {
    const rows: GameLogRow[] = awardGameLog.map(g => ({
      game_date: g.game_date,
      matchup: g.matchup,
      min: g.min,
      pts: g.pts ?? 0,
      reb: g.reb ?? 0,
      ast: g.ast ?? 0,
      stl: g.stl ?? 0,
      blk: g.blk ?? 0,
      tov: g.tov ?? 0,
      fgm: g.fgm ?? 0,
      fga: g.fga ?? 0,
      fg3m: g.fg3m ?? 0,
      fg3a: g.fg3a ?? 0,
      ftm: g.ftm ?? 0,
      fta: g.fta ?? 0,
      plus_minus: g.plus_minus_points ?? null,
    }))

    sections.push({
      id: nextSectionId(),
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
      } satisfies GameLogContent,
      player_id: playerId,
      team_tricode: player.team_abbreviation || null,
    })
  }

  // ── 5. Video carousel (top N highlights) ──────────────────

  if (highlightClips.length > 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'video_carousel',
      title: `${player.name} — Top Highlights`,
      content: {
        clips: highlightClips,
      } satisfies VideoCarouselContent,
      player_id: playerId,
      team_tricode: player.team_abbreviation || null,
    })
  }

  // ── 6. Award callout ──────────────────────────────────────

  sections.push({
    id: nextSectionId(),
    section_type: 'pull_quote',
    title: '',
    content: {
      text: `${player.name} — ${badgeText}`,
      attribution: `${periodLabel}${isTie ? ' (co-winner)' : ''}`,
      icon: 'trophy',
      accent_color: isPOW ? '#34D399' : '#F472B6',
    } satisfies PullQuoteContent,
    player_id: playerId,
    team_tricode: null,
  })

  // ── 7. Analysis rich_text ─────────────────────────────────

  const gamesSummary = awardGameLog.length > 0
    ? `\n\n**Games this ${isPOW ? 'week' : 'month'}:** ${awardGameLog.map(g => `${g.matchup} (${g.pts}pts/${g.reb}reb/${g.ast}ast)`).join(' | ')}`
    : ''

  sections.push({
    id: nextSectionId(),
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

function getMonthName(month?: number): string {
  if (!month) return ''
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return names[month] || ''
}
