/**
 * Builds radar chart data for the Matchups tab: player offense (from nba_daily_player_stats)
 * vs opponent team defense (from nba_daily_team_stats) per MATCHUP_FACTORS.
 */

import { predictorTeamNameToTricode } from './predictorTeamNameToTricode';
import { MATCHUP_FACTORS, type MatchupFactor } from './matchupFactors';

export interface PlayerWithOpposition {
  nbaPlayerId: number;
  playerName: string;
  playerTeamTricode: string;
  oppositionTricode: string;
}

export interface RadarPoint {
  label: string;
  value: number;
  rawPlayer: number | null;
  rawOpp: number | null;
}

export interface PlayerMatchupRadar {
  nbaPlayerId: number;
  playerName: string;
  oppositionTricode: string;
  points: RadarPoint[];
}

function getRowTeamValue(row: Record<string, string | undefined>): string | undefined {
  const v = row.TEAM ?? row.Team;
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const key = Object.keys(row).find((k) => k.toUpperCase() === 'TEAM');
  return key ? String(row[key]).trim() : undefined;
}

function getTeamRow(
  data: Record<string, string | undefined>[] | undefined,
  teamTricode: string
): Record<string, string | undefined> | null {
  if (!data?.length || !teamTricode) return null;
  const normalized = teamTricode.trim().toUpperCase();
  return (
    data.find((row) => {
      const teamVal = getRowTeamValue(row);
      if (!teamVal) return false;
      const fromMap = predictorTeamNameToTricode(teamVal);
      if (fromMap === normalized) return true;
      if (String(teamVal).trim().toUpperCase() === normalized) return true;
      return false;
    }) ?? null
  );
}

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function getRowPlayerName(row: Record<string, unknown>): string | undefined {
  const v = row.PLAYER ?? row.player ?? row.Player;
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const key = Object.keys(row).find((k) => k.toUpperCase() === 'PLAYER');
  return key ? String(row[key]).trim() : undefined;
}

function findPlayerRow(
  rows: Record<string, unknown>[] | undefined,
  playerName: string,
  teamTricode?: string
): Record<string, unknown> | null {
  if (!rows?.length || !playerName) return null;
  const norm = normalizePlayerName(playerName);
  const teamNorm = teamTricode?.trim().toUpperCase();
  return (
    rows.find((row) => {
      const rowName = getRowPlayerName(row);
      const rowTeam = (row.TEAM ?? row.team_tricode ?? row.team) as string | undefined;
      const rowTeamNorm = rowTeam != null ? String(rowTeam).trim().toUpperCase() : undefined;
      const nameMatch = rowName != null && normalizePlayerName(rowName) === norm;
      if (!nameMatch) return false;
      if (teamNorm && rowTeamNorm) return rowTeamNorm === teamNorm;
      return true;
    }) ?? null
  );
}

function getRowStatValue(row: Record<string, unknown> | null | undefined, columnKey: string): string | undefined {
  if (!row) return undefined;
  const v = row[columnKey];
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const key = Object.keys(row).find((k) => k.toUpperCase() === columnKey.toUpperCase());
  return key ? String(row[key]).trim() : undefined;
}

