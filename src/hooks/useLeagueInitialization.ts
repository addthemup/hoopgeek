import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { LeagueSettings, LeagueCreationData, DraftOrder, LeagueState } from '../types/leagueSettings'
import { FantasyTeam } from '../types'

export function useCreateLeague() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (creationData: LeagueCreationData) => {
      console.log('🏀 Starting league creation process...')
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
      
      // Step 1: Create the league record
      console.log('📝 Creating league record...')
      const leagueData = {
        name: settings.name,
        description: settings.description,
        commissioner_id: settings.commissioner_id,
        max_teams: settings.max_teams,
        draft_date: settings.draft_date,
        draft_status: 'scheduled',
        scoring_type: settings.scoring_type,
        lineup_frequency: settings.lineup_deadline,
        salary_cap_enabled: settings.salary_cap_enabled,
        salary_cap_amount: settings.salary_cap_amount,
      }
      console.log('📝 League data to insert:', leagueData)
      
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert(leagueData)
        .select()
        .single()

      if (leagueError) {
        console.error('❌ Error creating league:', leagueError)
        throw new Error(`Failed to create league: ${leagueError.message}`)
      }

      console.log('✅ League created:', league.id)

      // Step 2: Create league settings record
      console.log('⚙️ Creating league settings...')
      const { error: settingsError } = await supabase
        .from('league_settings')
        .insert({
          league_id: league.id,
          ...settings
        })

      if (settingsError) {
        console.error('❌ Error creating league settings:', settingsError)
        throw new Error(`Failed to create league settings: ${settingsError.message}`)
      }

      // Step 3: Create commissioner team
      console.log('👑 Creating commissioner team...')
      const { data: commissionerTeam, error: commissionerError } = await supabase
        .from('fantasy_teams')
        .insert({
          league_id: league.id,
          user_id: settings.commissioner_id,
          team_name: commissioner_team_name,
          is_commissioner: true,
          draft_position: 1, // Commissioner gets first pick by default
        })
        .select()
        .single()

      if (commissionerError) {
        console.error('❌ Error creating commissioner team:', commissionerError)
        throw new Error(`Failed to create commissioner team: ${commissionerError.message}`)
      }

      // Step 4: Create league member record for commissioner
      console.log('👤 Creating commissioner league member record...')
      const { error: memberError } = await supabase
        .from('league_members')
        .insert({
          league_id: league.id,
          user_id: settings.commissioner_id,
          team_name: commissioner_team_name,
          is_commissioner: true,
        })

      if (memberError) {
        console.error('❌ Error creating commissioner member record:', memberError)
        throw new Error(`Failed to create commissioner member record: ${memberError.message}`)
      }

      // Step 5: Create empty teams if auto_fill_teams is enabled
      if (auto_fill_teams && settings.max_teams > 1) {
        console.log(`🏀 Creating ${settings.max_teams - 1} empty teams...`)
        const emptyTeams = []
        
        for (let i = 2; i <= settings.max_teams; i++) {
          emptyTeams.push({
            league_id: league.id,
            team_name: `Team ${i}`,
            is_commissioner: false,
            draft_position: i,
          })
        }

        const { error: teamsError } = await supabase
          .from('fantasy_teams')
          .insert(emptyTeams)

        if (teamsError) {
          console.error('❌ Error creating empty teams:', teamsError)
          throw new Error(`Failed to create empty teams: ${teamsError.message}`)
        }
      }

      // Step 6: Create draft order
      console.log('📋 Creating draft order...')
      const draftOrder = []
      const totalPicks = settings.draft_rounds * settings.max_teams
      
      for (let round = 1; round <= settings.draft_rounds; round++) {
        for (let team = 1; team <= settings.max_teams; team++) {
          const pickNumber = (round - 1) * settings.max_teams + team
          const isSnakeDraft = settings.draft_type === 'snake'
          const actualTeamPosition = isSnakeDraft && round % 2 === 0 
            ? settings.max_teams - team + 1 
            : team

          draftOrder.push({
            league_id: league.id,
            round: round,
            pick_number: pickNumber,
            team_position: actualTeamPosition,
            is_completed: false,
          })
        }
      }

      const { error: draftError } = await supabase
        .from('draft_order')
        .insert(draftOrder)

      if (draftError) {
        console.error('❌ Error creating draft order:', draftError)
        throw new Error(`Failed to create draft order: ${draftError.message}`)
      }

      // Step 7: Create league state
      console.log('🔄 Creating league state...')
      const { error: stateError } = await supabase
        .from('league_states')
        .insert({
          league_id: league.id,
          current_phase: 'setup',
          current_week: 0,
          current_season: new Date().getFullYear(),
          is_active: true,
        })

      if (stateError) {
        console.error('❌ Error creating league state:', stateError)
        throw new Error(`Failed to create league state: ${stateError.message}`)
      }

      // Step 8: Send invitations if provided
      if (invite_emails && invite_emails.length > 0) {
        console.log(`📧 Sending ${invite_emails.length} invitations...`)
        const invitations = invite_emails.map(email => ({
          league_id: league.id,
          email: email.toLowerCase().trim(),
          invited_by: settings.commissioner_id,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        }))

        const { error: inviteError } = await supabase
          .from('league_invitations')
          .insert(invitations)

        if (inviteError) {
          console.error('❌ Error sending invitations:', inviteError)
          // Don't throw here - league creation succeeded, invitations are secondary
        }
      }

      console.log('🎉 League creation completed successfully!')
      return {
        league,
        commissionerTeam,
        totalTeams: settings.max_teams,
        draftPicks: totalPicks,
      }
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
      queryClient.invalidateQueries({ queryKey: ['league', data.league.id] })
      queryClient.invalidateQueries({ queryKey: ['league-teams', data.league.id] })
      queryClient.invalidateQueries({ queryKey: ['league-members', data.league.id] })
    },
  })
}

