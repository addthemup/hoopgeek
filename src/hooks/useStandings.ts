import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface StandingsTeam {
  id: string;
  team_id: number;
  team_abbreviation: string;
  team_name: string;
  conference: 'East' | 'West';
  wins: number;
  losses: number;
  win_percentage: number;
  games_behind: number;
  conference_rank: number;
  division: string | null;
  division_rank: number | null;
  home_wins: number;
  home_losses: number;
  away_wins: number;
  away_losses: number;
  last_10_wins: number;
  last_10_losses: number;
  streak: string | null;
  season: string;
  updated_at: string;
}

export interface StandingsData {
  east: StandingsTeam[];
  west: StandingsTeam[];
  season: string;
  lastUpdated: string;
}

export function useStandings() {
  return useQuery({
    queryKey: ['nba-standings'],
    queryFn: async (): Promise<StandingsData> => {
      // Get current season
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const season = month >= 10 
        ? `${year}-${(year + 1).toString().slice(-2)}`
        : `${year - 1}-${year.toString().slice(-2)}`;

      // Fetch standings for current season
      const { data, error } = await supabase
        .from('nba_standings')
        .select('*')
        .eq('season', season)
        .order('conference', { ascending: true })
        .order('conference_rank', { ascending: true });

      if (error) {
        console.error('Error fetching standings:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        // Return empty standings if no data
        return {
          east: [],
          west: [],
          season,
          lastUpdated: new Date().toISOString(),
        };
      }

      // Separate by conference
      const east = data.filter(team => team.conference === 'East');
      const west = data.filter(team => team.conference === 'West');

      // Calculate proper conference ranks with tiebreaker handling
      const calculateRanks = (teams: StandingsTeam[]): StandingsTeam[] => {
        // Create a copy to avoid mutating the original
        const teamsCopy = teams.map(team => ({ ...team }));
        
        // Sort by win percentage (descending), then by wins (descending) as tiebreaker
        const sorted = teamsCopy.sort((a, b) => {
          if (b.win_percentage !== a.win_percentage) {
            return b.win_percentage - a.win_percentage;
          }
          // If win percentage is tied, use wins as tiebreaker
          return b.wins - a.wins;
        });

        // Assign ranks with tiebreaker logic (1, 2, 3, 3, 5, 6, 7, 8...)
        for (let i = 0; i < sorted.length; i++) {
          const team = sorted[i];
          
          if (i === 0) {
            // First team always gets rank 1
            team.conference_rank = 1;
          } else {
            const prevTeam = sorted[i - 1];
            // Check if this team has the same record as previous (tied)
            if (team.win_percentage === prevTeam.win_percentage && team.wins === prevTeam.wins) {
              // Same rank as previous team (tie)
              team.conference_rank = prevTeam.conference_rank;
            } else {
              // Different record - need to calculate next rank
              // Count how many teams share the previous rank
              let tiedCount = 0;
              for (let j = i - 1; j >= 0; j--) {
                if (sorted[j].conference_rank === prevTeam.conference_rank) {
                  tiedCount++;
                } else {
                  break;
                }
              }
              
              // If previous rank had ties, skip ranks (e.g., if rank 3 had 2 teams, next is 5)
              let rank: number;
              if (tiedCount > 1) {
                rank = prevTeam.conference_rank + tiedCount;
              } else {
                rank = prevTeam.conference_rank + 1;
              }
              
              team.conference_rank = rank;
            }
          }
        }

        return sorted;
      };

      const eastRanked = calculateRanks(east);
      const westRanked = calculateRanks(west);

      // Get most recent updated_at
      const lastUpdated = data.reduce((latest, team) => {
        return new Date(team.updated_at) > new Date(latest) ? team.updated_at : latest;
      }, data[0].updated_at);

      return {
        east: eastRanked,
        west: westRanked,
        season,
        lastUpdated,
      };
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchInterval: 1000 * 60 * 60, // Refetch every hour
  });
}

