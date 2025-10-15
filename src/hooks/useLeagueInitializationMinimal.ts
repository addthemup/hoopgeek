import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { LeagueSettings, LeagueCreationData } from '../types/leagueSettings'
import { FantasyTeam } from '../types'

export function useCreateLeagueMinimal() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (creationData: LeagueCreationData) => {
      console.log('🏀 Starting minimal league creation process...')
      console.log('📋 Creation data:', creationData)
      
      const { settings, commissioner_team_name, auto_fill_teams, invite_emails } = creationData
      
      // Validate required fields
      if (!settings.commissioner_id) {
        throw new Error('Commissioner ID is required')
      }
      
      if (!settings.name) {
        throw new Error('League name is required')
      }
      
      console.log('✅ Validation passed, proceeding with league creation...')
      
      // Call the Edge Function to create the league with roster configuration
      console.log('📝 Creating league via Edge Function...')
      console.log('🔧 Settings being sent:', settings);
      console.log('🔧 Position unit assignments:', settings.position_unit_assignments);
      
      const edgeFunctionBody = {
        name: settings.name,
        description: settings.description,
        maxTeams: settings.max_teams,
        scoringType: settings.scoring_type,
        teamName: commissioner_team_name,
        rosterConfig: settings.roster_positions,
        draftDate: settings.draft_date,
        tradeDeadline: settings.trade_deadline,
        salaryCapAmount: settings.salary_cap_amount || 200000000,
        startersCount: settings.starters_count,
        startersMultiplier: settings.starters_multiplier,
        rotationCount: settings.rotation_count,
        rotationMultiplier: settings.rotation_multiplier,
        benchCount: settings.bench_count,
        benchMultiplier: settings.bench_multiplier,
        positionUnitAssignments: settings.position_unit_assignments,
        fantasyScoringFormat: settings.fantasy_scoring_format
      };
      
      console.log('🔧 ===== EDGE FUNCTION BODY =====');
      console.log('🔧 Edge Function Body:', JSON.stringify(edgeFunctionBody, null, 2));
      console.log('🔧 ==============================');
      
      const { data, error } = await supabase.functions.invoke('create-league', {
        body: edgeFunctionBody
      })

      if (error) {
        console.error('❌ Error creating league:', error)
        throw new Error(`Failed to create league: ${error.message}`)
      }

      console.log('✅ League created via Edge Function:', data)
      return {
        league: data.league,
        commissionerTeam: data.league.fantasy_teams?.[0],
        totalTeams: settings.max_teams,
      }
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
      queryClient.invalidateQueries({ queryKey: ['league', data.league.id] })
      queryClient.invalidateQueries({ queryKey: ['league-teams', data.league.id] })
    },
  })
}
