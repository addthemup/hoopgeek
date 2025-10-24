import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface LineupSalaryData {
  totalSalary: number;
  salaryCap: number;
  remainingCap: number;
  isOverCap: boolean;
  percentUsed: number;
  playerSalaries: Record<string, number>; // player_id -> salary mapping
}

/**
 * Hook to get the salary cap for a league season
 */
export function useLeagueSalaryCap(leagueId: string, seasonYear: number = 2025) {
  return useQuery<number, Error>({
    queryKey: ['league-salary-cap', leagueId, seasonYear],
    queryFn: async () => {
      console.log('💰 Fetching salary cap for league:', leagueId, 'season:', seasonYear);
      
      const { data, error } = await supabase
        .from('fantasy_league_seasons')
        .select('salary_cap_amount')
        .eq('league_id', leagueId)
        .eq('season_year', seasonYear)
        .single();

      if (error) {
        console.error('❌ Error fetching salary cap:', error);
        // Return default cap of $200M if not found
        return 200000000;
      }

      const salaryCap = data?.salary_cap_amount || 200000000;
      console.log('✅ Salary cap:', salaryCap);
      return salaryCap;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to calculate the total salary of all players in a lineup
 */
export function useLineupSalary(
  leagueId: string,
  teamId: string,
  weekNumber: number,
  seasonYear: number = 2025
) {
  const { data: salaryCap } = useLeagueSalaryCap(leagueId, seasonYear);

  return useQuery<LineupSalaryData, Error>({
    queryKey: ['lineup-salary', leagueId, teamId, weekNumber, seasonYear],
    queryFn: async () => {
      console.log('💰 Calculating lineup salary for team:', teamId, 'week:', weekNumber);
      
      // Get all lineup positions for this team/week
      const { data: lineupData, error: lineupError } = await supabase
        .from('fantasy_lineups')
        .select('player_id')
        .eq('league_id', leagueId)
        .eq('fantasy_team_id', teamId)
        .eq('week_number', weekNumber)
        .eq('season_year', seasonYear);

      if (lineupError) {
        console.error('❌ Error fetching lineup:', lineupError);
        throw lineupError;
      }

      if (!lineupData || lineupData.length === 0) {
        console.log('✅ No players in lineup yet');
        return {
          totalSalary: 0,
          salaryCap: salaryCap || 200000000,
          remainingCap: salaryCap || 200000000,
          isOverCap: false,
          percentUsed: 0,
          playerSalaries: {}
        };
      }

      // Get unique player IDs
      const playerIds = [...new Set(lineupData.map(l => l.player_id))];
      console.log('💰 Found', playerIds.length, 'unique players in lineup');
      console.log('💰 Player IDs:', playerIds);

      // Fetch salary data for all players
      const { data: salaryData, error: salaryError } = await supabase
        .from('nba_players')
        .select(`
          id,
          nba_hoopshype_salaries!player_id (
            salary_2025_26
          )
        `)
        .in('id', playerIds);

      if (salaryError) {
        console.error('❌ Error fetching salary data:', salaryError);
        throw salaryError;
      }

      console.log('💰 Raw salary data from database:', salaryData);

      // Calculate total salary
      let totalSalary = 0;
      const playerSalaries: Record<string, number> = {};

      salaryData?.forEach((player: any) => {
        const salary = player.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0;
        console.log(`💰 Player ${player.id}: salary = ${salary}`);
        playerSalaries[player.id] = salary;
        totalSalary += salary;
      });

      const capAmount = salaryCap || 200000000;
      const remainingCap = capAmount - totalSalary;
      const isOverCap = totalSalary > capAmount;
      const percentUsed = (totalSalary / capAmount) * 100;

      console.log('✅ Lineup salary calculated:', {
        totalSalary,
        salaryCap: capAmount,
        remainingCap,
        isOverCap,
        percentUsed: percentUsed.toFixed(1) + '%'
      });

      return {
        totalSalary,
        salaryCap: capAmount,
        remainingCap,
        isOverCap,
        percentUsed,
        playerSalaries
      };
    },
    enabled: !!leagueId && !!teamId && weekNumber !== undefined && !!salaryCap,
    staleTime: 1000 * 30, // 30 seconds - refresh frequently since lineup changes
    refetchOnMount: 'always', // Always refetch to ensure fresh data
  });
}

/**
 * Hook to get a single player's salary
 */
export function usePlayerSalary(playerId: string, seasonYear: number = 2025) {
  return useQuery<number, Error>({
    queryKey: ['player-salary', playerId, seasonYear],
    queryFn: async () => {
      if (!playerId) return 0;
      
      const { data, error } = await supabase
        .from('nba_players')
        .select(`
          nba_hoopshype_salaries!player_id (
            salary_2025_26
          )
        `)
        .eq('id', playerId)
        .single();

      if (error) {
        console.error('❌ Error fetching player salary:', error);
        return 0;
      }

      return data?.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0;
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Utility function to format salary as millions
 */
export function formatSalary(salary: number): string {
  if (salary === 0) return '$0M';
  const millions = salary / 1000000;
  return `$${millions.toFixed(1)}M`;
}

/**
 * Utility function to check if adding a player would exceed cap
 */
export function wouldExceedCap(
  currentSalary: number,
  playerSalary: number,
  salaryCap: number
): boolean {
  return (currentSalary + playerSalary) > salaryCap;
}

