/**
 * Game JSON Loader
 * 
 * Loads complete game data from JSON files scraped from NBA API.
 * For now, loads from scripts/feed directory. Eventually will load from bucket.
 */

export interface GameJsonData {
  gameId: string;
  gameMetadata?: {
    date: string;
    arena: string | null;
    season: string;
    status: string | null;
    homeTeam: {
      team_id: number;
      abbreviation: string;
      city: string;
      name: string;
      record: string | null;
      quarters: (number | null)[];
      points: number;
      stats: {
        fg_pct: number;
        ft_pct: number;
        fg3_pct: number;
        ast: number;
        reb: number;
        tov: number;
      };
    };
    awayTeam: {
      team_id: number;
      abbreviation: string;
      city: string;
      name: string;
      record: string | null;
      quarters: (number | null)[];
      points: number;
      stats: {
        fg_pct: number;
        ft_pct: number;
        fg3_pct: number;
        ast: number;
        reb: number;
        tov: number;
      };
    };
    teamLeaders: any;
    lastMeeting: any;
    seriesStandings: any;
  };
  score?: {
    [gameId: string]: {
      team_stats?: {
        'Margin of Victory': number;
        'Combined Threes': number;
        'Team Threes': Record<string, number>;
        'Combined Three %': number;
        'Team Three %': Record<string, number>;
        'Pace': number;
        'Team Pace': Record<string, number>;
        'Combined Contested Shots': number;
        'Team Contested Shots': Record<string, number>;
        'Combined Contested Shot %': number;
        'Team Contested Shot %': Record<string, number>;
        'Combined Contested Threes': number;
        'Team Contested Threes': Record<string, number>;
        'Combined Contested Three %': number;
        'Team Contested Three %': Record<string, number>;
        'Combined Fast Break Points': number;
        'Team Fast Break Points': Record<string, number>;
      };
      lead_changes?: {
        total: number;
        last_5_minutes: number;
        last_minute: number;
        buzzer_beater: number;
      };
      dunk_stats?: {
        'Alley Oop': number;
        'Putback': number;
        'Running': number;
        'Driving': number;
        'Tip': number;
        'Cutting': number;
        'Total Dunks': number;
      };
      deep_shots?: {
        deep_threes: number;
        four_pointers: number;
      };
      scoring_milestones?: {
        '70 Ball': Array<[string, number]>;
        '60 Ball': Array<[string, number]>;
        '50 Ball': Array<[string, number]>;
        '40 Ball': Array<[string, number]>;
        'Triple Double': Array<[string, string]>;
      };
      fun_score?: number;
    };
  };
  story?: {
    matchup: string;
    final_score: string;
    advantages: Array<{
      stat_name: string;
      team: string;
      teamId: number;
      teamTricode: string;
      value1: number;
      value2: number;
      diff: number;
    }>;
    teams: {
      winner: {
        name: string;
        city: string;
        tricode: string;
        teamId: number;
        points: number;
      };
      loser: {
        name: string;
        city: string;
        tricode: string;
        teamId: number;
        points: number;
      };
    };
  };
  script?: any;
  playByPlay?: {
    allPlays: Array<{
      gameId: string;
      eventNum: number;
      actionId: number;
      period: number;
      clock: string;
      description: string;
      teamId: number | null;
      teamTricode: string | null;
      scoreHome: string;
      scoreAway: string;
      videoAvailable: number;
      actionType: string;
      subType: string | null;
      shotResult: string | null;
      shotDistance: number | null;
      isFieldGoal: number;
      playerName: string | null;
      playerNameI: string | null;
      personId: number | null;
      xLegacy: number | null;
      yLegacy: number | null;
      location: string | null;
      pointsTotal: number;
      mp4: string | null;
      mp4_local: string | null;
    }>;
  };
  shotCharts?: {
    [playerId: string]: Array<{
      GRID_TYPE: string;
      GAME_ID: string;
      GAME_EVENT_ID: number;
      PLAYER_ID: number;
      PLAYER_NAME: string;
      TEAM_ID: number;
      TEAM_NAME: string;
      PERIOD: number;
      MINUTES_REMAINING: number;
      SECONDS_REMAINING: number;
      EVENT_TYPE: string;
      ACTION_TYPE: string;
      SHOT_TYPE: string;
      SHOT_ZONE_BASIC: string;
      SHOT_ZONE_AREA: string;
      SHOT_ZONE_RANGE: string;
      SHOT_DISTANCE: number;
      LOC_X: number;
      LOC_Y: number;
      SHOT_ATTEMPTED_FLAG: number;
      SHOT_MADE_FLAG: number;
      GAME_DATE: string;
      HTM: string;
      VTM: string;
    }>;
  };
}

