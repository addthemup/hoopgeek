import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface DraftSettings {
  id: string
  league_id: string
  draft_type: 'snake' | 'linear' | 'auction'
  draft_rounds: number
  roster_positions: Record<string, number>
  scoring_categories: Record<string, number>
  waiver_wire: boolean
  waiver_period_days: number
  max_trades_per_team: number
  max_adds_per_team: number
  playoff_teams: number
  playoff_weeks: number
  playoff_start_week: number
  keeper_league: boolean
  max_keepers: number
  public_league: boolean
  allow_duplicate_players: boolean
  lineup_deadline: string
  lineup_lock_time: string
  created_at: string
}

export function useDraftSettings(leagueId: string) {
  return useQuery({
    queryKey: ['draft-settings', leagueId],
    queryFn: async () => {
      console.log(`🏀 Fetching draft settings for league ${leagueId}...`)
      
      const { data, error } = await supabase
        .from('fantasy_leagues')
        .select('*')
        .eq('id', leagueId)
        .single()

      if (error) {
        console.error('❌ Error fetching draft settings:', error)
        throw new Error(`Error fetching draft settings: ${error.message}`)
      }

      console.log(`✅ Successfully fetched draft settings`)
      return data as DraftSettings
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useUpdateDraftSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      leagueId, 
      updates 
    }: { 
      leagueId: string; 
      updates: Partial<DraftSettings>
    }) => {
      const { data, error } = await supabase
        .from('league_settings')
        .update(updates)
        .eq('league_id', leagueId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['draft-settings', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
    },
  })
}

export function useCreateDraftSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      leagueId, 
      settings 
    }: { 
      leagueId: string; 
      settings: Partial<DraftSettings>
    }) => {
      const { data, error } = await supabase
        .from('league_settings')
        .insert({
          league_id: leagueId,
          ...settings
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['draft-settings', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
    },
  })
}
