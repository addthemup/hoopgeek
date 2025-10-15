import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create a client with the user's JWT
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    // Get the current user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const body = await req.json()
    console.log('🔧 Edge Function: Received body:', JSON.stringify(body, null, 2))
    
    const { 
      name, 
      description, 
      maxTeams, 
      scoringType, 
      teamName,
      rosterConfig,
      draftDate,
      tradeDeadline,
      salaryCapAmount,
      startersCount,
      startersMultiplier,
      rotationCount,
      rotationMultiplier,
      benchCount,
      benchMultiplier,
      positionUnitAssignments,
      fantasyScoringFormat
    } = body
    
    console.log('🔧 Edge Function: positionUnitAssignments:', JSON.stringify(positionUnitAssignments, null, 2))
    console.log('🔧 Edge Function: fantasyScoringFormat:', fantasyScoringFormat)
    console.log('🔧 Edge Function: rosterConfig received:', JSON.stringify(rosterConfig, null, 2))

    // Validate required fields
    console.log('🔧 Edge Function: Validating fields:', {
      name: !!name,
      teamName: !!teamName,
      maxTeams: !!maxTeams,
      scoringType: !!scoringType,
      scoringTypeValue: scoringType
    });
    
    if (!name || !teamName || !maxTeams || !scoringType) {
      throw new Error('Missing required fields')
    }

    // Generate invite code
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Step 1: Create fantasy_leagues row
    console.log('📝 Creating fantasy_leagues row...')
    const { data: league, error: leagueError } = await supabase
      .from('fantasy_leagues')
      .insert({
        name,
        description: description || null,
        commissioner_id: user.id,
        max_teams: maxTeams,
        invite_code: inviteCode,
        public_league: false, // Default to private
        league_type: 'redraft', // Default to redraft
        logo_url: null,
        logo_upload_id: null,
        colors: {
          primary: '#1D428A',
          secondary: '#FFC72C'
        },
        scoring_type: scoringType,
        fantasy_scoring_format: fantasyScoringFormat || 'FanDuel',
        draft_type: 'snake', // Default to snake draft
        draft_rounds: 15, // Default to 15 rounds
        salary_cap_enabled: true,
        trades_enabled: true
      })
      .select()
      .single()

    if (leagueError) {
      console.error('❌ Error creating league:', leagueError)
      throw new Error(`Failed to create league: ${leagueError.message}`)
    }

    console.log('✅ League created:', league.id)

    // Step 2: Create fantasy_league_seasons row for 2025
    console.log('📝 Creating fantasy_league_seasons row...')
    const { data: season, error: seasonError } = await supabase
      .from('fantasy_league_seasons')
      .insert({
        league_id: league.id,
        season_year: 2025,
        is_active: true,
        salary_cap_amount: salaryCapAmount || 200000000,
        roster_positions: rosterConfig || {
          G: 4,
          F: 4,
          C: 1,
          UTIL: 5
        },
        starters_count: startersCount || 5,
        rotation_count: rotationCount || 5,
        bench_count: benchCount || 5,
        starters_multiplier: startersMultiplier || 1.0,
        rotation_multiplier: rotationMultiplier || 0.75,
        bench_multiplier: benchMultiplier || 0.5,
        position_unit_assignments: positionUnitAssignments || {
          starters: { G: 2, F: 2, C: 1 },
          rotation: { G: 1, F: 1, UTIL: 3 },
          bench: { UTIL: 2 }
        },
        playoff_teams: Math.floor(maxTeams / 2),
        playoff_weeks: 3,
        draft_date: draftDate || null,
        trade_deadline: tradeDeadline || null
      })
      .select()
      .single()

    if (seasonError) {
      console.error('❌ Error creating season:', seasonError)
      throw new Error(`Failed to create season: ${seasonError.message}`)
    }

    console.log('✅ Season created:', season.id)

    // Step 3: Create commissioner's team
    console.log('📝 Creating commissioner team...')
    const { data: team, error: teamError } = await supabase
      .from('fantasy_teams')
      .insert({
        league_id: league.id,
        season_id: season.id,
        user_id: user.id,
        team_name: teamName,
        is_commissioner: true,
        wins: 0,
        losses: 0,
        ties: 0,
        points_for: 0,
        points_against: 0
      })
      .select()
      .single()

    if (teamError) {
      console.error('❌ Error creating team:', teamError)
      throw new Error(`Failed to create team: ${teamError.message}`)
    }

    console.log('✅ Team created:', team.id)

    // Step 4: Create roster spots for the commissioner's team
    console.log('📝 Creating roster spots...')
    const rosterSpots = []
    
    // Create roster spots based on roster configuration
    if (rosterConfig) {
      Object.entries(rosterConfig).forEach(([position, count]) => {
        for (let i = 0; i < count; i++) {
          rosterSpots.push({
            season_id: season.id,
            fantasy_team_id: team.id,
            player_id: null, // Empty initially
            is_injured_reserve: position === 'IR'
          })
        }
      })
    } else {
      // Default roster spots
      const defaultSpots = [
        { position: 'G', count: 4 },
        { position: 'F', count: 4 },
        { position: 'C', count: 1 },
        { position: 'UTIL', count: 5 }
      ]
      
      defaultSpots.forEach(({ position, count }) => {
        for (let i = 0; i < count; i++) {
          rosterSpots.push({
            season_id: season.id,
            fantasy_team_id: team.id,
            player_id: null,
            is_injured_reserve: false
          })
        }
      })
    }

    if (rosterSpots.length > 0) {
      const { error: rosterError } = await supabase
        .from('fantasy_roster_spots')
        .insert(rosterSpots)

      if (rosterError) {
        console.error('❌ Error creating roster spots:', rosterError)
        throw new Error(`Failed to create roster spots: ${rosterError.message}`)
      }

      console.log(`✅ Created ${rosterSpots.length} roster spots`)
    }

    // Step 5: Create placeholder teams if auto_fill_teams is true
    if (maxTeams > 1) {
      console.log('📝 Creating placeholder teams...')
      const placeholderTeams = []
      
      for (let i = 1; i < maxTeams; i++) {
        placeholderTeams.push({
          league_id: league.id,
          season_id: season.id,
          user_id: null, // No user assigned yet
          team_name: `Team ${i + 1}`,
          is_commissioner: false,
          wins: 0,
          losses: 0,
          ties: 0,
          points_for: 0,
          points_against: 0
        })
      }

      const { data: placeholderTeamsData, error: placeholderError } = await supabase
        .from('fantasy_teams')
        .insert(placeholderTeams)
        .select()

      if (placeholderError) {
        console.error('❌ Error creating placeholder teams:', placeholderError)
        throw new Error(`Failed to create placeholder teams: ${placeholderError.message}`)
      }

      console.log(`✅ Created ${placeholderTeams.length} placeholder teams`)

      // Create roster spots for placeholder teams
      if (placeholderTeamsData && placeholderTeamsData.length > 0) {
        const allRosterSpots = []
        
        placeholderTeamsData.forEach(placeholderTeam => {
          if (rosterConfig) {
            Object.entries(rosterConfig).forEach(([position, count]) => {
              for (let i = 0; i < count; i++) {
                allRosterSpots.push({
                  season_id: season.id,
                  fantasy_team_id: placeholderTeam.id,
                  player_id: null,
                  is_injured_reserve: position === 'IR'
                })
              }
            })
          }
        })

        if (allRosterSpots.length > 0) {
          const { error: placeholderRosterError } = await supabase
            .from('fantasy_roster_spots')
            .insert(allRosterSpots)

          if (placeholderRosterError) {
            console.error('❌ Error creating placeholder roster spots:', placeholderRosterError)
            // Don't throw error here, just log it
          } else {
            console.log(`✅ Created ${allRosterSpots.length} placeholder roster spots`)
          }
        }
      }
    }

    // Step 6: Create draft order and draft picks
    console.log('📋 Creating draft order and picks...')
    
    // Get all teams for this league (commissioner + placeholder teams)
    const { data: allTeams, error: teamsError } = await supabase
      .from('fantasy_teams')
      .select('id, team_name, is_commissioner')
      .eq('league_id', league.id)
      .order('is_commissioner', { ascending: false }) // Commissioner first, then placeholders

    if (teamsError) {
      console.error('❌ Error fetching teams for draft order:', teamsError)
      throw new Error(`Failed to fetch teams: ${teamsError.message}`)
    }

    if (allTeams && allTeams.length > 0) {
      // Create draft order
      const draftOrder = []
      
      // Determine draft type from league settings
      const isSnakeDraft = league.draft_type === 'snake'
      const totalRounds = league.draft_rounds || 15
      const totalTeams = allTeams.length
      
      console.log(`🎯 Creating ${isSnakeDraft ? 'snake' : 'linear'} draft with ${totalRounds} rounds for ${totalTeams} teams`)
      
      // Create draft order entries
      for (let round = 1; round <= totalRounds; round++) {
        for (let teamPosition = 1; teamPosition <= totalTeams; teamPosition++) {
          // Calculate overall pick number
          let pickNumber: number
          
          if (isSnakeDraft) {
            // Snake draft: odd rounds go 1->N, even rounds go N->1
            if (round % 2 === 1) {
              pickNumber = (round - 1) * totalTeams + teamPosition
            } else {
              pickNumber = (round - 1) * totalTeams + (totalTeams - teamPosition + 1)
            }
          } else {
            // Linear draft: always 1->N
            pickNumber = (round - 1) * totalTeams + teamPosition
          }
          
          // Get the team for this pick
          const teamIndex = teamPosition - 1
          const team = allTeams[teamIndex]
          
          draftOrder.push({
            league_id: league.id,
            season_id: season.id,
            pick_number: pickNumber,
            round: round,
            team_position: teamPosition,
            fantasy_team_id: team.id,
            is_completed: false,
            is_traded: false,
            auto_pick_enabled: false
          })
        }
      }
      
      // Insert draft order
      const { data: draftOrderData, error: draftOrderError } = await supabase
        .from('fantasy_draft_order')
        .insert(draftOrder)
        .select('id, pick_number, round, team_position, fantasy_team_id')

      if (draftOrderError) {
        console.error('❌ Error creating draft order:', draftOrderError)
        throw new Error(`Failed to create draft order: ${draftOrderError.message}`)
      }

      console.log(`✅ Created ${draftOrder.length} draft order entries`)
      
      // Create draft current state
      if (draftOrderData && draftOrderData.length > 0) {
        const firstPick = draftOrderData[0]
        
        const { error: draftStateError } = await supabase
          .from('fantasy_draft_current_state')
          .insert({
            league_id: league.id,
            season_id: season.id,
            current_pick_id: firstPick.id,
            current_pick_number: 1,
            current_round: 1,
            draft_status: 'scheduled',
            draft_type: league.draft_type,
            total_rounds: totalRounds,
            total_picks: draftOrder.length,
            picks_completed: 0,
            is_active: false // Will be activated when draft starts
          })

        if (draftStateError) {
          console.error('❌ Error creating draft state:', draftStateError)
          // Don't throw error here, just log it
        } else {
          console.log('✅ Created draft current state')
        }
      }
    }

    // Step 7: Generate schedule (fantasy_matchups) for all regular season weeks
    console.log('📅 Generating schedule...')
    
    // Get all fantasy season weeks (excluding playoff weeks)
    const { data: seasonWeeks, error: weeksError } = await supabase
      .from('fantasy_season_weeks')
      .select('*')
      .eq('season_year', 2025)
      .eq('is_playoff_week', false)
      .order('week_number', { ascending: true })

    if (weeksError) {
      console.error('❌ Error fetching season weeks:', weeksError)
      throw new Error(`Failed to fetch season weeks: ${weeksError.message}`)
    }

    if (seasonWeeks && seasonWeeks.length > 0) {
      // Get all teams for this league
      const { data: allTeams, error: teamsError } = await supabase
        .from('fantasy_teams')
        .select('id, team_name')
        .eq('season_id', season.id)
        .order('created_at', { ascending: true })

      if (teamsError) {
        console.error('❌ Error fetching teams for schedule:', teamsError)
        throw new Error(`Failed to fetch teams: ${teamsError.message}`)
      }

      if (allTeams && allTeams.length > 0) {
        // Generate schedule for each week
        const allMatchups = []
        const matchupHistory = new Map() // Track which teams have played each other
        
        // Initialize matchup history
        for (let i = 0; i < allTeams.length; i++) {
          for (let j = i + 1; j < allTeams.length; j++) {
            const key = `${allTeams[i].id}-${allTeams[j].id}`
            matchupHistory.set(key, 0)
          }
        }
        
        for (const week of seasonWeeks) {
          console.log(`📅 Generating matchups for ${week.week_name}...`)
          
          // Create a copy of teams array and shuffle it
          const shuffledTeams = [...allTeams].sort(() => Math.random() - 0.5)
          const usedTeams = new Set()
          const weekMatchups = []
          
          // Try to pair teams that haven't played each other yet
          for (let i = 0; i < shuffledTeams.length; i++) {
            if (usedTeams.has(shuffledTeams[i].id)) continue
            
            let opponent = null
            let minMatchups = Infinity
            
            // Find the team with the fewest matchups against the current team
            for (let j = i + 1; j < shuffledTeams.length; j++) {
              if (usedTeams.has(shuffledTeams[j].id)) continue
              
              const key1 = `${shuffledTeams[i].id}-${shuffledTeams[j].id}`
              const key2 = `${shuffledTeams[j].id}-${shuffledTeams[i].id}`
              const matchups = matchupHistory.get(key1) || matchupHistory.get(key2) || 0
              
              if (matchups < minMatchups) {
                minMatchups = matchups
                opponent = shuffledTeams[j]
              }
            }
            
            // If no opponent found, find any available team
            if (!opponent) {
              for (let j = i + 1; j < shuffledTeams.length; j++) {
                if (!usedTeams.has(shuffledTeams[j].id)) {
                  opponent = shuffledTeams[j]
                  break
                }
              }
            }
            
            if (opponent) {
              usedTeams.add(shuffledTeams[i].id)
              usedTeams.add(opponent.id)
              
              // Update matchup history
              const key = `${shuffledTeams[i].id}-${opponent.id}`
              const reverseKey = `${opponent.id}-${shuffledTeams[i].id}`
              const currentMatchups = matchupHistory.get(key) || matchupHistory.get(reverseKey) || 0
              matchupHistory.set(key, currentMatchups + 1)
              if (key !== reverseKey) {
                matchupHistory.set(reverseKey, currentMatchups + 1)
              }
              
              // Randomly assign home/away
              const isTeam1Home = Math.random() > 0.5
              
              weekMatchups.push({
                league_id: league.id,
                season_id: season.id,
                season_week_id: week.id,
                week_number: week.week_number,
                season_year: week.season_year,
                fantasy_team1_id: shuffledTeams[i].id,
                fantasy_team2_id: opponent.id,
                home_team_id: isTeam1Home ? shuffledTeams[i].id : opponent.id,
                away_team_id: isTeam1Home ? opponent.id : shuffledTeams[i].id,
                status: 'scheduled',
                team1_score: 0.0,
                team2_score: 0.0,
                team1_projected_score: 0.0,
                team2_projected_score: 0.0,
                matchup_start_date: week.start_date,
                matchup_end_date: week.end_date,
                is_playoff_matchup: false
              })
            }
          }
          
          allMatchups.push(...weekMatchups)
        }

        // Insert all matchups
        if (allMatchups.length > 0) {
          const { error: matchupsError } = await supabase
            .from('fantasy_matchups')
            .insert(allMatchups)

          if (matchupsError) {
            console.error('❌ Error creating matchups:', matchupsError)
            throw new Error(`Failed to create matchups: ${matchupsError.message}`)
          }

          console.log(`✅ Created ${allMatchups.length} matchups across ${seasonWeeks.length} weeks`)
        }
      }
    }

    // Get the final league data with all relationships
    const { data: finalLeague, error: fetchError } = await supabase
      .from('fantasy_leagues')
      .select(`
        *,
        fantasy_league_seasons!inner (
          *
        ),
        fantasy_teams (
          id,
          team_name,
          user_id,
          is_commissioner,
          created_at
        )
      `)
      .eq('id', league.id)
      .single()

    if (fetchError) {
      console.error('League fetch error:', fetchError)
      throw new Error(`Failed to fetch created league: ${fetchError.message}`)
    }

    console.log('✅ Successfully created league with all components:', finalLeague)
    console.log('✅ League invite code:', finalLeague.invite_code)

    return new Response(
      JSON.stringify({
        message: 'League created successfully',
        league: finalLeague
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})