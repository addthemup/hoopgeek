import { useQuery } from '@tanstack/react-query';
import { getPlayerPropHitRateToday, PlayerPropHitRate } from '../utils/playerPropsCalculator';

/**
 * Hook to fetch player prop hit rate for today
 * Returns the percentage of overs the player hit today
 */
export function usePlayerPropHitRate(nbaPlayerId: number | null) {
  return useQuery<PlayerPropHitRate | null, Error>({
    queryKey: ['player-prop-hit-rate', nbaPlayerId],
    queryFn: async () => {
      if (!nbaPlayerId) return null;
      
      console.log(`🎲 Fetching prop hit rate for player ${nbaPlayerId}...`);
      const hitRate = await getPlayerPropHitRateToday(nbaPlayerId);
      
      if (hitRate) {
        console.log(`✅ Player ${nbaPlayerId} hit rate: ${hitRate.hitRate.toFixed(1)}% (${hitRate.oversHit}/${hitRate.totalProps} overs) - ${hitRate.trend}`);
      } else {
        console.log(`ℹ️ No hit rate data available for player ${nbaPlayerId}`);
      }
      
      return hitRate;
    },
    enabled: !!nbaPlayerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

