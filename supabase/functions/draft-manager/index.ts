import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/**
 * Draft Manager Edge Function
 * 
 * Runs every 10 seconds (via cron) to manage all active drafts:
 * 1. Check for drafts that need to start
 * 2. Progress current picks if time has expired
 * 3. Auto-pick best available player when timer expires
 * 4. Enable autodraft for teams that miss their pick
 * 5. Use 3-second timer for teams with autodraft enabled
 * 6. Skip picks for teams that cannot afford any remaining players (capped out)
 * 7. Mark drafts as completed when all picks are done OR when no teams can afford players
 * 
 * Salary Cap Management:
 * - Teams with less than $600,000 in cap space are considered "capped out"
 * - Capped out teams have their picks automatically skipped
 * - Draft completes early if ALL teams are capped out (even with incomplete rosters)
 * - This prevents infinite loops and penalizes cap mismanagement
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('🏀 Draft Manager: Starting draft management cycle...');

  try {
    // Initialize Supabase client with service role (full access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    console.log(`⏰ Current time: ${now.toISOString()}`);

    // Step 1: Find drafts that should be starting now
    const { data: draftsToStart, error: startError } = await supabase
      .from('leagues')
      .select('id, name, draft_date, draft_status')
      .eq('draft_status', 'scheduled')
      .lte('draft_date', now.toISOString())
      .limit(10);

    if (startError) {
      console.error('❌ Error fetching drafts to start:', startError);
    } else if (draftsToStart && draftsToStart.length > 0) {
      console.log(`🚀 Found ${draftsToStart.length} draft(s) to start:`);
      draftsToStart.forEach(d => {
        console.log(`   - ${d.name} (ID: ${d.id}, scheduled: ${d.draft_date})`);
      });

      for (const draft of draftsToStart) {
        await startDraft(supabase, draft.id, draft.name);
      }
    } else {
      console.log('✅ No drafts need to start right now');
    }

    // Step 2: Find drafts in progress with expired picks
    const { data: activeDrafts, error: activeError } = await supabase
      .from('draft_current_state')
      .select(`
        league_id,
        current_pick_id,
        current_pick_number,
        current_round,
        draft_status,
        is_auto_pick_active,
        leagues!inner(name, max_teams),
        draft_order!inner(
          id,
          time_expires,
          pick_number,
          round,
          team_position,
          is_completed,
          time_extensions_used
        )
      `)
      .eq('draft_status', 'in_progress')
      .eq('is_auto_pick_active', true) // Only process drafts with auto-pick ENABLED
      .not('current_pick_id', 'is', null);

    if (activeError) {
      console.error('❌ Error fetching active drafts:', activeError);
    } else if (activeDrafts && activeDrafts.length > 0) {
      console.log(`⚡ Found ${activeDrafts.length} active draft(s) with picks to process:`);
      activeDrafts.forEach(d => {
        console.log(`   - League ${d.league_id}: Pick #${d.current_pick_number} (expires: ${d.draft_order?.time_expires || 'not set'})`);
      });

      for (const draftState of activeDrafts) {
        await processDraftPick(supabase, draftState, now);
      }
    } else {
      console.log('✅ No active drafts requiring action');
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        draftsStarted: draftsToStart?.length || 0,
        draftsProcessed: activeDrafts?.length || 0,
        message: 'Draft management cycle completed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Draft Manager Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Draft management failed',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Start a draft by updating its status and initializing the first pick
 */
