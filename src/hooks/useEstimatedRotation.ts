import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import {
  estimateTeamRotationMinutes,
  type EstimatedRotationPlayer,
  type RotationRosterPlayer,
  type PlayerInjurySignal,
  type PlayerRecentMinuteGame,
} from '../utils/minutesEstimator';
import { buildStarterRateMapFromRecentMinutes } from '../utils/rotationStarters';

interface UseEstimatedRotationParams {
  enabled: boolean;
  gameDate?: string | null;
  homeTricode?: string | null;
  awayTricode?: string | null;
  homeRoster: RotationRosterPlayer[];
  awayRoster: RotationRosterPlayer[];
  lookbackGames?: number;
  homeRotationSizeTarget?: number | null;
  awayRotationSizeTarget?: number | null;
  homeForcedOutPlayerIds?: number[];
  awayForcedOutPlayerIds?: number[];
}

export interface EstimatedRotationData {
  home: EstimatedRotationPlayer[];
  away: EstimatedRotationPlayer[];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function useEstimatedRotation({
  enabled,
  gameDate,
  homeTricode,
  awayTricode,
  homeRoster,
  awayRoster,
  lookbackGames = 10,
  homeRotationSizeTarget = null,
  awayRotationSizeTarget = null,
  homeForcedOutPlayerIds = [],
  awayForcedOutPlayerIds = [],
}: UseEstimatedRotationParams) {
  return useQuery<EstimatedRotationData>({
    queryKey: [
      'estimated-rotation',
      gameDate ?? null,
      homeTricode ?? null,
      awayTricode ?? null,
      homeRoster.length,
      awayRoster.length,
      lookbackGames,
      homeRotationSizeTarget ?? null,
      awayRotationSizeTarget ?? null,
      homeForcedOutPlayerIds.join(','),
      awayForcedOutPlayerIds.join(','),
    ],
    queryFn: async () => {
      const allRoster = [...homeRoster, ...awayRoster];
      const nbaPlayerIds = Array.from(
        new Set(allRoster.map((player) => player.nba_player_id).filter((id): id is number => id != null))
      );
      if (!nbaPlayerIds.length) {
        return { home: [], away: [] };
      }

      let minutesQuery = supabase
        .from('nba_boxscores')
        .select('game_id, nba_player_id, player_name, team_tricode, min, game_date')
        .in('nba_player_id', nbaPlayerIds)
        .gt('min', 0)
        .order('game_date', { ascending: false });

      if (gameDate) {
        minutesQuery = minutesQuery.lt('game_date', gameDate);
      }

      const dateOnly = gameDate ? gameDate.slice(0, 10) : null;
      const [dayStart, dayEnd] = dateOnly
        ? [`${dateOnly}T00:00:00`, `${dateOnly}T23:59:59`]
        : [null, null];

      const [
        { data: minuteRows, error: minuteError },
        { data: gameOddsRows, error: gameOddsError },
      ] = await Promise.all([
        minutesQuery,
        dayStart && dayEnd && homeTricode && awayTricode
          ? supabase
              .from('nba_games')
              .select('home_spread, away_spread')
              .eq('home_team_tricode', homeTricode)
              .eq('away_team_tricode', awayTricode)
              .gte('game_date', dayStart)
              .lte('game_date', dayEnd)
              .limit(1)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (minuteError) throw minuteError;
      if (gameOddsError) throw gameOddsError;

      // NOTE: long `in(...)` filters can 400 on PostgREST URLs, so fetch injuries in chunks.
      const injuryChunks = chunkArray(nbaPlayerIds, 20);
      const injuryResults = await Promise.all(
        injuryChunks.map((ids) =>
          supabase
            .from('nba_injuries')
            .select('nba_player_id, player_name, injury_status')
            .in('nba_player_id', ids)
            .eq('is_current', true)
            .order('date_updated', { ascending: false })
        )
      );
      const firstInjuryError = injuryResults.find((r) => r.error)?.error;
      if (firstInjuryError) {
        // Fallback gracefully so estimated rotation still renders without injury deltas.
        console.warn('Estimated rotation injury fetch failed; continuing without injury signals:', firstInjuryError);
      }

      const recentMinutes = (minuteRows ?? []) as PlayerRecentMinuteGame[];
      const homeRecentMinutes = recentMinutes.filter((row) => !homeTricode || row.team_tricode === homeTricode);
      const awayRecentMinutes = recentMinutes.filter((row) => !awayTricode || row.team_tricode === awayTricode);
      const homeStarterSummary = buildStarterRateMapFromRecentMinutes(homeRecentMinutes, 10);
      const awayStarterSummary = buildStarterRateMapFromRecentMinutes(awayRecentMinutes, 10);
      const homeStarterRateById = new Map<number, number>();
      homeStarterSummary.forEach((summary, playerId) => homeStarterRateById.set(playerId, summary.starterRate));
      const awayStarterRateById = new Map<number, number>();
      awayStarterSummary.forEach((summary, playerId) => awayStarterRateById.set(playerId, summary.starterRate));
      const injuries = (firstInjuryError
        ? []
        : injuryResults.flatMap((r) => r.data ?? [])) as PlayerInjurySignal[];
      const gameOdds = (gameOddsRows ?? [])[0] as { home_spread?: number | null; away_spread?: number | null } | undefined;
      const homeSpread = typeof gameOdds?.home_spread === 'number' ? gameOdds.home_spread : null;
      const awaySpread = typeof gameOdds?.away_spread === 'number' ? gameOdds.away_spread : null;

      const home = estimateTeamRotationMinutes({
        roster: homeRoster,
        recentMinutes: homeRecentMinutes,
        injuries,
        options: {
          lookbackGames,
          rotationSizeTarget: homeRotationSizeTarget,
          forcedOutPlayerIds: homeForcedOutPlayerIds,
          starterRateByPlayerId: homeStarterRateById,
          spread: homeSpread,
          spreadThreshold: 12,
          benchShiftPct: 0.025,
        },
      });
      const away = estimateTeamRotationMinutes({
        roster: awayRoster,
        recentMinutes: awayRecentMinutes,
        injuries,
        options: {
          lookbackGames,
          rotationSizeTarget: awayRotationSizeTarget,
          forcedOutPlayerIds: awayForcedOutPlayerIds,
          starterRateByPlayerId: awayStarterRateById,
          spread: awaySpread,
          spreadThreshold: 12,
          benchShiftPct: 0.025,
        },
      });

      return { home, away };
    },
    enabled: enabled && homeRoster.length > 0 && awayRoster.length > 0,
    staleTime: 60 * 1000,
  });
}
