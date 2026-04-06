/**
 * Team confidence for prop predictions: compare each prop to the OPPOSITION team's
 * stats from nba_daily_team_stats using the rulebook (endpoint + column per bet_type).
 * Returns a confidence score 1–10 based on how favorable that opposition stat is.
 */

import { getRulebookEntry, getRulebookTeamStatEndpoints, type TeamStatInterpretation } from './propPredictionsRulebook.ts'
import { predictorTeamNameToTricode } from './predictorTeamNameToTricode.ts'

/** nba_daily_team_stats row: endpoint_name + data (array of { TEAM, [columns] }). */
export interface NbaDailyTeamStatsRow {
  endpoint_name: string;
  data: string | { data?: Record<string, string>[]; headers?: string[] };
}

/** One prop enriched with opposition stat and team confidence 1–10. */
export interface PropWithTeamConfidence {
  /** Original prop object. */
  prop: Record<string, unknown>;
  /** e.g. "DFG%" or "DREB". */
  oppositionStatLabel: string;
  /** Raw value from nba_daily_team_stats (e.g. "45.2"). */
  oppositionStatValue: string | null;
  /** 1–10: higher = more favorable for the pick (over or under) based on opposition. */
  teamConfidence: number | null;
  /** Individual offense: same stat from player's row in matching offense endpoint (e.g. PPP). */
  playerOffenseStatLabel?: string;
  /** Raw value from nba_daily_player_stats offense endpoint for this player. */
  playerOffenseStatValue?: string | null;
}

/**
 * Parse a numeric value from nba_daily_team_stats (strings like "45.2", "32.1%", "100%").
 */
