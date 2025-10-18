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
  const now = new Date();  // Ensure 'now' is correctly defined
  try {
      // Check if this is a manual trigger
      const body = await req.json().catch(() => ({}));
      if (body.trigger === 'manual_start') {
        console.log('🚀 Manual trigger received - processing immediately');
        if (body.league_id) {
          console.log(`🎯 Focusing on league: ${body.league_id}`);
        }
        // Add a small delay to ensure database updates are committed
        console.log('⏳ Waiting 2 seconds for database updates to commit...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (body.trigger === 'pick_made') {
        console.log('🎯 Pick made trigger received - moving to next pick');
        if (body.league_id) {
          console.log(`🎯 Focusing on league: ${body.league_id}, pick: ${body.pick_number}`);
        }
        // Add a small delay to ensure database updates are committed
        console.log('⏳ Waiting 1 second for database updates to commit...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (body.trigger === 'draft_start_time_reached') {
        console.log('⏰ Draft start time reached trigger received');
        if (body.league_id) {
          console.log(`🎯 Focusing on league: ${body.league_id}`);
        }
        // Process immediately for draft start time
        console.log('⏳ Processing draft start time trigger...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    // Initialize Supabase client with service role (full access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`⏰ Current time: ${now.toISOString()}`);

    // Step 1: Find drafts that should be starting now
    console.log('🔍 Fetching drafts to start');
    const { data: draftsToStart, error: startError } = await supabase
      .from('fantasy_league_seasons')
      .select('league_id, draft_date, draft_status, fantasy_leagues!inner(id, name)')
      .eq('draft_status', 'scheduled')
      .lte('draft_date', now.toISOString())
      .limit(10);

    // Also check for drafts that are already in_progress (manual start case)
    console.log('🔍 Checking for drafts already in progress...');
    const { data: inProgressDrafts, error: inProgressError } = await supabase
      .from('fantasy_league_seasons')
      .select('league_id, draft_date, draft_status, fantasy_leagues!inner(id, name)')
      .eq('draft_status', 'in_progress')
      .limit(10);

    if (inProgressError) {
      console.error('❌ Error fetching in-progress drafts:', inProgressError);
    } else if (inProgressDrafts && inProgressDrafts.length > 0) {
      console.log(`⚡ Found ${inProgressDrafts.length} draft(s) already in progress:`);
      inProgressDrafts.forEach(d => {
        console.log(`   - ${d.fantasy_leagues?.name}: Status=${d.draft_status}, Date=${d.draft_date}`);
      });
    } else {
      console.log('📊 No drafts currently in progress');
    }
    
    // Also check what drafts exist for debugging
    const { data: allDrafts, error: allDraftsError } = await supabase
      .from('fantasy_league_seasons')
      .select('league_id, draft_date, draft_status, fantasy_leagues!inner(id, name)')
      .limit(10);
    
    if (!allDraftsError && allDrafts) {
      console.log(`📊 Found ${allDrafts.length} total drafts:`);
      allDrafts.forEach(d => {
        console.log(`   - ${d.fantasy_leagues?.name}: status=${d.draft_status}, date=${d.draft_date}`);
      });
    }

    if (startError) {
      console.error('❌ Error fetching drafts to start:', startError);
    } else if (draftsToStart && draftsToStart.length > 0) {
      console.log(`🚀 Found ${draftsToStart.length} draft(s) ready to start.`);
      draftsToStart.forEach(d => {
        console.log(`   - ${d.fantasy_leagues?.name || 'Unknown'}: Scheduled for ${d.draft_date}`);
      });

      for (const draft of draftsToStart) {
        console.log(`📝 Starting draft for ${draft.fantasy_leagues?.name}`);
        await startDraft(supabase, draft.league_id, draft.fantasy_leagues?.name);
      }
    } else {
      console.log('✅ No drafts need to start right now');
    }

    // If this is a manual start trigger, we don't need to start any drafts
    // The start_draft_manually function already handled that
    if (body.trigger === 'manual_start') {
      console.log('🚀 Manual start detected - skipping draft start logic');
    }
    
    // If this is a draft start time trigger, focus on the specific league
    if (body.trigger === 'draft_start_time_reached' && body.league_id) {
      console.log(`⏰ Draft start time reached for league: ${body.league_id}`);
      
      // Check if this specific league needs to start
      const { data: specificDraft, error: specificError } = await supabase
        .from('fantasy_league_seasons')
        .select('league_id, draft_date, draft_status, fantasy_leagues!inner(id, name)')
        .eq('league_id', body.league_id)
        .eq('draft_status', 'scheduled')
        .lte('draft_date', now.toISOString())
        .limit(1);

      if (specificError) {
        console.error('❌ Error fetching specific draft to start:', specificError);
      } else if (specificDraft && specificDraft.length > 0) {
        console.log(`🚀 Starting draft for ${specificDraft[0].fantasy_leagues?.name} (start time reached)`);
        await startDraft(supabase, specificDraft[0].league_id, specificDraft[0].fantasy_leagues?.name);
      } else {
        console.log(`📊 League ${body.league_id} is not ready to start or already started`);
      }
    }

    // Step 2: Find drafts in progress with expired picks
    console.log('🔍 Checking for active drafts...');
    const { data: activeDrafts, error: activeError } = await supabase
      .from('fantasy_draft_current_state')
      .select(`
        league_id,
        current_pick_id,
        current_pick_number,
        current_round,
        draft_status,
        is_auto_pick_active,
        fantasy_leagues!inner(name, max_teams),
        fantasy_draft_order!inner(
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
      .not('current_pick_id', 'is', null);

    // Debug: Check what we found
    if (activeDrafts && activeDrafts.length > 0) {
      console.log('🔍 Active drafts found:');
      activeDrafts.forEach(draft => {
        console.log(`   - League ${draft.league_id}: Pick #${draft.current_pick_number}`);
        console.log(`     Current pick ID: ${draft.current_pick_id}`);
        console.log(`     Time expires: ${draft.fantasy_draft_order?.time_expires || 'not set'}`);
        console.log(`     Is completed: ${draft.fantasy_draft_order?.is_completed || 'not set'}`);
      });
    } else {
      console.log('🔍 No active drafts with picks found. Checking for missing draft states...');
      
      // Find all leagues that are in_progress in fantasy_league_seasons but missing from fantasy_draft_current_state
      // First, get all league_ids that have draft states
      const { data: existingStates, error: existingError } = await supabase
        .from('fantasy_draft_current_state')
        .select('league_id');
      
      if (existingError) {
        console.error('❌ Error fetching existing draft states:', existingError);
      } else {
        const existingLeagueIds = existingStates?.map(s => s.league_id) || [];
        
        // Now find leagues that are in_progress but don't have draft states
        let missingQuery = supabase
          .from('fantasy_league_seasons')
          .select(`
            league_id,
            fantasy_leagues!inner(name)
          `)
          .eq('draft_status', 'in_progress');
        
        if (existingLeagueIds.length > 0) {
          missingQuery = missingQuery.not('league_id', 'in', `(${existingLeagueIds.join(',')})`);
        }
        
        const { data: missingStates, error: missingError } = await missingQuery;
      
      if (missingError) {
        console.error('❌ Error checking for missing draft states:', missingError);
      } else if (missingStates && missingStates.length > 0) {
        console.log(`🔧 Found ${missingStates.length} league(s) missing draft state, initializing...`);
        
        for (const league of missingStates) {
          console.log(`🔧 Initializing draft state for league: ${league.fantasy_leagues?.name} (${league.league_id})`);
          
          const { data: initResult, error: initError } = await supabase
            .rpc('initialize_draft_state', {
              league_id_param: league.league_id
            });
          
          if (initError) {
            console.error(`❌ Error initializing draft state for ${league.league_id}:`, initError);
          } else {
            console.log(`✅ Draft state initialized for ${league.fantasy_leagues?.name}:`, initResult);
          }
        }
      } else {
        console.log('✅ All in-progress drafts have proper draft states');
        }
      }
    }

    if (activeError) {
      console.error('❌ Error fetching active drafts:', activeError);
    } else if (activeDrafts && activeDrafts.length > 0) {
      // AUTO-RECOVERY: Fix any picks with null time_expires
      console.log('🔧 Checking for stalled picks (null time_expires)...');
      for (const draft of activeDrafts) {
        const currentPick = draft.fantasy_draft_order;
        if (currentPick && !currentPick.time_expires && !currentPick.is_completed) {
          console.log(`⚠️ STALLED PICK DETECTED: League ${draft.league_id}, Pick #${currentPick.pick_number} has null time_expires`);
          
          // Get the team for this pick to check autodraft status
          const { data: teams } = await supabase
            .from('fantasy_teams')
            .select('id, team_name, autodraft_enabled')
            .eq('league_id', draft.league_id)
            .order('id');
          
          const team = teams?.[currentPick.team_position - 1];
          
          // Get league settings for timing
          const { data: settings } = await supabase
            .from('fantasy_leagues')
            .select('draft_time_per_pick')
            .eq('id', draft.league_id)
            .single();
          
          // Use 3-second timer if team has autodraft enabled, otherwise use full timer
          const timePerPick = team?.autodraft_enabled ? 3 : (settings?.draft_time_per_pick || 60);
          const expiresAt = new Date(Date.now() + timePerPick * 1000);
          
          console.log(`🔧 AUTO-FIXING: Setting time_expires to ${timePerPick}s from now (${expiresAt.toISOString()})`);
          
          // Fix the pick
          const { error: fixError } = await supabase
            .from('fantasy_draft_order')
            .update({
              time_started: new Date().toISOString(),
              time_expires: expiresAt.toISOString()
            })
            .eq('id', currentPick.id);
          
          if (fixError) {
            console.error(`❌ Failed to fix stalled pick:`, fixError);
          } else {
            console.log(`✅ Fixed stalled pick #${currentPick.pick_number} - draft will resume automatically`);
          }
        }
      }
      
      console.log(`⚡ Found ${activeDrafts.length} active draft(s) with picks to process:`);
      activeDrafts.forEach(d => {
        console.log(`   - League ${d.league_id}: Pick #${d.current_pick_number} (expires: ${d.fantasy_draft_order?.time_expires || 'not set'})`);
        console.log(`     Draft Status: ${d.draft_status}, Auto-pick Active: ${d.is_auto_pick_active}`);
        console.log(`     Current Pick ID: ${d.current_pick_id}, Round: ${d.current_round}`);
      });

      for (const draftState of activeDrafts) {
        // Check if the current team has autodraft enabled before processing
        const currentPick = draftState.fantasy_draft_order;
        if (currentPick && currentPick.time_expires) {
          const expiresAt = new Date(currentPick.time_expires);
          console.log(`⏰ Checking pick #${currentPick.pick_number}: expires at ${expiresAt.toISOString()}, now is ${now.toISOString()}`);
          console.log(`⏰ Time comparison: now=${now.getTime()}, expires=${expiresAt.getTime()}, expired=${now >= expiresAt}`);
          if (now >= expiresAt) {
            console.log(`⏰ Pick #${currentPick.pick_number} has EXPIRED - processing...`);
            // Time has expired, check if team has autodraft enabled
            const { data: teams } = await supabase
              .from('fantasy_teams')
              .select('id, team_name, autodraft_enabled')
              .eq('league_id', draftState.league_id)
              .order('id');
            
            if (teams && teams.length > 0) {
              console.log(`👥 Found ${teams.length} teams for league ${draftState.league_id}`);
              teams.forEach((t, i) => {
                console.log(`   Team ${i + 1}: ${t.team_name} (autodraft: ${t.autodraft_enabled})`);
              });
              
              const team = teams[currentPick.team_position - 1];
              console.log(`👥 Team at position ${currentPick.team_position}: ${team?.team_name || 'NOT FOUND'}, autodraft_enabled: ${team?.autodraft_enabled || 'NOT FOUND'}`);
              if (team && team.autodraft_enabled) {
                console.log(`🤖 Processing autodraft for team ${team.team_name} (pick #${currentPick.pick_number})`);
                await processDraftPick(supabase, draftState, now);
              } else {
                console.log(`⏰ Time expired for pick #${currentPick.pick_number} but team ${team?.team_name || 'unknown'} doesn't have autodraft enabled`);
                // Still process to enable autodraft for the team
                await processDraftPick(supabase, draftState, now);
              }
            } else {
              console.log(`❌ No teams found for league ${draftState.league_id}`);
            }
          } else {
            const timeRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
            console.log(`⏳ Pick #${currentPick.pick_number} still has ${timeRemaining} seconds remaining`);
          }
        }
      }
    } else {
      console.log('✅ No active drafts requiring action');
      
      // Let's also check if there are any drafts in progress at all
      const { data: allActiveDrafts, error: allActiveError } = await supabase
        .from('fantasy_draft_current_state')
        .select('league_id, current_pick_number, draft_status, fantasy_leagues!inner(name)')
        .eq('draft_status', 'in_progress');
      
      if (allActiveError) {
        console.error('❌ Error checking all active drafts:', allActiveError);
      } else if (allActiveDrafts && allActiveDrafts.length > 0) {
        console.log(`📊 Found ${allActiveDrafts.length} draft(s) in progress (but no expired picks):`);
        allActiveDrafts.forEach(d => {
          console.log(`   - ${d.fantasy_leagues?.name}: Pick #${d.current_pick_number}`);
        });
      } else {
        console.log('📊 No drafts currently in progress');
      }
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
    // Update league season status (not fantasy_leagues)
    await supabase
      .from('fantasy_league_seasons')
      .update({ 
        draft_status: 'in_progress',
        draft_date: new Date().toISOString()
      })
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(1);

    // Get first pick from draft order
    const { data: firstPick, error: pickError } = await supabase
      .from('fantasy_draft_order')
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
      .from('fantasy_leagues')
      .select('draft_time_per_pick, draft_auto_pick_enabled')
      .eq('id', leagueId)
      .single();

    const timePerPick = settings?.draft_time_per_pick || 60; // default 60 seconds
    const expiresAt = new Date(Date.now() + timePerPick * 1000);

    // Count total picks
    const { count: totalPicks } = await supabase
      .from('fantasy_draft_order')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId);

    // Initialize draft_current_state
    const { error: stateError } = await supabase
      .from('fantasy_draft_current_state')
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
      .from('fantasy_draft_order')
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
  const currentPick = draftState.fantasy_draft_order;

  if (!currentPick || currentPick.is_completed) {
    console.log(`⏭️ Moving to next pick for league ${leagueId}`);
    await moveToNextPick(supabase, leagueId, draftState);
    return;
  }

  // Check if time has expired
  if (currentPick.time_expires) {
    const expiresAt = new Date(currentPick.time_expires);
    console.log(`⏰ processDraftPick: Checking pick #${currentPick.pick_number} - now=${now.getTime()}, expires=${expiresAt.getTime()}, expired=${now >= expiresAt}`);
    if (now >= expiresAt) {
      console.log(`⏰ Time expired for pick #${currentPick.pick_number} in league ${leagueId} - calling autoPickPlayer`);
      await autoPickPlayer(supabase, leagueId, currentPick, draftState);
    } else {
      const secondsRemaining = Math.round((expiresAt.getTime() - now.getTime()) / 1000);
      console.log(`⏳ Pick #${currentPick.pick_number} has ${secondsRemaining}s remaining`);
    }
  } else {
    console.log(`❌ No time_expires found for pick #${currentPick.pick_number}`);
  }
}

/**
 * Auto-pick the best available player when time expires
 * Also enables autodraft for the team that missed their pick
 * Uses AGGRESSIVE dynamic strategy based on remaining cap and remaining picks
 */
async function autoPickPlayer(supabase: any, leagueId: string, currentPick: any, draftState: any) {
  console.log(`🤖 Auto-picking for pick #${currentPick.pick_number} (Round ${currentPick.round})`);
  console.log(`🤖 autoPickPlayer called with leagueId: ${leagueId}, pickId: ${currentPick.id}`);

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
      .from('fantasy_draft_order')
      .select('round')
      .eq('league_id', leagueId)
      .order('round', { ascending: false })
      .limit(1)
      .single();
    
    const totalRounds = roundData?.round || 15;
    
    // Count how many picks this team has already made
    const { count: completedPicks } = await supabase
      .from('fantasy_draft_picks')
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
          .from('fantasy_draft_order')
          .update({
            is_completed: true,
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
        .from('fantasy_roster_spots')
        .select(`
          player_id,
          nba_players!inner(
            nba_hoopshype_salaries(salary_2025_26)
          )
        `)
        .eq('fantasy_team_id', team.id)
        .not('player_id', 'is', null);

      const { data: leagueSeason } = await supabase
        .from('fantasy_league_seasons')
        .select('salary_cap_amount')
        .eq('league_id', leagueId)
        .eq('is_active', true)
        .single();

      const currentSalary = roster?.reduce((sum: number, r: any) => sum + (r.nba_players?.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0), 0) || 0;
      const salaryCap = leagueSeason?.salary_cap_amount || 200000000;
      const remainingCap = salaryCap - currentSalary;
      
      // Get already-drafted players
      const { data: draftedPlayers } = await supabase
        .from('fantasy_draft_picks')
        .select('player_id')
        .eq('league_id', leagueId);

      const draftedPlayerIds = draftedPlayers?.map((p: any) => p.player_id) || [];
      
      // Get ANY available player that fits under the cap
      // Note: We can't order by related table columns in PostgREST, so fetch top 20 and sort in JS
      let fallbackQuery = supabase
        .from('nba_players')
        .select(`
          *,
          nba_hoopshype_salaries!inner(salary_2025_26),
          nba_espn_projections(proj_2026_pts, proj_2026_reb, proj_2026_ast, proj_2026_gp)
        `)
        .eq('is_active', true)
        .lte('nba_hoopshype_salaries.salary_2025_26', remainingCap);
      
      if (draftedPlayerIds.length > 0) {
        fallbackQuery = fallbackQuery.not('id', 'in', `(${draftedPlayerIds.join(',')})`);
      }
      
      const { data: fallbackPlayersRaw, error: fallbackError } = await fallbackQuery.limit(20);
      
      // Sort by salary in JavaScript (highest first) and take the best player
      const fallbackPlayers = fallbackPlayersRaw?.sort((a: any, b: any) => {
        const salaryA = a.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0;
        const salaryB = b.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0;
        return salaryB - salaryA;
      }).slice(0, 1);
      
      if (fallbackError || !fallbackPlayers || fallbackPlayers.length === 0) {
        // Still no players available - this shouldn't happen if canTeamAffordPlayers returned true
        console.error('Fallback query also failed:', fallbackError);
        await supabase
          .from('fantasy_draft_order')
          .update({
            is_completed: true,
            auto_pick_reason: 'no_eligible_players'
          })
          .eq('id', currentPick.id);
        await moveToNextPick(supabase, leagueId, draftState);
        return;
      }
      
      // Use the fallback player
      const fallbackPlayer = fallbackPlayers[0];
      const playerSalary = fallbackPlayer.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0;
      console.log(`🔄 Using fallback player: ${fallbackPlayer.name} (${fallbackPlayer.position}) - $${(playerSalary / 1000000).toFixed(1)}M`);
      
      // Make the pick
      console.log(`📝 Creating fallback draft pick record for ${fallbackPlayer.name}...`);
      const { data: fallbackPickResult, error: pickError } = await supabase
        .rpc('make_draft_pick', {
          league_id_param: leagueId,
          draft_order_id_param: currentPick.id,
          player_id_param: fallbackPlayer.id
        });

      if (pickError) {
        console.error('❌ Error making fallback draft pick:', pickError);
        return;
      }

      console.log('✅ Fallback draft pick record created successfully:', fallbackPickResult);

      // Mark as auto-picked
      const autoPickReason = team.autodraft_enabled ? 'autodraft_enabled' : 'time_expired';
      await supabase
        .from('fantasy_draft_order')
        .update({
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
    console.log(`📝 Creating draft pick record for ${bestPlayer.name}...`);
    const { data: pickResult, error: pickError } = await supabase
      .rpc('make_draft_pick', {
        league_id_param: leagueId,
        draft_order_id_param: currentPick.id,
        player_id_param: bestPlayer.id
      });

    if (pickError) {
      console.error('❌ Error making draft pick:', pickError);
      return;
    }

    console.log('✅ Draft pick record created successfully:', pickResult);

    // Determine auto-pick reason
    const autoPickReason = team.autodraft_enabled ? 'autodraft_enabled' : 'time_expired';

    // Mark as auto-picked
    await supabase
      .from('fantasy_draft_order')
      .update({
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
      
      // Add a system message to draft chat about autodraft being enabled
      try {
        await supabase
          .from('fantasy_draft_chat_messages')
          .insert({
            league_id: leagueId,
            season_id: draftState.season_id,
            user_id: null, // System message
            fantasy_team_id: team.id,
            message: `🤖 Auto-draft enabled for ${team.team_name} (missed pick)`,
            message_type: 'system'
          });
      } catch (chatError) {
        console.warn('Failed to add autodraft message to chat:', chatError);
      }
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
    // Get team's current cap space by querying fantasy_draft_picks
    const { data: roster } = await supabase
      .from('fantasy_draft_picks')
      .select(`
        player_id,
        nba_players!inner(
          id,
          nba_hoopshype_salaries(salary_2025_26)
        )
      `)
      .eq('league_id', leagueId)
      .eq('fantasy_team_id', teamId);

    const { data: leagueSeason } = await supabase
      .from('fantasy_league_seasons')
      .select('salary_cap_amount')
      .eq('league_id', leagueId)
      .eq('is_active', true)
      .single();

    // Calculate current salary from draft picks
    const currentSalary = roster?.reduce((sum: number, r: any) => {
      // Access salary from the nested structure
      const salaryData = r.nba_players?.nba_hoopshype_salaries;
      const salary = Array.isArray(salaryData) ? (salaryData[0]?.salary_2025_26 || 0) : (salaryData?.salary_2025_26 || 0);
      return sum + salary;
    }, 0) || 0;
    
    const salaryCap = leagueSeason?.salary_cap_amount || 200000000;
    const remainingCap = salaryCap - currentSalary;

    // Debug logging
    console.log(`💰 Team ${teamId} salary check: cap=$${(salaryCap/1000000).toFixed(1)}M, current=$${(currentSalary/1000000).toFixed(1)}M, remaining=$${(remainingCap/1000000).toFixed(1)}M, roster_size=${roster?.length || 0}`);

    // Check if team has less than minimum salary ($600,000)
    if (remainingCap < 600000) {
      console.log(`💸 Team ${teamId} is capped out (remaining: $${(remainingCap / 1000000).toFixed(2)}M)`);
      return false;
    }

    // Get all already-drafted player IDs for this league
    const { data: draftedPlayers } = await supabase
      .from('fantasy_draft_picks')
      .select('player_id')
      .eq('league_id', leagueId);

    const draftedPlayerIds = draftedPlayers?.map((p: any) => p.player_id) || [];

    // Check if there are any available players they can afford
    // Note: if no players drafted yet, skip the .not() filter
    let query = supabase
      .from('nba_players')
      .select(`
        id,
        nba_hoopshype_salaries(salary_2025_26)
      `)
      .eq('is_active', true)
      .lte('nba_hoopshype_salaries.salary_2025_26', remainingCap);

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
      .from('fantasy_draft_order')
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
        .from('fantasy_draft_order')
        .update({
          is_completed: true,
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
      .from('fantasy_leagues')
      .select('draft_time_per_pick')
      .eq('id', leagueId)
      .single();

    // Use 3-second timer if team has autodraft enabled, otherwise use full timer
    const timePerPick = nextTeam?.autodraft_enabled ? 3 : (settings?.draft_time_per_pick || 60);
    const expiresAt = new Date(Date.now() + timePerPick * 1000);

    console.log(`⏱️ Next team "${nextTeam?.team_name}" timer: ${timePerPick}s (autodraft: ${nextTeam?.autodraft_enabled})`);

    // Update draft_current_state
    await supabase
      .from('fantasy_draft_current_state')
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
      .from('fantasy_draft_order')
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
    // Update league_seasons status (this is what the frontend checks)
    await supabase
      .from('fantasy_league_seasons')
      .update({ draft_status: 'completed' })
      .eq('league_id', leagueId)
      .eq('is_active', true);

    // Update league status
    await supabase
      .from('fantasy_leagues')
      .update({ draft_status: 'completed' })
      .eq('id', leagueId);

    // Update draft_current_state
    await supabase
      .from('fantasy_draft_current_state')
      .update({
        draft_status: 'completed',
        draft_completed_at: new Date().toISOString()
      })
      .eq('league_id', leagueId);

    // Update league_states to regular_season phase
    await supabase
      .from('fantasy_league_states')
      .update({ current_phase: 'regular_season' })
      .eq('league_id', leagueId);

    console.log(`✅ Draft completed successfully for league ${leagueId}`);
  } catch (error) {
    console.error('Error completing draft:', error);
  }
}

