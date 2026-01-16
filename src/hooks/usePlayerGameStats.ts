import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerGameStat {
  id: string;
  player_id: string;
  game_id: string;
  season_year: string;
  advanced_playerefficiencyrating: number | null;
  advanced_offensiverating: number | null;
  advanced_defensiverating: number | null;
  advanced_netrating: number | null;
  advanced_trueshootingpercentage: number | null;
  advanced_usagepercentage: number | null;
  advanced_assistratio: number | null;
  advanced_reboundpercentage: number | null;
  advanced_pace: number | null;
  fourfactors_effectivefieldgoalpercentage: number | null;
  fourfactors_freethrowattemptrate: number | null;
  fourfactors_offensivereboundpercentage: number | null;
  fourfactors_turnoverpercentage: number | null;
  hustle_contestedshots: number | null;
  hustle_contestedshots3pt: number | null;
  hustle_deflections: number | null;
  hustle_looseballsrecovered: number | null;
  hustle_chargesdrawn: number | null;
  hustle_screenassists: number | null;
  misc_pointsoffturnovers: number | null;
  misc_pointssecondchance: number | null;
  misc_pointsfastbreak: number | null;
  misc_pointspaint: number | null;
  playertrack_touches: number | null;
  playertrack_passes: number | null;
  playertrack_timeofpossession: number | null;
  playertrack_contestedfieldgoalpercentage: number | null;
  playertrack_uncontestedfieldgoalspercentage: number | null;
  playertrack_defendedatrimfieldgoalpercentage: number | null;
  scoring_restrictedareafieldgoalspercentage: number | null;
  scoring_paintfieldgoalspercentage: number | null;
  scoring_midrangefieldgoalspercentage: number | null;
  scoring_abovethebreak3fieldgoalspercentage: number | null;
  scoring_corner3fieldgoalspercentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerGameStatsResponse {
  stats: PlayerGameStat[];
  seasonAverages: {
    advanced_offensiverating: number;
    advanced_defensiverating: number;
    advanced_netrating: number;
    advanced_trueshootingpercentage: number;
    advanced_usagepercentage: number;
    advanced_assistratio: number;
    advanced_reboundpercentage: number;
    advanced_pace: number;
    fourfactors_effectivefieldgoalpercentage: number;
    fourfactors_freethrowattemptrate: number;
    fourfactors_offensivereboundpercentage: number;
    fourfactors_turnoverpercentage: number;
  };
}

export function usePlayerGameStats(playerId: string, seasonYear?: string) {
  return useQuery<PlayerGameStatsResponse, Error>({
    queryKey: ['player-game-stats', playerId, seasonYear],
    queryFn: async () => {
      console.log(`📊 Fetching player game stats for player ${playerId}...`);
      
      let query = supabase
        .from('nba_player_game_stats')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });

      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching player game stats:', error);
        throw new Error(`Failed to fetch player game stats: ${error.message}`);
      }

      const stats = (data || []) as PlayerGameStat[];

      // Calculate season averages
      const validStats = stats.filter(s => 
        s.advanced_offensiverating !== null || 
        s.advanced_defensiverating !== null ||
        s.advanced_trueshootingpercentage !== null
      );

      const seasonAverages = {
        advanced_offensiverating: 0,
        advanced_defensiverating: 0,
        advanced_netrating: 0,
        advanced_trueshootingpercentage: 0,
        advanced_usagepercentage: 0,
        advanced_assistratio: 0,
        advanced_reboundpercentage: 0,
        advanced_pace: 0,
        fourfactors_effectivefieldgoalpercentage: 0,
        fourfactors_freethrowattemptrate: 0,
        fourfactors_offensivereboundpercentage: 0,
        fourfactors_turnoverpercentage: 0,
      };

      if (validStats.length > 0) {
        const sums = validStats.reduce((acc, stat) => {
          if (stat.advanced_offensiverating !== null) acc.advanced_offensiverating += stat.advanced_offensiverating;
          if (stat.advanced_defensiverating !== null) acc.advanced_defensiverating += stat.advanced_defensiverating;
          if (stat.advanced_netrating !== null) acc.advanced_netrating += stat.advanced_netrating;
          if (stat.advanced_trueshootingpercentage !== null) acc.advanced_trueshootingpercentage += stat.advanced_trueshootingpercentage;
          if (stat.advanced_usagepercentage !== null) acc.advanced_usagepercentage += stat.advanced_usagepercentage;
          if (stat.advanced_assistratio !== null) acc.advanced_assistratio += stat.advanced_assistratio;
          if (stat.advanced_reboundpercentage !== null) acc.advanced_reboundpercentage += stat.advanced_reboundpercentage;
          if (stat.advanced_pace !== null) acc.advanced_pace += stat.advanced_pace;
          if (stat.fourfactors_effectivefieldgoalpercentage !== null) acc.fourfactors_effectivefieldgoalpercentage += stat.fourfactors_effectivefieldgoalpercentage;
          if (stat.fourfactors_freethrowattemptrate !== null) acc.fourfactors_freethrowattemptrate += stat.fourfactors_freethrowattemptrate;
          if (stat.fourfactors_offensivereboundpercentage !== null) acc.fourfactors_offensivereboundpercentage += stat.fourfactors_offensivereboundpercentage;
          if (stat.fourfactors_turnoverpercentage !== null) acc.fourfactors_turnoverpercentage += stat.fourfactors_turnoverpercentage;
          return acc;
        }, { ...seasonAverages });

        const count = validStats.length;
        seasonAverages.advanced_offensiverating = sums.advanced_offensiverating / count;
        seasonAverages.advanced_defensiverating = sums.advanced_defensiverating / count;
        seasonAverages.advanced_netrating = sums.advanced_netrating / count;
        seasonAverages.advanced_trueshootingpercentage = sums.advanced_trueshootingpercentage / count;
        seasonAverages.advanced_usagepercentage = sums.advanced_usagepercentage / count;
        seasonAverages.advanced_assistratio = sums.advanced_assistratio / count;
        seasonAverages.advanced_reboundpercentage = sums.advanced_reboundpercentage / count;
        seasonAverages.advanced_pace = sums.advanced_pace / count;
        seasonAverages.fourfactors_effectivefieldgoalpercentage = sums.fourfactors_effectivefieldgoalpercentage / count;
        seasonAverages.fourfactors_freethrowattemptrate = sums.fourfactors_freethrowattemptrate / count;
        seasonAverages.fourfactors_offensivereboundpercentage = sums.fourfactors_offensivereboundpercentage / count;
        seasonAverages.fourfactors_turnoverpercentage = sums.fourfactors_turnoverpercentage / count;
      }

      return {
        stats,
        seasonAverages,
      };
    },
    enabled: !!playerId,
  });
}