function parseStatValue(s: string | undefined): number | null {
  if (s == null || s === '') return null;
  const cleaned = String(s).replace(/%/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Get TEAM value from a stats row (key may be TEAM or Team). */
function getRowTeamValue(row: Record<string, string>): string | undefined {
  if (row.TEAM != null && row.TEAM !== '') return row.TEAM;
  const key = Object.keys(row).find((k) => k.toUpperCase() === 'TEAM');
  return key ? row[key] : undefined;
}

/** Get stat column value from a row (exact key first, then case-insensitive match). */
function getRowStatValue(row: Record<string, string> | null | undefined, columnKey: string): string | undefined {
  if (!row) return undefined;
  if (row[columnKey] != null && row[columnKey] !== '') return row[columnKey];
  const key = Object.keys(row).find((k) => k.toUpperCase() === columnKey.toUpperCase());
  return key ? row[key] : undefined;
}

/**
 * Given endpoint data (array of rows with TEAM + stat columns), get the row for a team by tricode.
 * Matches both full names (e.g. "Los Angeles Lakers" -> LAL) and tricodes already stored in TEAM (e.g. "LAL").
 */
function getTeamRow(
  data: Record<string, string>[] | undefined,
  teamTricode: string
): Record<string, string> | null {
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

/**
 * Rank a value among all values (1 = best). For higher_favors_over, higher value = better (rank 1).
 * For lower_favors_over, lower value = better (rank 1).
 */
function rankAmongValues(
  value: number,
  allValues: number[],
  interpretation: TeamStatInterpretation
): number {
  const valid = allValues.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return 1;
  if (interpretation === 'higher_favors_over') {
    valid.sort((a, b) => b - a); // descending: highest first
  } else {
    valid.sort((a, b) => a - b); // ascending: lowest first
  }
  const idx = valid.indexOf(value);
  if (idx === -1) return Math.ceil(valid.length / 2); // middle if not found
  return idx + 1;
}

/**
 * Map rank (1–N, 1 = best) to confidence 1–10 (10 = best).
 * rank 1 → 10, rank N → 1, linear in between.
 */
function rankToConfidence(rank: number, totalTeams: number): number {
  if (totalTeams <= 0) return 5;
  const step = totalTeams / 10;
  const band = Math.floor((rank - 1) / step); // 0..9
  const confidence = 10 - band;
  return Math.max(1, Math.min(10, confidence));
}

/** Optional: game_id (player_props_games.id) -> { home_team_tricode, away_team_tricode } when prop doesn't have player_props_games. */
export type GameIdToTeamsMap = Map<string, { home_team_tricode: string; away_team_tricode: string }>;
/** Optional: nba_game_id (e.g. "0022500884") -> { home_team_tricode, away_team_tricode } from carousel/scoreboard. */
export type NbaGameIdToTeamsMap = Map<string, { home_team_tricode: string; away_team_tricode: string }>;

/** nba_daily_player_stats row (per endpoint): endpoint_name + data array of { PLAYER, TEAM, ... }. */
export interface NbaDailyPlayerStatsRow {
  endpoint_name?: string;
  data?: string | { data?: Record<string, unknown>[] };
  [key: string]: unknown;
}

/** Derive player offense endpoint from team defense endpoint (e.g. isolation_defense -> isolation_offense). */
function getPlayerOffenseEndpoint(defenseEndpoint: string): string | null {
  if (typeof defenseEndpoint !== 'string' || !defenseEndpoint.endsWith('_defense')) return null;
  return defenseEndpoint.replace(/_defense$/, '_offense');
}

/** Get PLAYER value from a row (case-insensitive key). */
function getRowPlayerName(row: Record<string, unknown>): string | undefined {
  const v = row.PLAYER ?? row.player ?? row.Player;
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const key = Object.keys(row).find((k) => k.toUpperCase() === 'PLAYER');
  return key ? String(row[key]).trim() : undefined;
}

/** Normalize name for matching (lowercase, collapse spaces). */
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Find a player's row in offense endpoint data by player name (and optionally team tricode). */
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

/** Get stat from a row (case-insensitive key). */
function getRowStatValueUnknown(row: Record<string, unknown> | null, columnKey: string): string | undefined {
  if (!row) return undefined;
  const v = row[columnKey];
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const key = Object.keys(row).find((k) => k.toUpperCase() === columnKey.toUpperCase());
  return key ? String(row[key]).trim() : undefined;
}

/**
 * Enrich a list of props with opposition team stat and team confidence 1–10.
 * When playerStatsRows is provided and a team stat rule uses a *_defense endpoint,
 * also looks up the player's row in the matching *_offense endpoint (individual offense vs team defense).
 * - playerTeamMap: nba_player_id -> team_abbreviation (tricode)
 * - statsRows: all nba_daily_team_stats rows for the date (endpoint_name, data)
 * - gameIdToTeams: optional fallback when prop has no player_props_games (look up by prop.game_id)
 * - nbaGameIdToTeams: optional fallback from carousel (look up by prop's nba_game_id)
 * - playerStatsRows: optional nba_daily_player_stats rows (endpoint_name, data) for player offense lookups
 */
export function enrichPropsWithTeamConfidence(
  props: Record<string, unknown>[],
  playerTeamMap: Map<number, string>,
  statsRows: NbaDailyTeamStatsRow[],
  gameIdToTeams?: GameIdToTeamsMap,
  nbaGameIdToTeams?: NbaGameIdToTeamsMap,
  playerStatsRows?: NbaDailyPlayerStatsRow[]
): PropWithTeamConfidence[] {
  console.log('[TeamConfidence] enrichPropsWithTeamConfidence called', {
    propsCount: props.length,
    playerTeamMapSize: playerTeamMap.size,
    statsRowsCount: statsRows.length,
    gameIdToTeamsSize: gameIdToTeams?.size ?? 0,
    nbaGameIdToTeamsSize: nbaGameIdToTeams?.size ?? 0,
    playerStatsRowsCount: playerStatsRows?.length ?? 0,
  });

  const byEndpoint: Record<string, Record<string, string>[]> = {};
  for (const row of statsRows) {
    try {
      const payload =
        typeof row.data === 'string' ? (JSON.parse(row.data) as { data?: Record<string, string>[] }) : row.data;
      const arr =
        Array.isArray((payload as { data?: Record<string, string>[] })?.data)
          ? (payload as { data: Record<string, string>[] }).data
          : Array.isArray(payload)
            ? (payload as Record<string, string>[])
            : undefined;
      if (arr?.length) byEndpoint[row.endpoint_name] = arr;
    } catch {
      // skip
    }
  }

  const byPlayerEndpoint: Record<string, Record<string, unknown>[]> = {};
  if (playerStatsRows?.length) {
    for (const row of playerStatsRows) {
      const ep = row.endpoint_name;
      if (!ep) continue;
      try {
        const raw = row.data;
        const payload = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
        const arr = Array.isArray((payload as { data?: unknown[] })?.data)
          ? (payload as { data: Record<string, unknown>[] }).data
          : Array.isArray(payload)
            ? (payload as Record<string, unknown>[])
            : undefined;
        if (arr?.length) byPlayerEndpoint[ep] = arr;
      } catch {
        // skip
      }
    }
    console.log('[TeamConfidence] byPlayerEndpoint keys (player offense):', Object.keys(byPlayerEndpoint));
  }
  const endpointKeys = Object.keys(byEndpoint);
  console.log('[TeamConfidence] byEndpoint keys (available endpoints):', endpointKeys);
  const firstKey = endpointKeys[0];
  if (firstKey && byEndpoint[firstKey]?.[0]) {
    const sample = byEndpoint[firstKey][0];
    console.log('[TeamConfidence] sample row keys from first endpoint:', Object.keys(sample));
    console.log('[TeamConfidence] sample TEAM values:', byEndpoint[firstKey].slice(0, 5).map((r) => getRowTeamValue(r)));
  }
  const rulebookEndpoints = getRulebookTeamStatEndpoints();
  const missing = rulebookEndpoints.filter((e) => !byEndpoint[e]);
  if (missing.length) console.log('[TeamConfidence] rulebook endpoints missing from stats:', missing);

  let noOppositionCount = 0;
  let noRuleCount = 0;
  let noDataCount = 0;
  let withConfidenceCount = 0;

  const result = props.map((prop, idx) => {
    const nbaPlayerId = Number(prop.nba_player_id);
    const playerTeam = nbaPlayerId ? playerTeamMap.get(nbaPlayerId) : null;
    const ppg = Array.isArray(prop.player_props_games)
      ? (prop.player_props_games as Record<string, unknown>[])[0]
      : (prop.player_props_games as Record<string, unknown> | undefined);
    let homeTricode = (ppg?.home_team_tricode as string | undefined)?.trim() || undefined;
    let awayTricode = (ppg?.away_team_tricode as string | undefined)?.trim() || undefined;
    if ((!homeTricode || !awayTricode) && gameIdToTeams && prop.game_id) {
      const teams = gameIdToTeams.get(String(prop.game_id));
      if (teams?.home_team_tricode && teams?.away_team_tricode) {
        homeTricode = homeTricode ?? teams.home_team_tricode.trim();
        awayTricode = awayTricode ?? teams.away_team_tricode.trim();
      }
    }
    const nbaGameId = (ppg?.nba_game_id as string | undefined) ?? (prop.nba_game_id as string | undefined);
    if ((!homeTricode || !awayTricode) && nbaGameIdToTeams && nbaGameId) {
      const teams = nbaGameIdToTeams.get(String(nbaGameId));
      if (teams?.home_team_tricode && teams?.away_team_tricode) {
        homeTricode = homeTricode ?? teams.home_team_tricode.trim();
        awayTricode = awayTricode ?? teams.away_team_tricode.trim();
      }
    }

    let oppositionTricode: string | null = null;
    if (homeTricode && awayTricode && playerTeam) {
      const pt = String(playerTeam).trim().toUpperCase();
      const home = String(homeTricode).trim().toUpperCase();
      const away = String(awayTricode).trim().toUpperCase();
      oppositionTricode = pt === home ? away : pt === away ? home : null;
    }

    if (idx < 3) {
      console.log('[TeamConfidence] prop sample', idx, {
        player: (prop as any).player_name,
        bet_type: prop.bet_type,
        nba_player_id: nbaPlayerId,
        playerTeam,
        homeTricode,
        awayTricode,
        oppositionTricode,
      });
    }
    if (!oppositionTricode) noOppositionCount++;

    const rule = getRulebookEntry(String(prop.bet_type ?? ''));
    const teamStatRules = rule?.teamStats ?? [];
    const firstRule = teamStatRules[0];
    if (!firstRule || !oppositionTricode) {
      if (!firstRule) noRuleCount++;
      return {
        prop,
        oppositionStatLabel: firstRule?.columns?.[0] ?? '—',
        oppositionStatValue: null,
        teamConfidence: null,
      };
    }

    const confidences: number[] = [];
    let primaryLabel = firstRule.columns[0];
    let primaryValue: string | null = null;

    for (const r of teamStatRules) {
      const data = byEndpoint[r.endpointName];
      const teamRow = getTeamRow(data, oppositionTricode);
      const primaryColumn = r.columns[0];
      const rawValue = getRowStatValue(teamRow, primaryColumn);
      const numValue = parseStatValue(rawValue);
      if (primaryValue == null && rawValue != null) {
        primaryLabel = primaryColumn;
        primaryValue = rawValue;
      }
      if (numValue == null || !data?.length) continue;
      const allValues = data
        .map((row) => parseStatValue(getRowStatValue(row, primaryColumn)))
        .filter((v): v is number => v != null);
      const rank = rankAmongValues(numValue, allValues, r.interpretation);
      confidences.push(rankToConfidence(rank, allValues.length));
    }

    if (confidences.length === 0) noDataCount++;
    else withConfidenceCount++;

    const teamConfidence =
      confidences.length > 0
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : null;

    let playerOffenseStatLabel: string | undefined;
    let playerOffenseStatValue: string | null | undefined;
    const offenseEndpoint = getPlayerOffenseEndpoint(firstRule.endpointName);
    if (offenseEndpoint && Object.keys(byPlayerEndpoint).length > 0) {
      const playerRows = byPlayerEndpoint[offenseEndpoint];
      const playerName = (prop.player_name ?? prop.playerName ?? (prop as any).name) as string | undefined;
      if (playerRows && playerName && primaryLabel) {
        const playerRow = findPlayerRow(playerRows, playerName, playerTeam ?? undefined);
        const val = getRowStatValueUnknown(playerRow, primaryLabel);
        if (val !== undefined) {
          playerOffenseStatLabel = primaryLabel;
          playerOffenseStatValue = val;
        }
      }
    }

    return {
      prop,
      oppositionStatLabel: teamStatRules.length > 1 ? `${primaryLabel} (+${teamStatRules.length - 1})` : primaryLabel,
      oppositionStatValue: primaryValue,
      teamConfidence,
      ...(playerOffenseStatLabel != null && { playerOffenseStatLabel }),
      ...(playerOffenseStatValue !== undefined && { playerOffenseStatValue }),
    };
  });

  console.log('[TeamConfidence] enrichment summary', {
    noOppositionCount,
    noRuleCount,
    noDataCount,
    withConfidenceCount,
  });
  if (withConfidenceCount === 0 && props.length > 0) {
    console.warn(
      '[TeamConfidence] Zero props with confidence. Likely cause:',
      noOppositionCount === props.length
        ? 'all props missing opposition (no home/away or player team). Check gameIdToTeams and player_props_games.'
        : noRuleCount > 0
          ? `no rulebook match for bet_type (noRuleCount=${noRuleCount}). Check prop.bet_type vs rulebook keys.`
          : 'no team row in stats for opposition tricode (noDataCount). Check nba_daily_team_stats TEAM column vs tricodes.'
    );
  }
  return result;
}
