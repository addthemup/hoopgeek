/**
 * Cloudflare Worker: Update Live NBA Stats
 * Runs every minute during game hours to fetch and store LIVE player stats
 * 
 * This worker:
 * 1. Fetches today's NBA scoreboard
 * 2. Identifies LIVE games only (status = 2)
 * 3. Fetches box scores
 * 4. Stores raw stats in live_player_stats
 * 
 * Note: Final games (status = 3) are handled by nba_boxscores table via nightly import
 */

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async scheduled(event, env, ctx) {
    console.log('🏀 Cron triggered - Starting live stats update...');
    try {
      const result = await updateLiveStats(env);
      console.log('✅ Cron completed:', result);
    } catch (error) {
      console.error('❌ Cron failed:', error);
    }
  },

  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    console.log('🏀 Manual trigger - Starting live stats update...');
    try {
      const result = await updateLiveStats(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      console.error('❌ Error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};

// ============================================================================
// CORE LOGIC
// ============================================================================

async function updateLiveStats(env) {
  const startTime = Date.now();

  let scoreboard;
  try {
    scoreboard = await fetchNBAScoreboard();
  } catch (e) {
    console.error('❌ Failed to fetch NBA scoreboard:', e.message);
    throw e;
  }
  // Support both { scoreboard: { games } } and { games } response shapes
  const games = scoreboard?.scoreboard?.games ?? scoreboard?.games ?? [];

  console.log(`📊 Found ${games.length} games today`);
  
  // ONLY process LIVE games (status = 2), skip final games
  const liveGames = games.filter(game => game.gameStatus === 2);
  
  console.log(`🎮 ${liveGames.length} games are LIVE (ignoring final games)`);
  
  let totalPlayersUpdated = 0;
  
  // Process live games if any exist
  if (liveGames.length > 0) {
    for (const game of liveGames) {
      const playersUpdated = await processGame(game, env);
      totalPlayersUpdated += playersUpdated;
    }
    await updateMarkerTable(env, liveGames.length, totalPlayersUpdated);
  }
  
  return {
    success: true,
    message: `Updated ${totalPlayersUpdated} players from ${liveGames.length} live games`,
    gamesProcessed: liveGames.length,
    playersUpdated: totalPlayersUpdated,
    duration: `${Date.now() - startTime}ms`,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// NBA API FUNCTIONS
// ============================================================================

async function fetchNBAScoreboard() {
  const url = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Scoreboard API ${response.status}: ${text.slice(0, 200)}`);
  }
  return await response.json();
}

async function fetchBoxScore(gameId) {
  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Box score ${gameId} API ${response.status}: ${text.slice(0, 200)}`);
  }
  return await response.json();
}

// ============================================================================
// GAME PROCESSING
// ============================================================================

async function processGame(game, env) {
  const gameId = game.gameId;
  
  try {
    const boxScore = await fetchBoxScore(gameId);
    const homeTeam = boxScore.game?.homeTeam || {};
    const awayTeam = boxScore.game?.awayTeam || {};
    const allPlayers = [...(homeTeam.players || []), ...(awayTeam.players || [])];
    
    if (allPlayers.length === 0) {
      console.log(`⚠️  No players found for game ${gameId}`);
      return 0;
    }
    
    console.log(`📊 Processing ${allPlayers.length} players for LIVE game ${gameId}`);
    
    let playersUpdated = 0;
    for (const player of allPlayers) {
      const stats = player.statistics || {};
      const personId = player.personId ?? player.person_id ?? player.id;
      if (!personId) {
        console.warn(`⚠️  Skipping player with no id in game ${gameId}:`, player);
        continue;
      }
      // Skip players who haven't played
      if (!stats.minutes || stats.minutes === 'PT00M00.00S') continue;

      const convertedStats = {
        pts: stats.points || 0,
        reb: stats.reboundsTotal || 0,
        ast: stats.assists || 0,
        stl: stats.steals || 0,
        blk: stats.blocks || 0,
        tov: stats.turnovers || 0,
        fgm: stats.fieldGoalsMade || 0,
        fga: stats.fieldGoalsAttempted || 0,
        fg_pct: stats.fieldGoalsPercentage || 0,
        fg3m: stats.threePointersMade || 0,
        fg3a: stats.threePointersAttempted || 0,
        fg3_pct: stats.threePointersPercentage || 0,
        ftm: stats.freeThrowsMade || 0,
        fta: stats.freeThrowsAttempted || 0,
        ft_pct: stats.freeThrowsPercentage || 0,
        oreb: stats.reboundsOffensive || 0,
        dreb: stats.reboundsDefensive || 0,
        pf: stats.foulsPersonal || 0,
        min: convertMinutes(stats.minutes),
        plus_minus: stats.plusMinusPoints || 0,
      };
      
      const playerName = player.firstName != null && player.familyName != null
        ? `${player.firstName} ${player.familyName}`
        : (player.name ?? player.playerName ?? `Player ${personId}`);
      const success = await upsertPlayerStats(env, {
        game_id: gameId,
        nba_player_id: personId,
        player_name: playerName,
        team_tricode: player.teamTricode ?? player.team_tricode ?? null,
        team_id: player.teamId ?? player.team_id ?? null,
        stats: convertedStats,
        raw_stats: stats,
      });
      
      if (success) playersUpdated++;
    }
    
    console.log(`✅ Updated ${playersUpdated} players for game ${gameId}`);
    return playersUpdated;
    
  } catch (error) {
    console.error(`❌ Error processing game ${gameId}:`, error);
    return 0;
  }
}

// ============================================================================
// SUPABASE FUNCTIONS
// ============================================================================

async function upsertPlayerStats(env, data) {
  // Add on_conflict parameter to properly handle upserts
  const url = `${env.SUPABASE_URL}/rest/v1/live_player_stats?on_conflict=game_id,nba_player_id`;
  
  try {
    const payload = { 
      ...data, 
      updated_at: new Date().toISOString()
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Supabase upsert failed (${response.status}) for ${data.player_name}:`, errorBody);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`❌ Error upserting player stats for ${data.player_name}:`, error);
    return false;
  }
}

async function updateMarkerTable(env, gamesProcessed, playersUpdated) {
  const url = `${env.SUPABASE_URL}/rest/v1/live_stats_updates`;
  const today = new Date().toISOString().split('T')[0];
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        date: today,
        last_updated: new Date().toISOString(),
        status: 'active',
        games_processed: gamesProcessed,
        players_updated: playersUpdated,
      }),
    });
    return true;
  } catch (error) {
    console.error('❌ Error updating marker table:', error);
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function convertMinutes(minutesString) {
  if (!minutesString || minutesString === 'PT00M00.00S') return 0;
  const match = minutesString.match(/PT(\d+)M(\d+(?:\.\d+)?)S/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseFloat(match[2]);
  return Math.round((minutes + seconds / 60) * 100) / 100;
}
