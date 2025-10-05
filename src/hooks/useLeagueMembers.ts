import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface LeagueMember {
  id: string
  user_id: string | null
  team_name: string
  is_commissioner: boolean
  joined_at: string
  is_online: boolean
  last_seen_at: string | null
  fantasy_team_id: string
}

export function useLeagueMembers(leagueId: string) {
  return useQuery({
    queryKey: ['league-members', leagueId],
    queryFn: async () => {
      // Get all league members
      const { data: members, error: membersError } = await supabase
        .from('league_members')
        .select(`
          id,
          user_id,
          team_name,
          is_commissioner,
          joined_at
        `)
        .eq('league_id', leagueId)
        .order('joined_at', { ascending: true })

      if (membersError) {
        console.error('Error fetching league members:', membersError)
        throw new Error(`Failed to fetch league members: ${membersError.message}`)
      }

      // Get fantasy teams for each member
      const { data: teams, error: teamsError } = await supabase
        .from('fantasy_teams')
        .select(`
          id,
          user_id,
          team_name
        `)
        .eq('league_id', leagueId)

      if (teamsError) {
        console.error('Error fetching fantasy teams:', teamsError)
        throw new Error(`Failed to fetch fantasy teams: ${teamsError.message}`)
      }

      // Get online status from draft lobby participants
      const { data: lobbyParticipants, error: lobbyError } = await supabase
        .from('draft_lobby_participants')
        .select(`
          user_id,
          is_online,
          last_seen_at
        `)
        .eq('league_id', leagueId)

      if (lobbyError) {
        console.error('Error fetching lobby participants:', lobbyError)
        // Don't throw error here, just continue without online status
      }

      // Combine the data
      const membersWithStatus: LeagueMember[] = members.map(member => {
        const team = teams.find(t => t.user_id === member.user_id)
        const lobbyParticipant = lobbyParticipants?.find(p => p.user_id === member.user_id)
        
        return {
          id: member.id,
          user_id: member.user_id,
          team_name: member.team_name,
          is_commissioner: member.is_commissioner,
          joined_at: member.joined_at,
          is_online: lobbyParticipant?.is_online || false,
          last_seen_at: lobbyParticipant?.last_seen_at || null,
          fantasy_team_id: team?.id || ''
        }
      })

      return membersWithStatus
    },
    enabled: !!leagueId,
    refetchInterval: 5000, // Refetch every 5 seconds to update online status
  })
}
