import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { DraftChatMessage } from '../types'

export function useDraftChatMessages(leagueId: string) {
  return useQuery({
    queryKey: ['draft-chat-messages', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_draft_chat_messages')
        .select(`
          *,
          fantasy_team:fantasy_team_id (
            team_name
          )
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching draft chat messages:', error)
        throw new Error(`Failed to fetch draft chat messages: ${error.message}`)
      }

      return data as DraftChatMessage[]
    },
    enabled: !!leagueId,
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  })
}

export function useSendDraftChatMessage() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      leagueId, 
      fantasyTeamId, 
      message, 
      messageType = 'chat' 
    }: { 
      leagueId: string
      fantasyTeamId: string
      message: string
      messageType?: 'chat' | 'system' | 'pick_announcement' | 'trade_announcement'
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('fantasy_draft_chat_messages')
        .insert({
          league_id: leagueId,
          user_id: user.id,
          fantasy_team_id: fantasyTeamId,
          message,
          message_type: messageType,
          is_commissioner_message: false // TODO: Check if user is commissioner
        })
        .select()
        .single()

      if (error) {
        console.error('Error sending draft chat message:', error)
        throw new Error(`Failed to send message: ${error.message}`)
      }

      return data
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch chat messages
      queryClient.invalidateQueries({ queryKey: ['draft-chat-messages', variables.leagueId] })
    },
  })
}
