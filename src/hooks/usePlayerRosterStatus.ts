import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerRosterStatus {
  isOnRoster: boolean;
  teamId?: string;
  teamName?: string;
  isOnUserTeam: boolean;
}

export function usePlayerRosterStatus(playerId: string, leagueId: string, userTeamId?: string) {
  return useQuery<PlayerRosterStatus, Error>({
    queryKey: ['player-roster-status', playerId, leagueId],
    queryFn: async () => {
      if (!playerId || !leagueId) {
        return {
          isOnRoster: false,
          isOnUserTeam: false
        };
      }

      console.log('🔍 Checking roster status for player:', playerId, 'in league:', leagueId);

      // Check if player is on any roster in this league
      const { data: rosterData, error } = await supabase
        .from('fantasy_roster_spots')
        .select(`
          fantasy_team_id,
          fantasy_teams!inner (
            id,
            team_name,
            user_id,
            league_id
          )
        `)
        .eq('player_id', playerId)
        .eq('fantasy_teams.league_id', leagueId)
        .not('player_id', 'is', null);

      if (error) {
        console.error('❌ Error checking player roster status:', error);
        throw new Error(`Failed to check player roster status: ${error.message}`);
      }

      if (!rosterData || rosterData.length === 0) {
        console.log('✅ Player is not on any roster');
        return {
          isOnRoster: false,
          isOnUserTeam: false
        };
      }

      const rosterEntry = rosterData[0];
      const team = rosterEntry.fantasy_teams;
      const isOnUserTeam = userTeamId ? team.id === userTeamId : false;

      console.log('✅ Player roster status:', {
        isOnRoster: true,
        teamId: team.id,
        teamName: team.team_name,
        isOnUserTeam
      });

      return {
        isOnRoster: true,
        teamId: team.id,
        teamName: team.team_name,
        isOnUserTeam
      };
    },
    enabled: !!playerId && !!leagueId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