async function startDraft(supabase: any, leagueId: string, leagueName: string) {
  console.log(`📝 Starting draft for league: ${leagueName}`);

  try {
    // Update league status
    await supabase
      .from('leagues')
      .update({ draft_status: 'in_progress' })
      .eq('id', leagueId);

    // Get first pick from draft order
    const { data: firstPick, error: pickError } = await supabase
      .from('draft_order')
      .select('id, pick_number, round, team_position')
      .eq('league_id', leagueId)
      .eq('pick_number', 1)
      .single();

    if (pickError || !firstPick) {
      console.error('Error getting first pick:', pickError);
      return;
    }

    // Get league settings for timing
    const { data: settings } = await supabase
      .from('league_settings')
      .select('draft_time_per_pick, draft_auto_pick_enabled')
      .eq('league_id', leagueId)
      .single();

    const timePerPick = settings?.draft_time_per_pick || 60; // default 60 seconds
    const expiresAt = new Date(Date.now() + timePerPick * 1000);

    // Count total picks
    const { count: totalPicks } = await supabase
      .from('draft_order')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId);

    // Initialize draft_current_state
    const { error: stateError } = await supabase
      .from('draft_current_state')
      .upsert({
        league_id: leagueId,
        current_pick_id: firstPick.id,
        current_pick_number: 1,
        current_round: 1,
        draft_status: 'in_progress',
        draft_started_at: new Date().toISOString(),
        total_picks: totalPicks || 0,
        completed_picks: 0,
        is_auto_pick_active: settings?.draft_auto_pick_enabled ?? true,
        last_activity_at: new Date().toISOString()
      });

    if (stateError) {
      console.error('Error creating draft state:', stateError);
      return;
    }

    // Set timer on first pick
    await supabase
      .from('draft_order')
      .update({
        time_started: new Date().toISOString(),
        time_expires: expiresAt.toISOString()
      })
      .eq('id', firstPick.id);

    console.log(`✅ Draft started for ${leagueName}`);
  } catch (error) {
    console.error(`Error starting draft for ${leagueName}:`, error);
  }
}

/**
 * Process an active draft pick - check if time expired and auto-pick if needed
 */
async function processDraftPick(supabase: any, draftState: any, now: Date) {
  const leagueId = draftState.league_id;
  const currentPick = draftState.draft_order;

  if (!currentPick || currentPick.is_completed) {
    console.log(`⏭️ Moving to next pick for league ${leagueId}`);
    await moveToNextPick(supabase, leagueId, draftState);
    return;
  }

  // Check if time has expired
  if (currentPick.time_expires) {
    const expiresAt = new Date(currentPick.time_expires);
    if (now >= expiresAt) {
      console.log(`⏰ Time expired for pick #${currentPick.pick_number} in league ${leagueId}`);
      await autoPickPlayer(supabase, leagueId, currentPick, draftState);
    } else {
      const secondsRemaining = Math.round((expiresAt.getTime() - now.getTime()) / 1000);
      console.log(`⏳ Pick #${currentPick.pick_number} has ${secondsRemaining}s remaining`);
    }
  }
}

/**
 * Auto-pick the best available player when time expires
 * Also enables autodraft for the team that missed their pick
 * Uses AGGRESSIVE dynamic strategy based on remaining cap and remaining picks
 */