/**
 * Load game JSON data by game ID
 * For now, tries to fetch from /scripts/feed/{gameId}.json
 * Eventually will fetch from bucket or Supabase Storage
 */
export async function loadGameJson(gameId: string): Promise<GameJsonData | null> {
  try {
    // Try multiple possible paths for development
    const possiblePaths = [
      `/scripts/feed/${gameId}.json`,
      `/game-data/${gameId}.json`,
      `/game-data/feed/${gameId}.json`,
      `/${gameId}.json`,
    ];
    
    for (const path of possiblePaths) {
      try {
        const response = await fetch(path);
        
        if (response.ok) {
          const data = await response.json();
          // Monolithic scrape uses `shotChartData`; keep `shotCharts` alias for older typings/paths
          const d = data as GameJsonData & { shotChartData?: GameJsonData['shotCharts'] };
          if (d.shotChartData && !d.shotCharts) {
            (d as any).shotCharts = d.shotChartData;
          }
          console.log(`✅ Loaded game JSON from ${path}`);
          return d as GameJsonData;
        }
      } catch (err) {
        // Try next path
        continue;
      }
    }
    
    console.warn(`⚠️ Game JSON not found for ${gameId} in any of the expected paths`);
    return null;
  } catch (error) {
    console.error(`Error loading game JSON for ${gameId}:`, error);
    return null;
  }
}

/**
 * Get score data for a game
 */
export function getScoreData(gameData: GameJsonData | null): GameJsonData['score'][string] | null {
  if (!gameData || !gameData.score) return null;
  
  const gameId = gameData.gameId;
  return gameData.score[gameId] || Object.values(gameData.score)[0] || null;
}

/**
 * Get fun score for a game
 */
export function getFunScore(gameData: GameJsonData | null): number | null {
  const scoreData = getScoreData(gameData);
  return scoreData?.fun_score ?? null;
}

/**
 * Get lead changes for a game
 */
export function getLeadChanges(gameData: GameJsonData | null) {
  const scoreData = getScoreData(gameData);
  return scoreData?.lead_changes ?? null;
}

/**
 * Get dunk stats for a game
 */
export function getDunkStats(gameData: GameJsonData | null) {
  const scoreData = getScoreData(gameData);
  return scoreData?.dunk_stats ?? null;
}

/**
 * Get scoring milestones for a game
 */
export function getScoringMilestones(gameData: GameJsonData | null) {
  const scoreData = getScoreData(gameData);
  return scoreData?.scoring_milestones ?? null;
}

/**
 * Get team stats for a game
 */
export function getTeamStats(gameData: GameJsonData | null) {
  const scoreData = getScoreData(gameData);
  return scoreData?.team_stats ?? null;
}

/**
 * Get play-by-play data for a game
 */
export function getPlayByPlay(gameData: GameJsonData | null) {
  return gameData?.playByPlay?.allPlays ?? null;
}

/**
 * Get story/advantages data for a game
 */
export function getStoryData(gameData: GameJsonData | null) {
  return gameData?.story ?? null;
}

/**
 * Get quarter scores for a game
 */
export function getQuarterScores(gameData: GameJsonData | null) {
  if (!gameData?.gameMetadata) return null;
  
  const homeQuarters = gameData.gameMetadata.homeTeam?.quarters ?? [];
  const awayQuarters = gameData.gameMetadata.awayTeam?.quarters ?? [];
  
  // Filter out null values and create quarter-by-quarter breakdown
  const quarters = [];
  for (let i = 0; i < Math.max(homeQuarters.length, awayQuarters.length); i++) {
    const homeScore = homeQuarters[i];
    const awayScore = awayQuarters[i];
    
    if (homeScore !== null || awayScore !== null) {
      quarters.push({
        quarter: i + 1,
        home: homeScore ?? 0,
        away: awayScore ?? 0,
      });
    }
  }
  
  return quarters.length > 0 ? quarters : null;
}