function parseStatValue(s: string | undefined): number | null {
  if (s == null || s === '') return null;
  const cleaned = String(s).replace(/%/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build radar data for each player: one point per matchup factor, value 0–100 (percentile of player stat).
 */
export function buildMatchupRadarData(
  byEndpoint: Record<string, Record<string, string | undefined>[]>,
  byPlayerEndpoint: Record<string, Record<string, unknown>[]>,
  players: PlayerWithOpposition[]
): PlayerMatchupRadar[] {
  const result: PlayerMatchupRadar[] = [];
  for (const player of players) {
    const points: RadarPoint[] = [];
    for (const factor of MATCHUP_FACTORS) {
      const playerRows = byPlayerEndpoint[factor.playerOffenseEndpoint];
      const teamRows = byEndpoint[factor.teamDefenseEndpoint];
      const playerRow = findPlayerRow(playerRows, player.playerName, player.playerTeamTricode);
      const teamRow = getTeamRow(teamRows as Record<string, string | undefined>[], player.oppositionTricode);
      const rawPlayerStr = getRowStatValue(playerRow ?? undefined, factor.playerStatKey);
      const rawOppStr = teamRow ? getRowStatValue(teamRow as unknown as Record<string, unknown>, factor.teamStatKey) : undefined;
      const rawPlayer = parseStatValue(rawPlayerStr ?? undefined);
      const rawOpp = parseStatValue(rawOppStr ?? undefined);
      points.push({
        label: factor.label,
        value: 0,
        rawPlayer,
        rawOpp,
      });
    }
    result.push({
      nbaPlayerId: player.nbaPlayerId,
      playerName: player.playerName,
      oppositionTricode: player.oppositionTricode,
      points,
    });
  }

  // Normalize each factor to 0–100 (percentile: higher raw = higher value when higherPlayerBetter)
  for (const factor of MATCHUP_FACTORS) {
    const values = result
      .map((r) => {
        const p = r.points[MATCHUP_FACTORS.indexOf(factor)];
        return p.rawPlayer;
      })
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length === 0) continue;
    const sorted = [...values].sort((a, b) => (factor.higherPlayerBetter ? b - a : a - b));
    result.forEach((playerRadar) => {
      const p = playerRadar.points[MATCHUP_FACTORS.indexOf(factor)];
      if (p.rawPlayer == null || !Number.isFinite(p.rawPlayer)) {
        p.value = 0;
        return;
      }
      const rank = sorted.indexOf(p.rawPlayer);
      const percentile = sorted.length <= 1 ? 100 : (1 - rank / (sorted.length - 1)) * 100;
      p.value = Math.round(Math.max(0, Math.min(100, percentile)));
    });
  }

  return result;
}

/** One row for the factor table: player + opponent + stat columns. */
export interface MatchupFactorTableRow {
  nbaPlayerId: number;
  playerName: string;
  playerTeamTricode: string;
  oppositionTricode: string;
  playerStats: Record<string, string | undefined>;
  oppStats: Record<string, string | undefined>;
  /** Numeric value used for sort (primary stat). */
  sortValue: number;
}

/**
 * Build table rows for a single factor: all players with their player-offense and opp-defense stats.
 * Sorted best-to-worst by the factor's primary player stat.
 */
export function buildMatchupFactorTableRows(
  byEndpoint: Record<string, Record<string, string | undefined>[]>,
  byPlayerEndpoint: Record<string, Record<string, unknown>[]>,
  players: PlayerWithOpposition[],
  factor: MatchupFactor
): MatchupFactorTableRow[] {
  const playerCols = factor.playerDisplayColumns ?? [factor.playerStatKey];
  const teamCols = factor.teamDisplayColumns ?? [factor.teamStatKey];
  const rows: MatchupFactorTableRow[] = [];
  for (const player of players) {
    const playerRows = byPlayerEndpoint[factor.playerOffenseEndpoint];
    const teamRows = byEndpoint[factor.teamDefenseEndpoint];
    const playerRow = findPlayerRow(playerRows, player.playerName, player.playerTeamTricode);
    const teamRow = getTeamRow(teamRows, player.oppositionTricode);
    const playerStats: Record<string, string | undefined> = {};
    const oppStats: Record<string, string | undefined> = {};
    for (const k of playerCols) {
      playerStats[k] = getRowStatValue(playerRow ?? undefined, k) ?? undefined;
    }
    for (const k of teamCols) {
      oppStats[k] = teamRow ? (getRowStatValue(teamRow as unknown as Record<string, unknown>, k) ?? undefined) : undefined;
    }
    const primaryStr = playerStats[factor.playerStatKey] ?? getRowStatValue(playerRow ?? undefined, factor.playerStatKey);
    const sortValue = parseStatValue(primaryStr ?? undefined) ?? (factor.higherPlayerBetter ? -Infinity : Infinity);
    rows.push({
      nbaPlayerId: player.nbaPlayerId,
      playerName: player.playerName,
      playerTeamTricode: player.playerTeamTricode,
      oppositionTricode: player.oppositionTricode,
      playerStats,
      oppStats,
      sortValue,
    });
  }
  const desc = factor.higherPlayerBetter;
  rows.sort((a, b) => (desc ? b.sortValue - a.sortValue : a.sortValue - b.sortValue));
  return rows;
}
