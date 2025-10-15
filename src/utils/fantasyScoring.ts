// Fantasy scoring utilities for translating raw NBA stats to fantasy points

export interface PlayerGameLog {
  id: string;
  player_id: number;
  nba_player_id: number;
  game_id: string;
  game_date: string;
  player_name: string;
  team_abbreviation: string;
  matchup: string;
  wl: string;
  min: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pts: number;
  plus_minus: number;
  jersey_num: number;
  position: string;
  team_city: string;
  team_tricode: string;
  team_name: string;
  created_at: string;
  updated_at: string;
}

export interface FantasyScoringFormat {
  name: string;
  description: string;
  calculatePoints: (stats: PlayerGameLog) => number;
}

// FanDuel Scoring System
export const FANDUEL_SCORING: FantasyScoringFormat = {
  name: 'FanDuel',
  description: 'FanDuel DFS scoring system',
  calculatePoints: (stats: PlayerGameLog) => {
    const points = (stats.pts || 0) * 1.0;           // Points: 1 point per point
    const rebounds = (stats.reb || 0) * 1.2;         // Rebounds: 1.2 points per rebound
    const assists = (stats.ast || 0) * 1.5;          // Assists: 1.5 points per assist
    const steals = (stats.stl || 0) * 2.0;           // Steals: 2 points per steal
    const blocks = (stats.blk || 0) * 2.0;           // Blocks: 2 points per block
    const turnovers = (stats.tov || 0) * -1.0;       // Turnovers: -1 point per turnover
    
    return Math.round((points + rebounds + assists + steals + blocks + turnovers) * 100) / 100;
  }
};

// DraftKings Scoring System
export const DRAFTKINGS_SCORING: FantasyScoringFormat = {
  name: 'DraftKings',
  description: 'DraftKings DFS scoring system',
  calculatePoints: (stats: PlayerGameLog) => {
    const points = (stats.pts || 0) * 1.0;           // Points: 1 point per point
    const rebounds = (stats.reb || 0) * 1.25;        // Rebounds: 1.25 points per rebound
    const assists = (stats.ast || 0) * 1.5;          // Assists: 1.5 points per assist
    const steals = (stats.stl || 0) * 2.0;           // Steals: 2 points per steal
    const blocks = (stats.blk || 0) * 2.0;           // Blocks: 2 points per block
    const turnovers = (stats.tov || 0) * -0.5;       // Turnovers: -0.5 points per turnover
    const doubleDouble = getDoubleDouble(stats) * 1.5; // Double-double: 1.5 bonus points
    const tripleDouble = getTripleDouble(stats) * 3.0; // Triple-double: 3 bonus points
    
    return Math.round((points + rebounds + assists + steals + blocks + turnovers + doubleDouble + tripleDouble) * 100) / 100;
  }
};

// Yahoo Fantasy Scoring System
export const YAHOO_SCORING: FantasyScoringFormat = {
  name: 'Yahoo',
  description: 'Yahoo Fantasy Basketball scoring system',
  calculatePoints: (stats: PlayerGameLog) => {
    const points = (stats.pts || 0) * 1.0;           // Points: 1 point per point
    const rebounds = (stats.reb || 0) * 1.0;         // Rebounds: 1 point per rebound
    const assists = (stats.ast || 0) * 1.0;          // Assists: 1 point per assist
    const steals = (stats.stl || 0) * 2.0;           // Steals: 2 points per steal
    const blocks = (stats.blk || 0) * 2.0;           // Blocks: 2 points per block
    const turnovers = (stats.tov || 0) * -1.0;       // Turnovers: -1 point per turnover
    const fgMade = (stats.fgm || 0) * 0.5;           // Field goals made: 0.5 points each
    const fgMissed = ((stats.fga || 0) - (stats.fgm || 0)) * -0.5; // Field goals missed: -0.5 points each
    const ftMade = (stats.ftm || 0) * 0.5;           // Free throws made: 0.5 points each
    const ftMissed = ((stats.fta || 0) - (stats.ftm || 0)) * -0.5; // Free throws missed: -0.5 points each
    
    return Math.round((points + rebounds + assists + steals + blocks + turnovers + fgMade + fgMissed + ftMade + ftMissed) * 100) / 100;
  }
};

// ESPN Fantasy Scoring System
export const ESPN_SCORING: FantasyScoringFormat = {
  name: 'ESPN',
  description: 'ESPN Fantasy Basketball scoring system',
  calculatePoints: (stats: PlayerGameLog) => {
    const points = (stats.pts || 0) * 1.0;           // Points: 1 point per point
    const rebounds = (stats.reb || 0) * 1.0;         // Rebounds: 1 point per rebound
    const assists = (stats.ast || 0) * 1.0;          // Assists: 1 point per assist
    const steals = (stats.stl || 0) * 2.0;           // Steals: 2 points per steal
    const blocks = (stats.blk || 0) * 2.0;           // Blocks: 2 points per block
    const turnovers = (stats.tov || 0) * -1.0;       // Turnovers: -1 point per turnover
    
    return Math.round((points + rebounds + assists + steals + blocks + turnovers) * 100) / 100;
  }
};

// Custom scoring system (can be configured per league)
export const CUSTOM_SCORING: FantasyScoringFormat = {
  name: 'Custom',
  description: 'Customizable scoring system',
  calculatePoints: (stats: PlayerGameLog) => {
    // Default to FanDuel scoring, but this can be customized per league
    return FANDUEL_SCORING.calculatePoints(stats);
  }
};

// Helper functions
function getDoubleDouble(stats: PlayerGameLog): number {
  let categories = 0;
  if ((stats.pts || 0) >= 10) categories++;
  if ((stats.reb || 0) >= 10) categories++;
  if ((stats.ast || 0) >= 10) categories++;
  if ((stats.stl || 0) >= 10) categories++;
  if ((stats.blk || 0) >= 10) categories++;
  return categories >= 2 ? 1 : 0;
}

function getTripleDouble(stats: PlayerGameLog): number {
  let categories = 0;
  if ((stats.pts || 0) >= 10) categories++;
  if ((stats.reb || 0) >= 10) categories++;
  if ((stats.ast || 0) >= 10) categories++;
  if ((stats.stl || 0) >= 10) categories++;
  if ((stats.blk || 0) >= 10) categories++;
  return categories >= 3 ? 1 : 0;
}

// Available scoring formats
export const SCORING_FORMATS: FantasyScoringFormat[] = [
  FANDUEL_SCORING,
  DRAFTKINGS_SCORING,
  YAHOO_SCORING,
  ESPN_SCORING,
  CUSTOM_SCORING
];

// Utility function to calculate fantasy points for a player game log
export function calculateFantasyPoints(stats: PlayerGameLog, format: FantasyScoringFormat = FANDUEL_SCORING): number {
  return format.calculatePoints(stats);
}

// Utility function to get scoring format by name
export function getScoringFormat(name: string): FantasyScoringFormat {
  return SCORING_FORMATS.find(format => format.name === name) || FANDUEL_SCORING;
}
