import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { UpdateLeagueSettingsFormData } from '../types/leagueSettings'

export function useUpdateLeagueSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ leagueId, settings }: { leagueId: string; settings: UpdateLeagueSettingsFormData }) => {
      console.log('🏀 Updating league settings...', { leagueId, settings })
      
      // Separate settings into league-level and season-level
      const leagueSettings: any = {}
      const seasonSettings: any = {}
      
      // League-level fields (fantasy_leagues table)
      const leagueFields = [
        'name', 'description', 'max_teams', 'commissioner_id', 'public_league',
        'scoring_type', 'draft_type', 'draft_rounds', 'lineup_frequency',
        'invite_code', 'season_year', 'salary_cap_enabled', 'trades_enabled',
        'commissioner_notes', 'league_type', 'fantasy_scoring_format'
      ]
      
      // Season-level fields (fantasy_league_seasons table)
      const seasonFields = [
        'salary_cap_amount', 'roster_positions',
        'starters_count', 'starters_multiplier', 'rotation_count', 'rotation_multiplier',
        'bench_count', 'bench_multiplier', 'playoff_teams', 'playoff_weeks',
        'trade_deadline', 'position_unit_assignments', 'draft_date', 'draft_status',
        'is_active', 'season_status', 'current_teams', 'season_year',
        // New waiver system fields
        'waiver_type', 'waiver_period_hours', 'waiver_budget_amount', 'waiver_min_bid',
        'waiver_priority_reset', 'waiver_process_time',
        // Additional settings
        'draft_time_per_pick', 'draft_order_method', 'salary_cap_soft', 'salary_cap_penalty',
        'trade_limit', 'trade_salary_matching', 'trade_salary_tolerance',
        'trade_veto_votes_required', 'allow_draft_pick_trades',
        'roster_size', 'total_starters', 'total_bench', 'total_ir'
      ]
      
      // Split settings
      Object.keys(settings).forEach((key) => {
        if (leagueFields.includes(key)) {
          leagueSettings[key] = settings[key as keyof UpdateLeagueSettingsFormData]
        } else if (seasonFields.includes(key)) {
          seasonSettings[key] = settings[key as keyof UpdateLeagueSettingsFormData]
        }
      })
      
      console.log('📊 Split settings:', { leagueSettings, seasonSettings })
      
      // Update league table if needed
      if (Object.keys(leagueSettings).length > 0) {
        const { error: leagueError } = await supabase
          .from('fantasy_leagues')
          .update(leagueSettings)
          .eq('id', leagueId)

        if (leagueError) {
          console.error('❌ Error updating fantasy_leagues:', leagueError)
          throw new Error(`Failed to update league: ${leagueError.message}`)
        }
        console.log('✅ League table updated')
      }
      
      // Update season table if needed
      if (Object.keys(seasonSettings).length > 0) {
        // Get the most recent season for this league
        const { data: seasons, error: seasonsError } = await supabase
          .from('fantasy_league_seasons')
          .select('id')
          .eq('league_id', leagueId)
          .order('season_year', { ascending: false })
          .limit(1)
        
        if (seasonsError) {
          console.error('❌ Error fetching seasons:', seasonsError)
          throw new Error(`Failed to fetch seasons: ${seasonsError.message}`)
        }
        
        if (!seasons || seasons.length === 0) {
          throw new Error('No season found for this league')
        }
        
        const seasonId = seasons[0].id
        console.log('📅 Updating season:', seasonId)
        
        const { error: seasonError } = await supabase
          .from('fantasy_league_seasons')
          .update(seasonSettings)
          .eq('id', seasonId)

        if (seasonError) {
          console.error('❌ Error updating fantasy_league_seasons:', seasonError)
          throw new Error(`Failed to update season: ${seasonError.message}`)
        }
        console.log('✅ Season table updated')
      }

      // Fetch updated data
      const { data: updatedLeague, error: fetchError } = await supabase
        .from('fantasy_leagues')
        .select('*')
        .eq('id', leagueId)
        .single()

      if (fetchError) {
        console.error('❌ Error fetching updated league:', fetchError)
        throw new Error(`Failed to fetch updated league: ${fetchError.message}`)
      }

      console.log('✅ League settings updated successfully')
      return updatedLeague
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['league', variables.leagueId] })
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
      console.log('✅ Queries invalidated, data will refresh')
    },
  })
}