// Helper function to validate league settings
export function validateLeagueSettings(settings: Partial<LeagueSettings>): string[] {
  const errors: string[] = []

  if (!settings.name || settings.name.trim().length < 3) {
    errors.push('League name must be at least 3 characters long')
  }

  if (!settings.max_teams || settings.max_teams < 2 || settings.max_teams > 20) {
    errors.push('League must have between 2 and 20 teams')
  }

  if (!settings.draft_rounds || settings.draft_rounds < 1 || settings.draft_rounds > 20) {
    errors.push('Draft must have between 1 and 20 rounds')
  }

  if (settings.draft_date) {
    const draftDate = new Date(settings.draft_date)
    if (draftDate < new Date()) {
      errors.push('Draft date cannot be in the past')
    }
  }

  // Validate roster positions
  const totalRosterSpots = Object.values(settings.roster_positions || {}).reduce((sum, count) => sum + count, 0)
  if (totalRosterSpots < 5 || totalRosterSpots > 20) {
    errors.push('Total roster spots must be between 5 and 20')
  }

  return errors
}

// Helper function to generate default league settings
export function getDefaultLeagueSettings(commissionerId: string): LeagueSettings {
  return {
    name: '',
    description: '',
    max_teams: 10,
    commissioner_id: commissionerId,
    draft_type: 'snake',
    draft_rounds: 15,
    roster_positions: {
      PG: 1,
      SG: 1,
      SF: 1,
      PF: 1,
      C: 1,
      G: 1,
      F: 1,
      UTIL: 1,
      BENCH: 3,
      IR: 1,
    },
    scoring_type: 'H2H_Points',
    scoring_categories: {
      points: 1,
      rebounds: 1,
      assists: 1,
      steals: 1,
      blocks: 1,
      turnovers: -1,
      field_goal_percentage: 0,
      free_throw_percentage: 0,
      three_point_percentage: 0,
      three_pointers_made: 1,
      double_doubles: 2,
      triple_doubles: 5,
    },
    waiver_wire: true,
    waiver_period_days: 2,
    max_trades_per_team: 10,
    max_adds_per_team: 50,
    playoff_teams: 6,
    playoff_weeks: 3,
    playoff_start_week: 20,
    keeper_league: false,
    max_keepers: 0,
    salary_cap_enabled: false,
    starters_count: 5,
    starters_multiplier: 1.0,
    rotation_count: 5,
    rotation_multiplier: 0.75,
    bench_count: 3,
    bench_multiplier: 0.5,
    public_league: false,
    allow_duplicate_players: false,
    lineup_deadline: 'daily',
    lineup_lock_time: '00:00',
  }
}
