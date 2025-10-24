import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WaiverClaim {
  id: string
  league_id: string
  season_id: string
  fantasy_team_id: string
  player_id: string
  player_to_drop_id: string | null
  priority: number
  bid_amount: number | null
  status: string
  claim_date: string
  team_name: string
  player_name: string
}

interface LeagueSeason {
  id: string
  league_id: string
  waiver_type: 'none' | 'rolling' | 'faab' | 'continuous'
  waiver_period_hours: number
  waiver_budget_amount: number
  waiver_min_bid: number
  waiver_priority_reset: string
}

interface WaiverOrder {
  fantasy_team_id: string
  priority_order: number
  faab_budget_remaining: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { leagueId, seasonId, manualTrigger = false } = await req.json()

    console.log('🏀 Processing waivers...', { leagueId, seasonId, manualTrigger })

    // If specific league/season provided, process just that one
    // Otherwise, process all active leagues
    let leaguesToProcess: { league_id: string; season_id: string }[] = []

    if (leagueId && seasonId) {
      leaguesToProcess = [{ league_id: leagueId, season_id: seasonId }]
    } else {
      // Get all active league seasons
      const { data: activeSeasons, error: seasonsError } = await supabaseClient
        .from('fantasy_league_seasons')
        .select('id, league_id')
        .eq('status', 'active')

      if (seasonsError) throw seasonsError

      leaguesToProcess = activeSeasons?.map(s => ({ 
        league_id: s.league_id, 
        season_id: s.id 
      })) || []
    }

    console.log(`📋 Processing ${leaguesToProcess.length} leagues...`)

    const results = []

    for (const league of leaguesToProcess) {
      try {
        const result = await processLeagueWaivers(supabaseClient, league.league_id, league.season_id)
        results.push(result)
      } catch (error) {
        console.error(`❌ Error processing league ${league.league_id}:`, error)
        results.push({
          league_id: league.league_id,
          season_id: league.season_id,
          success: false,
          error: error.message
        })
      }
    }

