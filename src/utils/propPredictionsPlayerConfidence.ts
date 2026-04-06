/**
 * Player confidence for prop predictions: use opposition team's allowed stats
 * from nba_daily_player_stats (e.g. pts_allowed_per_game) per rulebook.
 * Returns a confidence score 1–10 (higher = more favorable for the pick).
 */

import { getRulebookEntry } from './propPredictionsRulebook';
import type { GameIdToTeamsMap, NbaGameIdToTeamsMap } from './propPredictionsTeamConfidence';

/** nba_daily_player_stats row: date + data (array of { team_tricode/TEAM, [stat columns] }) or flat. */
export interface NbaDailyPlayerStatsRow {
  date?: string;
  endpoint_name?: string;
  data?: string | { data?: Record<string, unknown>[]; headers?: string[] };
  [key: string]: unknown;
}

/** One prop enriched with opposition player stat and player confidence 1–10. */
export interface PropWithPlayerConfidence {
  prop: Record<string, unknown>;
  /** e.g. "PTS allowed" */
  oppositionStatLabel: string;
  oppositionStatValue: string | null;
  /** 1–10: higher = more favorable based on opposition allowed stats. */
  playerConfidence: number | null;
}

function parseNum(s: string | undefined): number | null {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function getTeamFromRow(row: Record<string, unknown>): string | undefined {
  const v = row.team_tricode ?? row.TEAM ?? row.team;
  if (v != null && String(v).trim() !== '') return String(v).trim().toUpperCase();
  const key = Object.keys(row).find((k) => /^team$/i.test(k) || k === 'TEAM');
  return key ? String(row[key]).trim().toUpperCase() : undefined;
}

function getStatFromRow(row: Record<string, unknown>, statKey: string): string | undefined {
  const v = row[statKey];
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const key = Object.keys(row).find((k) => k.toLowerCase() === statKey.toLowerCase());
  return key ? String(row[key]).trim() : undefined;
}

/** Get row for a team from player stats array (team_tricode or TEAM column). */
function getTeamPlayerRow(rows: Record<string, unknown>[] | undefined, teamTricode: string): Record<string, unknown> | null {
  if (!rows?.length || !teamTricode) return null;
  const norm = teamTricode.trim().toUpperCase();
  return rows.find((r) => getTeamFromRow(r) === norm) ?? null;
}

function rankToConfidence(rank: number, total: number): number {
  if (total <= 0) return 5;
  const step = total / 10;
  const band = Math.floor((rank - 1) / step);
  return Math.max(1, Math.min(10, 10 - band));
}

/** Resolve home/away tricodes for a prop (shared logic with team confidence). */
function getHomeAway(
  prop: Record<string, unknown>,
  gameIdToTeams?: GameIdToTeamsMap,
  nbaGameIdToTeams?: NbaGameIdToTeamsMap
): { home: string; away: string } | null {
  const ppg = Array.isArray(prop.player_props_games)
    ? (prop.player_props_games as Record<string, unknown>[])[0]
    : (prop.player_props_games as Record<string, unknown> | undefined);
  let home = (ppg?.home_team_tricode as string | undefined)?.trim();
  let away = (ppg?.away_team_tricode as string | undefined)?.trim();
  if ((!home || !away) && gameIdToTeams && prop.game_id) {
    const t = gameIdToTeams.get(String(prop.game_id));
    if (t?.home_team_tricode && t?.away_team_tricode) {
      home = home ?? t.home_team_tricode.trim();
      away = away ?? t.away_team_tricode.trim();
    }
  }
  const nbaGameId = (ppg?.nba_game_id as string | undefined) ?? (prop.nba_game_id as string | undefined);
  if ((!home || !away) && nbaGameIdToTeams && nbaGameId) {
    const t = nbaGameIdToTeams.get(String(nbaGameId));
    if (t?.home_team_tricode && t?.away_team_tricode) {
      home = home ?? t.home_team_tricode.trim();
      away = away ?? t.away_team_tricode.trim();
    }
  }
  if (home && away) return { home: home.toUpperCase(), away: away.toUpperCase() };
  return null;
}

/**
 * Enrich props with opposition player stat and player confidence 1–10.
 * - playerTeamMap: nba_player_id -> team_abbreviation (tricode)
 * - playerStatsRows: rows from nba_daily_player_stats for the date (e.g. [{ data: [...] }] or flat rows)
 * - gameIdToTeams / nbaGameIdToTeams: same as team confidence for resolving opposition
 */
export function enrichPropsWithPlayerConfidence(
  props: Record<string, unknown>[],
  playerTeamMap: Map<number, string>,
  playerStatsRows: NbaDailyPlayerStatsRow[],
  gameIdToTeams?: GameIdToTeamsMap,
  nbaGameIdToTeams?: NbaGameIdToTeamsMap
): PropWithPlayerConfidence[] {
  // Parse player stats into rows (support payload.data array or top-level array)
  let rows: Record<string, unknown>[] = [];
  for (const row of playerStatsRows) {
    const raw = row.data;
    const payload = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    const arr = Array.isArray((payload as { data?: unknown[] })?.data)
      ? (payload as { data: Record<string, unknown>[] }).data
      : Array.isArray(payload)
        ? (payload as Record<string, unknown>[])
        : [];
    if (arr.length) {
      rows = arr as Record<string, unknown>[];
      break;
    }
  }
  // If no rows from endpoint shape, assume playerStatsRows is already array of row objects (flat table)
  if (rows.length === 0 && playerStatsRows.length > 0 && !(playerStatsRows[0] as NbaDailyPlayerStatsRow).endpoint_name) {
    rows = playerStatsRows as unknown as Record<string, unknown>[];
  }

  const result = props.map((prop) => {
    const nbaPlayerId = Number(prop.nba_player_id);
    const playerTeam = nbaPlayerId ? playerTeamMap.get(nbaPlayerId) : null;
    const homeAway = getHomeAway(prop, gameIdToTeams, nbaGameIdToTeams);
    const oppositionTricode =
      homeAway && playerTeam
        ? (String(playerTeam).trim().toUpperCase() === homeAway.home ? homeAway.away : homeAway.home)
        : null;

    const rule = getRulebookEntry(String(prop.bet_type ?? ''));
    const statKeys = rule?.playerStats?.statKeys ?? [];
    const firstKey = statKeys[0];
    if (!oppositionTricode || !firstKey) {
      return {
        prop,
        oppositionStatLabel: firstKey ?? '—',
        oppositionStatValue: null,
        playerConfidence: null,
      };
    }

    const teamRow = getTeamPlayerRow(rows, oppositionTricode);
    const rawValue = teamRow ? getStatFromRow(teamRow, firstKey) : undefined;
    const numValue = parseNum(rawValue);
    if (numValue == null || rows.length === 0) {
      return {
        prop,
        oppositionStatLabel: firstKey,
        oppositionStatValue: rawValue ?? null,
        playerConfidence: null,
      };
    }

    const allValues = rows
      .map((r) => parseNum(getStatFromRow(r, firstKey)))
      .filter((v): v is number => v != null);
    // Higher "allowed" = more favorable for over → rank 1 = highest value
    allValues.sort((a, b) => b - a);
    const rank = allValues.indexOf(numValue) + 1 || Math.ceil(allValues.length / 2);
    const playerConfidence = rankToConfidence(rank, allValues.length);

    return {
      prop,
      oppositionStatLabel: firstKey.replace(/_/g, ' '),
      oppositionStatValue: rawValue ?? null,
      playerConfidence,
    };
  });

  return result;
}