async function autoPickPlayer(supabase: any, leagueId: string, currentPick: any, draftState: any) {
  console.log(`🤖 Auto-picking for pick #${currentPick.pick_number} (Round ${currentPick.round})`);

  try {
    // Get the team for this pick
    const { data: teams } = await supabase
      .from('fantasy_teams')
      .select('id, team_name, autodraft_enabled')
      .eq('league_id', leagueId)
      .order('id');

    if (!teams || teams.length === 0) {
      console.error('No teams found for league');
      return;
    }

    // The team_position is 1-indexed
    const team = teams[currentPick.team_position - 1];
    if (!team) {
      console.error(`No team found for position ${currentPick.team_position}`);
      return;
    }

    console.log(`🎯 Team: ${team.team_name} (autodraft: ${team.autodraft_enabled})`);

    // ===== CALCULATE PICKS REMAINING FOR DYNAMIC STRATEGY =====
    
    // Get total rounds from draft order
    const { data: roundData } = await supabase
      .from('draft_order')
      .select('round')
      .eq('league_id', leagueId)
      .order('round', { ascending: false })
      .limit(1)
      .single();
    
    const totalRounds = roundData?.round || 15;
    
    // Count how many picks this team has already made
    const { count: completedPicks } = await supabase
      .from('draft_picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .eq('fantasy_team_id', team.id);
    
    // Calculate picks remaining for this team (including current pick)
    const picksRemaining = totalRounds - (completedPicks || 0);
    
    console.log(`📊 Draft Position: Round ${currentPick.round}/${totalRounds}`);
    console.log(`📊 Picks Completed: ${completedPicks || 0}, Picks Remaining: ${picksRemaining}`);

    // Get best available player with AGGRESSIVE dynamic salary cap strategy
    const { data: bestPlayerResult, error: playerError } = await supabase
      .rpc('get_best_available_player', {
        league_id_param: leagueId,
        team_id_param: team.id,
        current_round_param: currentPick.round,
        picks_remaining_param: picksRemaining,
        total_picks_param: totalRounds
      });

    if (playerError || !bestPlayerResult || bestPlayerResult.length === 0) {
      console.error('Error getting best player:', playerError);
      
      // Check if team can afford ANY players using simple affordability check
      const canAfford = await canTeamAffordPlayers(supabase, leagueId, team.id);
      
      if (!canAfford) {
        // Team is genuinely capped out
        console.log(`💸 Team "${team.team_name}" is capped out - marking pick as skipped`);
        await supabase
          .from('draft_order')
          .update({
            is_completed: true,
            is_auto_picked: true,
            auto_pick_reason: 'insufficient_cap_space',
            time_started: new Date().toISOString(),
            time_expires: new Date().toISOString()
          })
          .eq('id', currentPick.id);
        await moveToNextPick(supabase, leagueId, draftState);
        return;
      }
      
      // Team has cap space but get_best_available_player returned null
      // Try a simpler fallback query to get ANY affordable player
      console.log(`🔄 Falling back to simple player query for team ${team.team_name}`);
      
      // Get remaining cap for this team
      const { data: roster } = await supabase
        .from('fantasy_team_rosters')
        .select('player_id, players!inner(salary_2025_26)')
        .eq('fantasy_team_id', team.id);

      const { data: league } = await supabase
        .from('leagues')
        .select('salary_cap_amount')
        .eq('id', leagueId)
        .single();

      const currentSalary = roster?.reduce((sum: number, r: any) => sum + (r.players?.salary_2025_26 || 0), 0) || 0;
      const salaryCap = league?.salary_cap_amount || 170000000;
      const remainingCap = salaryCap - currentSalary;
      
      // Get already-drafted players
      const { data: draftedPlayers } = await supabase
        .from('draft_picks')
        .select('player_id')
        .eq('league_id', leagueId);

      const draftedPlayerIds = draftedPlayers?.map((p: any) => p.player_id) || [];
      
      // Get ANY available player that fits under the cap, sorted by projected points
      let fallbackQuery = supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .lte('salary_2025_26', remainingCap)
        .order('projected_fantasy_points_2025_26', { ascending: false });
      
      if (draftedPlayerIds.length > 0) {
        fallbackQuery = fallbackQuery.not('id', 'in', `(${draftedPlayerIds.join(',')})`);
      }
      
      const { data: fallbackPlayers, error: fallbackError } = await fallbackQuery.limit(1);
      
      if (fallbackError || !fallbackPlayers || fallbackPlayers.length === 0) {
        // Still no players available - this shouldn't happen if canTeamAffordPlayers returned true
        console.error('Fallback query also failed:', fallbackError);
        await supabase
          .from('draft_order')
          .update({
            is_completed: true,
            is_auto_picked: true,
            auto_pick_reason: 'no_eligible_players'
          })
          .eq('id', currentPick.id);
        await moveToNextPick(supabase, leagueId, draftState);
        return;
      }
      
      // Use the fallback player
      const fallbackPlayer = fallbackPlayers[0];
      console.log(`🔄 Using fallback player: ${fallbackPlayer.name} (${fallbackPlayer.position}) - $${(fallbackPlayer.salary_2025_26 / 1000000).toFixed(1)}M`);
      
      // Make the pick
      const { error: pickError } = await supabase
        .rpc('make_draft_pick', {
          league_id_param: leagueId,
          draft_order_id_param: currentPick.id,
          player_id_param: fallbackPlayer.id
        });

      if (pickError) {
        console.error('Error making fallback draft pick:', pickError);
        return;
      }

      // Mark as auto-picked
      const autoPickReason = team.autodraft_enabled ? 'autodraft_enabled' : 'time_expired';
      await supabase
        .from('draft_order')
        .update({
          is_auto_picked: true,
          auto_pick_reason: autoPickReason
        })
        .eq('id', currentPick.id);

      // Enable autodraft if timer expired
      if (!team.autodraft_enabled) {
        console.log(`⚡ Enabling autodraft for team ${team.team_name} (missed pick)`);
        await supabase
          .from('fantasy_teams')
          .update({ autodraft_enabled: true })
          .eq('id', team.id);
      }

      console.log(`✅ Auto-picked ${fallbackPlayer.name} for team ${team.team_name} (fallback)`);
      await moveToNextPick(supabase, leagueId, draftState);
      return;
    }

    const bestPlayer = bestPlayerResult[0];
    console.log(`🌟 Auto-picking player: ${bestPlayer.name} (${bestPlayer.position}) - ${bestPlayer.team_name}`);
    console.log(`   📊 Projected Fantasy Points: ${bestPlayer.projected_fantasy_points}`);
    console.log(`   💰 Salary: $${(bestPlayer.salary_2025_26 / 1000000).toFixed(1)}M`);
    console.log(`   💰 Average Budget/Pick: $${(bestPlayer.average_budget_per_pick / 1000000).toFixed(1)}M`);
    console.log(`   ${bestPlayer.is_over_budget ? '⚠️' : '✅'} ${bestPlayer.is_over_budget ? 'OVER' : 'UNDER'} average budget`);
    console.log(`   💎 Value per $: ${bestPlayer.value_per_dollar?.toFixed(4) || 'N/A'}`);
    console.log(`   🧢 Remaining Cap After: $${(bestPlayer.remaining_cap_after / 1000000).toFixed(1)}M`);

    // Make the pick using the database function
    const { data: pickResult, error: pickError } = await supabase
      .rpc('make_draft_pick', {
        league_id_param: leagueId,
        draft_order_id_param: currentPick.id,
        player_id_param: bestPlayer.id
      });

    if (pickError) {
      console.error('Error making draft pick:', pickError);
      return;
    }

    // Determine auto-pick reason
    const autoPickReason = team.autodraft_enabled ? 'autodraft_enabled' : 'time_expired';

    // Mark as auto-picked
    await supabase
      .from('draft_order')
      .update({
        is_auto_picked: true,
        auto_pick_reason: autoPickReason
      })
      .eq('id', currentPick.id);

    // If team's timer expired (not already on autodraft), enable autodraft for rest of draft
    if (!team.autodraft_enabled) {
      console.log(`⚡ Enabling autodraft for team ${team.team_name} (missed pick)`);
      await supabase
        .from('fantasy_teams')
        .update({ autodraft_enabled: true })
        .eq('id', team.id);
    }

    console.log(`✅ Auto-picked ${bestPlayer.name} for team ${team.team_name}`);

    // Move to next pick
    await moveToNextPick(supabase, leagueId, draftState);
  } catch (error) {
    console.error('Error in auto-pick:', error);
  }
}

/**
 * Check if a team can afford any available players
 * Returns true if team has at least $600,000 in cap space and there are affordable players
 */
async function canTeamAffordPlayers(supabase: any, leagueId: string, teamId: string): Promise<boolean> {
  try {
    // Get team's current cap space
    const { data: roster } = await supabase
      .from('fantasy_team_rosters')
      .select('player_id, players!inner(salary_2025_26)')
      .eq('fantasy_team_id', teamId);

    const { data: league } = await supabase
      .from('leagues')
      .select('salary_cap_amount')
      .eq('id', leagueId)
      .single();

    const currentSalary = roster?.reduce((sum: number, r: any) => sum + (r.players?.salary_2025_26 || 0), 0) || 0;
    const salaryCap = league?.salary_cap_amount || 170000000;
    const remainingCap = salaryCap - currentSalary;

    // Check if team has less than minimum salary ($600,000)
    if (remainingCap < 600000) {
      console.log(`💸 Team ${teamId} is capped out (remaining: $${(remainingCap / 1000000).toFixed(2)}M)`);
      return false;
    }

    // Get all already-drafted player IDs for this league
    const { data: draftedPlayers } = await supabase
      .from('draft_picks')
      .select('player_id')
      .eq('league_id', leagueId);

    const draftedPlayerIds = draftedPlayers?.map((p: any) => p.player_id) || [];

    // Check if there are any available players they can afford
    // Note: if no players drafted yet, skip the .not() filter
    let query = supabase
      .from('players')
      .select('id')
      .eq('is_active', true)
      .lte('salary_2025_26', remainingCap);

    if (draftedPlayerIds.length > 0) {
      query = query.not('id', 'in', `(${draftedPlayerIds.join(',')})`);
    }

    const { data: affordablePlayers } = await query.limit(1);

    const canAfford = affordablePlayers && affordablePlayers.length > 0;
    
    if (!canAfford) {
      console.log(`💸 Team ${teamId} cannot afford any remaining players (cap: $${(remainingCap / 1000000).toFixed(2)}M, drafted: ${draftedPlayerIds.length})`);
    }

    return canAfford;
  } catch (error) {
    console.error('Error checking team affordability:', error);
    return true; // Default to allowing picks on error
  }
}

/**
 * Check if any teams can still afford players
 * Used to determine if draft should be completed early due to cap constraints
 */
async function canAnyTeamAffordPlayers(supabase: any, leagueId: string): Promise<boolean> {
  try {
    const { data: teams } = await supabase
      .from('fantasy_teams')
      .select('id')
      .eq('league_id', leagueId);

    if (!teams || teams.length === 0) {
      return false;
    }

    // Check each team
    for (const team of teams) {
      if (await canTeamAffordPlayers(supabase, leagueId, team.id)) {
        return true; // At least one team can afford players
      }
    }

    console.log(`🚫 No teams can afford any remaining players - ending draft`);
    return false;
  } catch (error) {
    console.error('Error checking if any teams can afford players:', error);
    return true; // Default to continuing draft on error
  }
}

/**
 * Move to the next pick in the draft
 * Uses 3-second timer if team has autodraft enabled, otherwise uses full timer
 * Skips teams that cannot afford any players and completes draft if no teams can afford players
 */
async function moveToNextPick(supabase: any, leagueId: string, draftState: any) {
  console.log(`➡️ Moving to next pick for league ${leagueId}`);

  try {
    const currentPickNumber = draftState.current_pick_number;

    // Get next uncompleted pick
    const { data: nextPick, error: nextError } = await supabase
      .from('draft_order')
      .select('id, pick_number, round, team_position')
      .eq('league_id', leagueId)
      .eq('is_completed', false)
      .gt('pick_number', currentPickNumber)
      .order('pick_number', { ascending: true })
      .limit(1)
      .single();

    if (nextError || !nextPick) {
      // No more picks - draft is complete!
      console.log(`🏁 Draft completed for league ${leagueId} - all picks done`);
      await completeDraft(supabase, leagueId);
      return;
    }

    // Get the teams for next pick to check autodraft status and affordability
    const { data: teams } = await supabase
      .from('fantasy_teams')
      .select('id, team_name, autodraft_enabled')
      .eq('league_id', leagueId)
      .order('id');

    // Only check affordability after at least 2 full rounds have completed
    // This ensures draft progresses even with low caps, giving all teams at least 2 picks
    // before checking if everyone is capped out
    const numberOfTeams = teams?.length || 10;
    const minPicksBeforeCapCheck = numberOfTeams * 2; // 2 full rounds
    
    if (currentPickNumber >= minPicksBeforeCapCheck) {
      // Check if any teams can still afford players
      const anyTeamCanAfford = await canAnyTeamAffordPlayers(supabase, leagueId);
      if (!anyTeamCanAfford) {
        console.log(`🏁 Draft completed for league ${leagueId} - no teams can afford remaining players (after ${currentPickNumber} picks)`);
        await completeDraft(supabase, leagueId);
        return;
      }
    }

    const nextTeam = teams[nextPick.team_position - 1];

    // Check if next team can afford any players
    const canAfford = await canTeamAffordPlayers(supabase, leagueId, nextTeam.id);
    
    if (!canAfford) {
      console.log(`💸 Team "${nextTeam?.team_name}" is capped out - marking pick as skipped`);
      
      // Mark this pick as completed with special reason
      await supabase
        .from('draft_order')
        .update({
          is_completed: true,
          is_auto_picked: true,
          auto_pick_reason: 'insufficient_cap_space',
          time_started: new Date().toISOString(),
          time_expires: new Date().toISOString() // Expired immediately
        })
        .eq('id', nextPick.id);

      // Recursively move to next pick (will eventually complete draft if all teams are capped)
      await moveToNextPick(supabase, leagueId, { ...draftState, current_pick_number: nextPick.pick_number });
      return;
    }

    // Get league settings for timing
    const { data: settings } = await supabase
      .from('league_settings')
      .select('draft_time_per_pick')
      .eq('league_id', leagueId)
      .single();

    // Use 3-second timer if team has autodraft enabled, otherwise use full timer
    const timePerPick = nextTeam?.autodraft_enabled ? 3 : (settings?.draft_time_per_pick || 60);
    const expiresAt = new Date(Date.now() + timePerPick * 1000);

    console.log(`⏱️ Next team "${nextTeam?.team_name}" timer: ${timePerPick}s (autodraft: ${nextTeam?.autodraft_enabled})`);

    // Update draft_current_state
    await supabase
      .from('draft_current_state')
      .update({
        current_pick_id: nextPick.id,
        current_pick_number: nextPick.pick_number,
        current_round: nextPick.round,
        completed_picks: currentPickNumber,
        last_activity_at: new Date().toISOString()
      })
      .eq('league_id', leagueId);

    // Set timer on next pick
    await supabase
      .from('draft_order')
      .update({
        time_started: new Date().toISOString(),
        time_expires: expiresAt.toISOString()
      })
      .eq('id', nextPick.id);

    console.log(`✅ Moved to pick #${nextPick.pick_number}`);
  } catch (error) {
    console.error('Error moving to next pick:', error);
  }
}

/**
 * Complete the draft and update league status
 */
async function completeDraft(supabase: any, leagueId: string) {
  console.log(`🎉 Completing draft for league ${leagueId}`);

  try {
    // Update league status
    await supabase
      .from('leagues')
      .update({ draft_status: 'completed' })
      .eq('id', leagueId);

    // Update draft_current_state
    await supabase
      .from('draft_current_state')
      .update({
        draft_status: 'completed',
        draft_completed_at: new Date().toISOString()
      })
      .eq('league_id', leagueId);

    // Update league_states to regular_season phase
    await supabase
      .from('league_states')
      .update({ current_phase: 'regular_season' })
      .eq('league_id', leagueId);

    console.log(`✅ Draft completed successfully`);
  } catch (error) {
    console.error('Error completing draft:', error);
  }
}