    // Also expire old waivers (move to free agents)
    await expireWaivers(supabaseClient)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} leagues`,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Error in process-waivers:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

async function processLeagueWaivers(
  supabase: any,
  leagueId: string,
  seasonId: string
): Promise<any> {
  console.log(`🔄 Processing league ${leagueId}, season ${seasonId}`)

  // 1. Get league waiver settings
  const { data: season, error: seasonError } = await supabase
    .from('fantasy_league_seasons')
    .select('*')
    .eq('id', seasonId)
    .single()

  if (seasonError || !season) {
    throw new Error(`League season not found: ${seasonError?.message}`)
  }

  const leagueSeason = season as LeagueSeason

  // If waiver type is "none", skip processing
  if (leagueSeason.waiver_type === 'none') {
    console.log(`⏭️  League ${leagueId} has no waivers enabled, skipping...`)
    return {
      league_id: leagueId,
      season_id: seasonId,
      success: true,
      message: 'Waivers disabled for this league'
    }
  }

  // 2. Get all pending claims for this league, ordered by priority
  const { data: claims, error: claimsError } = await supabase
    .from('fantasy_waiver_claims')
    .select(`
      *,
      fantasy_teams!fantasy_waiver_claims_fantasy_team_id_fkey(team_name),
      nba_players!fantasy_waiver_claims_player_id_fkey(name)
    `)
    .eq('league_id', leagueId)
    .eq('season_id', seasonId)
    .eq('status', 'pending')
    .order('priority', { ascending: true })

  if (claimsError) {
    throw new Error(`Failed to fetch claims: ${claimsError.message}`)
  }

  if (!claims || claims.length === 0) {
    console.log(`✅ No pending claims for league ${leagueId}`)
    return {
      league_id: leagueId,
      season_id: seasonId,
      success: true,
      message: 'No pending claims',
      processed: 0
    }
  }

  console.log(`📊 Found ${claims.length} pending claims`)

  // 3. Get current waiver order
  const { data: waiverOrder, error: orderError } = await supabase
    .from('fantasy_waiver_order')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season_id', seasonId)
    .order('priority_order', { ascending: true })

  if (orderError) {
    throw new Error(`Failed to fetch waiver order: ${orderError.message}`)
  }

  const orderMap = new Map<string, WaiverOrder>()
  waiverOrder?.forEach((wo: WaiverOrder) => {
    orderMap.set(wo.fantasy_team_id, wo)
  })

  // 4. Process claims based on waiver type
  let processedCount = 0
  const processedPlayers = new Set<string>() // Track which players have been claimed

  switch (leagueSeason.waiver_type) {
    case 'rolling':
      processedCount = await processRollingWaivers(supabase, claims, orderMap, leagueId, seasonId, processedPlayers)
      break
    case 'faab':
      processedCount = await processFAABWaivers(supabase, claims, orderMap, leagueId, seasonId, processedPlayers, leagueSeason.waiver_min_bid)
      break
    case 'continuous':
      processedCount = await processContinuousWaivers(supabase, claims, orderMap, leagueId, seasonId, processedPlayers)
      break
  }

  console.log(`✅ Processed ${processedCount} claims for league ${leagueId}`)

  return {
    league_id: leagueId,
    season_id: seasonId,
    success: true,
    message: `Processed ${processedCount} claims`,
    processed: processedCount,
    waiver_type: leagueSeason.waiver_type
  }
}

async function processRollingWaivers(
  supabase: any,
  claims: any[],
  orderMap: Map<string, WaiverOrder>,
  leagueId: string,
  seasonId: string,
  processedPlayers: Set<string>
): Promise<number> {
  console.log('🔄 Processing rolling waivers...')
  let processedCount = 0

  // Sort claims by waiver priority (lower = better)
  const sortedClaims = claims.sort((a, b) => {
    const aOrder = orderMap.get(a.fantasy_team_id)?.priority_order ?? 999
    const bOrder = orderMap.get(b.fantasy_team_id)?.priority_order ?? 999
    return aOrder - bOrder
  })

  for (const claim of sortedClaims) {
    // Skip if player already claimed this round
    if (processedPlayers.has(claim.player_id)) {
      await updateClaimStatus(supabase, claim.id, 'failed', 'Player already claimed')
      continue
    }

    // Attempt to process the claim
    const success = await processClaim(supabase, claim, leagueId, seasonId)

    if (success) {
      processedCount++
      processedPlayers.add(claim.player_id)
      
      // Move team to back of waiver order (rolling)
      await moveToBackOfWaiverOrder(supabase, claim.fantasy_team_id, leagueId, seasonId)
    }
  }

  return processedCount
}

async function processFAABWaivers(
  supabase: any,
  claims: any[],
  orderMap: Map<string, WaiverOrder>,
  leagueId: string,
  seasonId: string,
  processedPlayers: Set<string>,
  minBid: number
): Promise<number> {
  console.log('💰 Processing FAAB waivers...')
  let processedCount = 0

  // Group claims by player
  const claimsByPlayer = new Map<string, any[]>()
  claims.forEach(claim => {
    if (!claimsByPlayer.has(claim.player_id)) {
      claimsByPlayer.set(claim.player_id, [])
    }
    claimsByPlayer.get(claim.player_id)!.push(claim)
  })

  // Process each player's claims
  for (const [playerId, playerClaims] of claimsByPlayer.entries()) {
    // Sort by bid amount (highest first), then by priority (tiebreaker)
    const sortedClaims = playerClaims.sort((a, b) => {
      if (a.bid_amount !== b.bid_amount) {
        return (b.bid_amount || 0) - (a.bid_amount || 0)
      }
      // Tiebreaker: use waiver priority
      const aOrder = orderMap.get(a.fantasy_team_id)?.priority_order ?? 999
      const bOrder = orderMap.get(b.fantasy_team_id)?.priority_order ?? 999
      return aOrder - bOrder
    })

    // Award to highest bidder (if bid is valid)
    const winningClaim = sortedClaims[0]
    const teamOrder = orderMap.get(winningClaim.fantasy_team_id)
    const bidAmount = winningClaim.bid_amount || 0

    // Validate bid
    if (bidAmount < minBid) {
      await updateClaimStatus(supabase, winningClaim.id, 'failed', `Bid below minimum (${minBid})`)
      continue
    }

    if (!teamOrder || teamOrder.faab_budget_remaining < bidAmount) {
      await updateClaimStatus(supabase, winningClaim.id, 'failed', 'Insufficient FAAB budget')
      continue
    }

    // Process winning claim
    const success = await processClaim(supabase, winningClaim, leagueId, seasonId)

    if (success) {
      processedCount++
      processedPlayers.add(playerId)

      // Deduct FAAB budget
      await supabase
        .from('fantasy_waiver_order')
        .update({
          faab_budget_remaining: teamOrder.faab_budget_remaining - bidAmount,
          updated_at: new Date().toISOString()
        })
        .eq('fantasy_team_id', winningClaim.fantasy_team_id)
        .eq('league_id', leagueId)
        .eq('season_id', seasonId)
    }

    // Mark other claims as failed
    for (let i = 1; i < sortedClaims.length; i++) {
      await updateClaimStatus(supabase, sortedClaims[i].id, 'failed', 'Outbid by another team')
    }
  }

  return processedCount
}

async function processContinuousWaivers(
  supabase: any,
  claims: any[],
  orderMap: Map<string, WaiverOrder>,
  leagueId: string,
  seasonId: string,
  processedPlayers: Set<string>
): Promise<number> {
  console.log('♻️  Processing continuous waivers...')
  let processedCount = 0

  // Sort by priority (same as rolling, but priority never changes)
  const sortedClaims = claims.sort((a, b) => {
    const aOrder = orderMap.get(a.fantasy_team_id)?.priority_order ?? 999
    const bOrder = orderMap.get(b.fantasy_team_id)?.priority_order ?? 999
    return aOrder - bOrder
  })

  for (const claim of sortedClaims) {
    if (processedPlayers.has(claim.player_id)) {
      await updateClaimStatus(supabase, claim.id, 'failed', 'Player already claimed')
      continue
    }

    const success = await processClaim(supabase, claim, leagueId, seasonId)

    if (success) {
      processedCount++
      processedPlayers.add(claim.player_id)
      // Priority order stays the same for continuous waivers
    }
  }

  return processedCount
}

async function processClaim(
  supabase: any,
  claim: any,
  leagueId: string,
  seasonId: string
): Promise<boolean> {
  console.log(`🎯 Processing claim ${claim.id} for player ${claim.player_id}`)

  try {
    // 1. Check if team has roster spot (or will after drop)
    const { data: rosterSpots, error: rosterError } = await supabase
      .from('fantasy_roster_spots')
      .select('id, player_id')
      .eq('fantasy_team_id', claim.fantasy_team_id)

    if (rosterError) throw rosterError

    const emptySpots = rosterSpots?.filter((spot: any) => !spot.player_id) || []
    
    if (emptySpots.length === 0 && !claim.player_to_drop_id) {
      await updateClaimStatus(supabase, claim.id, 'failed', 'No roster spots available and no drop specified')
      return false
    }

    // 2. Drop player if specified
    if (claim.player_to_drop_id) {
      const { error: dropError } = await supabase.rpc('drop_player', {
        league_id_param: leagueId,
        season_id_param: seasonId,
        fantasy_team_id_param: claim.fantasy_team_id,
        player_id_param: claim.player_to_drop_id,
        notes_param: `Dropped to make room for waiver claim`
      })

      if (dropError) {
        await updateClaimStatus(supabase, claim.id, 'failed', `Failed to drop player: ${dropError.message}`)
        return false
      }
    }

    // 3. Add player to roster
    const targetSpot = emptySpots[0] || rosterSpots?.find((spot: any) => !spot.player_id)

    if (!targetSpot) {
      await updateClaimStatus(supabase, claim.id, 'failed', 'No available roster spot after drop')
      return false
    }

    const { error: addError } = await supabase
      .from('fantasy_roster_spots')
      .update({ player_id: claim.player_id, updated_at: new Date().toISOString() })
      .eq('id', targetSpot.id)

    if (addError) {
      await updateClaimStatus(supabase, claim.id, 'failed', `Failed to add player: ${addError.message}`)
      return false
    }

    // 4. Remove player from waivers
    const { error: removeError } = await supabase
      .from('fantasy_players_on_waivers')
      .delete()
      .eq('player_id', claim.player_id)
      .eq('league_id', leagueId)
      .eq('season_id', seasonId)

    if (removeError) {
      console.error('⚠️  Warning: Failed to remove player from waivers:', removeError)
    }

    // 5. Log transaction
    const { error: txError } = await supabase.rpc('create_fantasy_transaction', {
      league_id_param: leagueId,
      season_id_param: seasonId,
      transaction_type_param: 'add',
      fantasy_team_id_param: claim.fantasy_team_id,
      player_id_param: claim.player_id,
      notes_param: `Claimed via waivers (claim #${claim.id})`
    })

    if (txError) {
      console.error('⚠️  Warning: Failed to log transaction:', txError)
    }

    // 6. Mark claim as successful
    await updateClaimStatus(supabase, claim.id, 'successful', 'Claim processed successfully')

    console.log(`✅ Successfully processed claim ${claim.id}`)
    return true

  } catch (error) {
    console.error(`❌ Error processing claim ${claim.id}:`, error)
    await updateClaimStatus(supabase, claim.id, 'failed', error.message)
    return false
  }
}

