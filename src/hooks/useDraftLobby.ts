import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { DraftLobbyParticipant } from '../types'

export function useDraftLobbyParticipants(leagueId: string) {
  return useQuery({
    queryKey: ['draft-lobby-participants', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_lobby_participants')
        .select(`
          *,
          fantasy_team:fantasy_team_id (
            team_name
          )
        `)
        .eq('league_id', leagueId)
        .eq('is_online', true)
        .order('joined_at', { ascending: true })

      if (error) {
        console.error('Error fetching draft lobby participants:', error)
        throw new Error(`Failed to fetch draft lobby participants: ${error.message}`)
      }

      return data as DraftLobbyParticipant[]
    },
    enabled: !!leagueId,
    refetchInterval: 5000, // Refetch every 5 seconds to update online status
  })
}

export function useJoinDraftLobby() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ leagueId, fantasyTeamId }: { leagueId: string; fantasyTeamId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      console.log('🚀 Joining draft lobby:', { leagueId, userId: user.id, fantasyTeamId });

      const { data, error } = await supabase
        .from('draft_lobby_participants')
        .upsert({
          league_id: leagueId,
          user_id: user.id,
          fantasy_team_id: fantasyTeamId,
          is_online: true,
          last_seen_at: new Date().toISOString()
        }, {
          onConflict: 'league_id,user_id'
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Error joining draft lobby:', error)
        throw new Error(`Failed to join draft lobby: ${error.message}`)
      }

      console.log('✅ Successfully joined draft lobby:', data);
      return data
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch lobby participants
      queryClient.invalidateQueries({ queryKey: ['draft-lobby-participants', variables.leagueId] })
    },
  })
}

export function useLeaveDraftLobby() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ leagueId }: { leagueId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('draft_lobby_participants')
        .delete()
        .eq('league_id', leagueId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error leaving draft lobby:', error)
        throw new Error(`Failed to leave draft lobby: ${error.message}`)
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch lobby participants
      queryClient.invalidateQueries({ queryKey: ['draft-lobby-participants', variables.leagueId] })
    },
  })
}

export function useUpdateLobbyStatus() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ leagueId }: { leagueId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('draft_lobby_participants')
        .update({
          last_seen_at: new Date().toISOString(),
          is_online: true
        })
        .eq('league_id', leagueId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating lobby status:', error)
        throw new Error(`Failed to update lobby status: ${error.message}`)
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch lobby participants
      queryClient.invalidateQueries({ queryKey: ['draft-lobby-participants', variables.leagueId] })
    },
  })
}
