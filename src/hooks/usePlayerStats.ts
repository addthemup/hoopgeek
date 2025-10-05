import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerStats {
  player: {
    id: number;
    name: string;
    position: string;
    team: string;
    jersey: string;
    height: string;
    weight: number;
    age: number;
    experience: number;
    college: string;
    draftYear: number;
    draftRound: number;
    draftNumber: number;
  };
  seasonStats: {
    gamesPlayed: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fieldGoalPercentage: number;
    threePointPercentage: number;
    freeThrowPercentage: number;
    minutes: number;
    fantasyPoints: number;
  };
  recentGames: Array<{
    date: string;
    opponent: string;
    points: number;
    rebounds: number;
    assists: number;
    fantasyPoints: number;
  }>;
}

export function usePlayerStats(playerId: string) {
  return useQuery<PlayerStats, Error>({
    queryKey: ['player-stats', playerId],
    queryFn: async () => {
      console.log(`🏀 Fetching detailed stats for player ${playerId}...`);
      
      const { data, error } = await supabase.functions.invoke('player-stats', {
        body: { playerId }
      });

      if (error) {
        console.error('❌ Error fetching player stats:', error);
        throw new Error(`Failed to fetch player stats: ${error.message}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('✅ Successfully fetched player stats for:', data.player.name);
      return data as PlayerStats;
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