async function updateClaimStatus(
  supabase: any,
  claimId: string,
  status: string,
  notes?: string
): Promise<void> {
  await supabase
    .from('fantasy_waiver_claims')
    .update({
      status,
      notes: notes || null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', claimId)
}

async function moveToBackOfWaiverOrder(
  supabase: any,
  teamId: string,
  leagueId: string,
  seasonId: string
): Promise<void> {
  console.log(`📊 Moving team ${teamId} to back of waiver order`)

  // Get all teams in order
  const { data: allOrders, error } = await supabase
    .from('fantasy_waiver_order')
    .select('fantasy_team_id, priority_order')
    .eq('league_id', leagueId)
    .eq('season_id', seasonId)
    .order('priority_order', { ascending: true })

  if (error || !allOrders) return

  const maxPriority = Math.max(...allOrders.map((o: any) => o.priority_order))

  // Update the claiming team to last
  await supabase
    .from('fantasy_waiver_order')
    .update({ 
      priority_order: maxPriority + 1,
      updated_at: new Date().toISOString()
    })
    .eq('fantasy_team_id', teamId)
    .eq('league_id', leagueId)
    .eq('season_id', seasonId)
}

async function expireWaivers(supabase: any): Promise<void> {
  console.log('⏰ Expiring old waivers...')

  // Update players whose waiver period has expired
  const { error } = await supabase
    .from('fantasy_players_on_waivers')
    .update({
      waiver_status: 'free_agent',
      updated_at: new Date().toISOString()
    })
    .eq('waiver_status', 'on_waivers')
    .lt('becomes_free_agent_at', new Date().toISOString())

  if (error) {
    console.error('❌ Error expiring waivers:', error)
  } else {
    console.log('✅ Expired old waivers')
  }
}

