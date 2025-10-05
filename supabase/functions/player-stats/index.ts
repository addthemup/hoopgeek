import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Connection': 'keep-alive',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site'
}

interface PlayerStatsResponse {
  player: {
    id: number;
    name: string;
    position: string;
    team: string;
    jersey: string;
    height: string;
    weight: number;
    age: number;
    experience: number;
    college: string;
    draftYear: number;
    draftRound: number;
    draftNumber: number;
  };
  seasonStats: {
    gamesPlayed: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fieldGoalPercentage: number;
    threePointPercentage: number;
    freeThrowPercentage: number;
    minutes: number;
    fantasyPoints: number;
  };
  recentGames: Array<{
    date: string;
    opponent: string;
    points: number;
    rebounds: number;
    assists: number;
    fantasyPoints: number;
  }>;
}

// Helper function to fetch NBA API data
async function fetchNBAData(url: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(url, {
      headers: NBA_HEADERS,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`NBA API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Fetch player basic info
async function fetchPlayerInfo(playerId: string) {
  const url = `https://stats.nba.com/stats/commonplayerinfo?PlayerID=${playerId}`;
  const data = await fetchNBAData(url);
  
  if (!data.resultSets || data.resultSets.length === 0) {
    throw new Error('No player info found');
  }
  
  const playerData = data.resultSets[0].rowSet[0];
  const headers = data.resultSets[0].headers;
  
  const player = {};
  headers.forEach((header: string, index: number) => {
    player[header] = playerData[index];
  });
  
  return player;
}

// Fetch player season stats
async function fetchPlayerSeasonStats(playerId: string) {
  const url = `https://stats.nba.com/stats/playerdashboardbygeneralsplits?PlayerID=${playerId}&Season=2024-25&SeasonType=Regular%20Season&PerMode=PerGame`;
  const data = await fetchNBAData(url);
  
  if (!data.resultSets || data.resultSets.length === 0) {
    throw new Error('No season stats found');
  }
  
  const statsData = data.resultSets[0].rowSet[0];
  const headers = data.resultSets[0].headers;
  
  const stats = {};
  headers.forEach((header: string, index: number) => {
    stats[header] = statsData[index];
  });
  
  return stats;
}

// Fetch recent games
async function fetchPlayerGameLog(playerId: string) {
  const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${playerId}&Season=2024-25&SeasonType=Regular%20Season`;
  const data = await fetchNBAData(url);
  
  if (!data.resultSets || data.resultSets.length === 0) {
    throw new Error('No game log found');
  }
  
  const gamesData = data.resultSets[0].rowSet.slice(0, 5); // Get last 5 games
  const headers = data.resultSets[0].headers;
  
  return gamesData.map((game: any[]) => {
    const gameObj = {};
    headers.forEach((header: string, index: number) => {
      gameObj[header] = game[index];
    });
    return gameObj;
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { playerId } = await req.json()

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: 'Player ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Fetching real NBA stats for player ID: ${playerId}`)

    // First, get the NBA player ID from our database
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()

    if (playerError || !playerData) {
      console.error('Error fetching player from database:', playerError)
      return new Response(
        JSON.stringify({ error: 'Player not found in database' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const nbaPlayerId = playerData.nba_player_id
    console.log(`Found NBA player ID: ${nbaPlayerId} for player: ${playerData.name}`)

    try {
      console.log(`Attempting to fetch real NBA data for player ${playerId}...`);
      
      // Fetch all player data in parallel using the NBA player ID
      const [playerInfo, seasonStats, gameLog] = await Promise.all([
        fetchPlayerInfo(nbaPlayerId.toString()),
        fetchPlayerSeasonStats(nbaPlayerId.toString()),
        fetchPlayerGameLog(nbaPlayerId.toString())
      ]);

      console.log('Successfully fetched NBA API data:', {
        playerInfo: playerInfo.DISPLAY_FIRST_LAST,
        seasonStats: seasonStats.PTS,
        gameLogCount: gameLog.length
      });

      // Calculate fantasy points (PTS + REB + AST + STL + BLK - TO)
      const fantasyPoints = (seasonStats.PTS || 0) + 
                           (seasonStats.REB || 0) + 
                           (seasonStats.AST || 0) + 
                           (seasonStats.STL || 0) + 
                           (seasonStats.BLK || 0) - 
                           (seasonStats.TOV || 0);

      // Transform recent games data
      const recentGames = gameLog.map((game: any) => {
        const gameFantasyPoints = (game.PTS || 0) + 
                                 (game.REB || 0) + 
                                 (game.AST || 0) + 
                                 (game.STL || 0) + 
                                 (game.BLK || 0) - 
                                 (game.TOV || 0);

        return {
          date: game.GAME_DATE || '',
          opponent: game.MATCHUP ? game.MATCHUP.split(' ').pop() : '',
          points: game.PTS || 0,
          rebounds: game.REB || 0,
          assists: game.AST || 0,
          fantasyPoints: Math.round(gameFantasyPoints * 10) / 10
        };
      });

      const playerStats: PlayerStatsResponse = {
        player: {
          id: parseInt(playerId), // Use our database ID
          name: playerInfo.DISPLAY_FIRST_LAST || playerData.name || 'Unknown Player',
          position: playerInfo.POSITION || 'N/A',
          team: playerInfo.TEAM_ABBREVIATION || 'N/A',
          jersey: playerInfo.JERSEY || '',
          height: playerInfo.HEIGHT || '',
          weight: playerInfo.WEIGHT || 0,
          age: playerInfo.AGE || 0,
          experience: playerInfo.SEASON_EXP || 0,
          college: playerInfo.SCHOOL || 'N/A',
          draftYear: playerInfo.DRAFT_YEAR || 0,
          draftRound: playerInfo.DRAFT_ROUND || 0,
          draftNumber: playerInfo.DRAFT_NUMBER || 0
        },
        seasonStats: {
          gamesPlayed: seasonStats.GP || 0,
          points: seasonStats.PTS || 0,
          rebounds: seasonStats.REB || 0,
          assists: seasonStats.AST || 0,
          steals: seasonStats.STL || 0,
          blocks: seasonStats.BLK || 0,
          turnovers: seasonStats.TOV || 0,
          fieldGoalPercentage: seasonStats.FG_PCT ? Math.round(seasonStats.FG_PCT * 1000) / 10 : 0,
          threePointPercentage: seasonStats.FG3_PCT ? Math.round(seasonStats.FG3_PCT * 1000) / 10 : 0,
          freeThrowPercentage: seasonStats.FT_PCT ? Math.round(seasonStats.FT_PCT * 1000) / 10 : 0,
          minutes: seasonStats.MIN || 0,
          fantasyPoints: Math.round(fantasyPoints * 10) / 10
        },
        recentGames
      };

      console.log('Returning real NBA data for player:', playerStats.player.name);
      
      return new Response(
        JSON.stringify(playerStats),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (nbaError) {
      console.error('NBA API Error:', nbaError);
      console.error('Error details:', {
        message: nbaError.message,
        name: nbaError.name,
        stack: nbaError.stack
      });
      
      // Fallback to mock data if NBA API fails
      console.log('Falling back to mock data due to NBA API error');
      
      // Use real player data from our database as fallback
      const fallbackPlayerStats: PlayerStatsResponse = {
        player: {
          id: parseInt(playerId),
          name: playerData.name || 'Unknown Player',
          position: playerData.position || 'N/A',
          team: playerData.team_abbreviation || 'N/A',
          jersey: playerData.jersey_number?.toString() || '',
          height: playerData.height || 'N/A',
          weight: playerData.weight || 0,
          age: playerData.age || 0,
          experience: playerData.years_pro || 0,
          college: playerData.college || 'N/A',
          draftYear: playerData.draft_year || 0,
          draftRound: playerData.draft_round || 0,
          draftNumber: playerData.draft_number || 0
        },
        seasonStats: {
          gamesPlayed: 0, // We don't have season stats in our database yet
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fieldGoalPercentage: 0,
          threePointPercentage: 0,
          freeThrowPercentage: 0,
          minutes: 0,
          fantasyPoints: 0
        },
        recentGames: [] // We don't have game logs in our database yet
      };

      console.log('Returning fallback data for player:', fallbackPlayerStats.player.name);
      
      return new Response(
        JSON.stringify(fallbackPlayerStats),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Error fetching player stats:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch player stats' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
