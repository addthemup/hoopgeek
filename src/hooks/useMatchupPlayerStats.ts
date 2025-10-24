import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { getScoringFormat, calculateFantasyPoints } from '../utils/fantasyScoring';

interface PlayerGameLog {
  game_id: string;
  game_date: string;
  minutes: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  three_pointers_made: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  free_throws_made: number | null;
  free_throws_attempted: number | null;
}

export interface PlayerStats {
  player_id: string;
  nba_player_id: number;
  averagePoints: number;
  multipliedPoints: number;
  gamesPlayed: number;
  lineup_type: 'starters' | 'rotation' | 'bench';
}

interface UseMatchupPlayerStatsParams {
  weekStartDate: string;
  weekEndDate: string;
  playerIds: string[];
  lineupTypes: Record<string, 'starters' | 'rotation' | 'bench'>;
  scoringFormat: string;
  enabled?: boolean;
}

export function useMatchupPlayerStats({
  weekStartDate,
  weekEndDate,
  playerIds,
  lineupTypes,
  scoringFormat,
  enabled = true,
}: UseMatchupPlayerStatsParams) {
  const format = getScoringFormat(scoringFormat);

  return useQuery({
    queryKey: ['matchup-player-stats', weekStartDate, weekEndDate, playerIds, scoringFormat],
    queryFn: async (): Promise<Record<string, PlayerStats>> => {
      if (playerIds.length === 0) return {};

      console.log('🔍 Fetching matchup player stats:', {
        weekStartDate,
        weekEndDate,
        playerCount: playerIds.length,
      });

      const statsMap: Record<string, PlayerStats> = {};

      // Fetch game logs for all players in parallel
      const promises = playerIds.map(async (playerId) => {
        // Get the player's nba_player_id
        const { data: playerData } = await supabase
          .from('nba_players')
          .select('nba_player_id')
          .eq('id', playerId)
          .single();

        if (!playerData) {
          console.warn(`⚠️ Player ${playerId} not found in nba_players`);
          return null;
        }

        const nbaPlayerId = playerData.nba_player_id;

        // Fetch game logs for this player during the week
        const { data: gameLogs, error } = await supabase
          .from('nba_game_logs')
          .select(`
            game_id,
            game_date,
            minutes,
            points,
            rebounds,
            assists,
            steals,
            blocks,
            turnovers,
            three_pointers_made,
            field_goals_made,
            field_goals_attempted,
            free_throws_made,
            free_throws_attempted
          `)
          .eq('nba_player_id', nbaPlayerId)
          .gte('game_date', weekStartDate)
          .lte('game_date', weekEndDate);

        if (error) {
          console.error(`❌ Error fetching game logs for player ${playerId}:`, error);
          return null;
        }

        const logs = (gameLogs as PlayerGameLog[]) || [];
        const gamesPlayed = logs.length;

        let totalFantasyPoints = 0;

        // Calculate fantasy points for each game
        logs.forEach((log) => {
          const fantasyPoints = calculateFantasyPoints(
            {
              points: log.points || 0,
              rebounds: log.rebounds || 0,
              assists: log.assists || 0,
              steals: log.steals || 0,
              blocks: log.blocks || 0,
              turnovers: log.turnovers || 0,
              threePointersMade: log.three_pointers_made || 0,
              fieldGoalsMade: log.field_goals_made || 0,
              fieldGoalsAttempted: log.field_goals_attempted || 0,
              freeThrowsMade: log.free_throws_made || 0,
              freeThrowsAttempted: log.free_throws_attempted || 0,
            },
            format
          );
          totalFantasyPoints += fantasyPoints;
        });

        const averagePoints = gamesPlayed > 0 ? totalFantasyPoints / gamesPlayed : 0;

        // Get the multiplier based on lineup type
        const lineupType = lineupTypes[playerId] || 'bench';
        let multiplier = 1.0;
        switch (lineupType) {
          case 'starters':
            multiplier = 1.0;
            break;
          case 'rotation':
            multiplier = 0.75;
            break;
          case 'bench':
            multiplier = 0.5;
            break;
        }

        const multipliedPoints = averagePoints * multiplier;

        return {
          player_id: playerId,
          nba_player_id: nbaPlayerId,
          averagePoints,
          multipliedPoints,
          gamesPlayed,
          lineup_type: lineupType,
        };
      });

      const results = await Promise.all(promises);

      // Build the stats map
      results.forEach((stat) => {
        if (stat) {
          statsMap[stat.player_id] = stat;
        }
      });

      console.log('✅ Matchup player stats fetched:', {
        playersWithStats: Object.keys(statsMap).length,
      });

      return statsMap;
    },
    enabled: enabled && playerIds.length > 0 && !!weekStartDate && !!weekEndDate,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute for live updates
  });
}

