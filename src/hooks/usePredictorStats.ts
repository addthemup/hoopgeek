import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { predictorTeamNameToTricode } from '../utils/predictorTeamNameToTricode';

/** Single endpoint: array of rows, each has TEAM + stat columns (string values from NBA.com). */
export interface PredictorEndpointData {
  name: string;
  category?: string;
  description?: string;
  headers?: string[];
  data: Record<string, string>[];
}

/** Per-endpoint: home and away rows for the two teams in the game. */
export interface PredictorEndpointSlice {
  home: Record<string, string> | null;
  away: Record<string, string> | null;
}

/** All endpoints keyed by endpoint_name (e.g. defense_dash_overall, defensive_rebounding). Order follows DB rows. */
export type PredictorStatsData = Record<string, PredictorEndpointSlice>;

function getEndpointSlice(
  data: Record<string, string>[] | undefined,
  homeTricode: string,
  awayTricode: string
): PredictorEndpointSlice {
  if (!data || data.length === 0) {
    return { home: null, away: null };
  }
  const homeRow = data.find((row) => predictorTeamNameToTricode(row.TEAM) === homeTricode) ?? null;
  const awayRow = data.find((row) => predictorTeamNameToTricode(row.TEAM) === awayTricode) ?? null;
  return { home: homeRow ?? null, away: awayRow ?? null };
}

export interface UsePredictorStatsParams {
  /** Game date in YYYY-MM-DD (used to query nba_daily_team_stats table). */
  gameDate: string | null;
  /** Home team tricode (e.g. NYK). */
  homeTricode: string | null;
  /** Away team tricode (e.g. BOS). */
  awayTricode: string | null;
  /** When true, the query runs. */
  enabled?: boolean;
}

/**
 * Fetches predictor stats for the given date from the nba_daily_team_stats table,
 * then returns stats for the two teams for the requested endpoint(s).
 */
export function usePredictorStats({
  gameDate,
  homeTricode,
  awayTricode,
  enabled = true,
}: UsePredictorStatsParams) {
  const normalizedHome = (homeTricode ?? '').trim().toUpperCase();
  const normalizedAway = (awayTricode ?? '').trim().toUpperCase();
  const canFetch = Boolean(
    enabled && gameDate && normalizedHome && normalizedAway
  );

  return useQuery({
    queryKey: ['predictor-stats', gameDate, normalizedHome, normalizedAway],
    queryFn: async (): Promise<PredictorStatsData> => {
      if (!gameDate) throw new Error('gameDate required');

      const { data: rows, error } = await supabase
        .from('nba_daily_team_stats')
        .select('endpoint_name, data')
        .eq('date', gameDate);

      if (error) throw new Error(`nba_daily_team_stats fetch failed: ${error.message}`);
      if (!rows?.length) {
        return {
          defense_dash_overall: { home: null, away: null },
          defense_dash_3pt: { home: null, away: null },
          defensive_rebounding: { home: null, away: null },
        };
      }

      return parseNbaStatsRows(rows, normalizedHome, normalizedAway);
    },
    enabled: canFetch,
    staleTime: 0,
  });
}

/** Table row shape: endpoint_name, data (JSON string or already-parsed object from jsonb). */
interface NbaStatsRow {
  endpoint_name: string;
  data: string | NbaStatsPayload;
}

/** Parsed nba_daily_team_stats.data column: has .data array and optional .headers. */
interface NbaStatsPayload {
  data?: Record<string, string>[];
  headers?: string[];
}

function parseNbaStatsRows(
  rows: NbaStatsRow[],
  normalizedHome: string,
  normalizedAway: string
): PredictorStatsData {
  const byEndpoint: Record<string, Record<string, string>[] | undefined> = {};
  for (const row of rows) {
    try {
      const payload: NbaStatsPayload =
        typeof row.data === 'string' ? (JSON.parse(row.data) as NbaStatsPayload) : row.data;
      byEndpoint[row.endpoint_name] = Array.isArray(payload?.data) ? payload.data : undefined;
    } catch {
      byEndpoint[row.endpoint_name] = undefined;
    }
  }

  const result: PredictorStatsData = {};
  for (const row of rows) {
    result[row.endpoint_name] = getEndpointSlice(
      byEndpoint[row.endpoint_name],
      normalizedHome,
      normalizedAway
    );
  }
  return result;
}
