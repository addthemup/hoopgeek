import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { LeagueInvitation, LeagueMember } from '../types'

export function useLeagueInvitations(leagueId: string) {
  return useQuery({
    queryKey: ['league-invitations', leagueId],
    queryFn: async () => {
      console.log(`📧 Fetching invitations for league ${leagueId}...`)
      
      const { data, error } = await supabase
        .from('league_invitations')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching league invitations:', error)
        throw new Error(`Error fetching invitations: ${error.message}`)
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} invitations`)
      return data as LeagueInvitation[]
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useLeagueMembers(leagueId: string) {
  return useQuery({
    queryKey: ['league-members', leagueId],
    queryFn: async () => {
      console.log(`👥 Fetching members for league ${leagueId}...`)
      
      const { data, error } = await supabase
        .from('league_members')
        .select(`
          *,
          user:user_id (
            id,
            email,
            name
          )
        `)
        .eq('league_id', leagueId)
        .order('joined_at', { ascending: true })

      if (error) {
        console.error('❌ Error fetching league members:', error)
        throw new Error(`Error fetching members: ${error.message}`)
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} members`)
      return data as LeagueMember[]
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useSendInvitation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      leagueId,
      email,
      teamName,
      message,
      invitedBy,
    }: {
      leagueId: string
      email: string
      teamName?: string
      message?: string
      invitedBy: string
    }) => {
      console.log(`📧 Sending invitation to ${email} for league ${leagueId}...`)
      
      // Set expiration date to 7 days from now
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)
      
      const { data, error } = await supabase
        .from('league_invitations')
        .insert({
          league_id: leagueId,
          email: email.toLowerCase().trim(),
          invited_by: invitedBy,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
          team_name: teamName,
          message: message,
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Error sending invitation:', error)
        throw new Error(`Error sending invitation: ${error.message}`)
      }

      console.log('✅ Successfully sent invitation')
      return data as LeagueInvitation
    },
    onSuccess: (data) => {
      // Invalidate and refetch invitations
      queryClient.invalidateQueries({ 
        queryKey: ['league-invitations', data.league_id] 
      })
    },
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (invitationId: string) => {
      console.log(`❌ Cancelling invitation ${invitationId}...`)
      
      const { error } = await supabase
        .from('league_invitations')
        .delete()
        .eq('id', invitationId)

      if (error) {
        console.error('❌ Error cancelling invitation:', error)
        throw new Error(`Error cancelling invitation: ${error.message}`)
      }

      console.log('✅ Successfully cancelled invitation')
    },
    onSuccess: () => {
      // Invalidate invitations queries
      queryClient.invalidateQueries({ queryKey: ['league-invitations'] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ memberId, leagueId }: { memberId: string; leagueId: string }) => {
      console.log(`👋 Removing member ${memberId} from league ${leagueId}...`)
      
      const { error } = await supabase
        .from('league_members')
        .delete()
        .eq('id', memberId)

      if (error) {
        console.error('❌ Error removing member:', error)
        throw new Error(`Error removing member: ${error.message}`)
      }

      console.log('✅ Successfully removed member')
    },
    onSuccess: (_, { leagueId }) => {
      // Invalidate members queries
      queryClient.invalidateQueries({ 
        queryKey: ['league-members', leagueId] 
      })
    },
  })
}

// Note: These hooks are ready for when we have the database tables set up
// The actual database tables would need to be created in Supabase:
// - league_invitations
// - league_members
// - users (if not already exists)
