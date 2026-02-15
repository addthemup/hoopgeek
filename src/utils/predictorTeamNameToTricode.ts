/**
 * Maps nba_daily_team_stats team names (NBA.com style, e.g. "New York Knicks", "LA Clippers")
 * to our app's team tricodes (NYK, LAC). Used to join predictor stats to games by home/away tricode.
 */

export const PREDICTOR_TEAM_NAME_TO_TRICODE: Record<string, string> = {
  'Atlanta Hawks': 'ATL',
  'Boston Celtics': 'BOS',
  'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA',
  'Chicago Bulls': 'CHI',
  'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL',
  'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW',
  'Houston Rockets': 'HOU',
  'Indiana Pacers': 'IND',
  'LA Clippers': 'LAC',
  'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP',
  'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL',
  'Philadelphia 76ers': 'PHI',
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};

/** Normalize TEAM string to title case so "ATLANTA HAWKS" matches "Atlanta Hawks". */
export function normalizePredictorTeamName(teamName: string): string {
  if (!teamName || typeof teamName !== 'string') return '';
  return teamName
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get app tricode for a predictor TEAM string (e.g. from nba_daily_team_stats table or JSON).
 * Handles trim and title-case normalization so "ATLANTA HAWKS" matches "Atlanta Hawks".
 */
export function predictorTeamNameToTricode(teamName: string): string | undefined {
  if (!teamName || typeof teamName !== 'string') return undefined;
  const trimmed = teamName.trim();
  const tricode = PREDICTOR_TEAM_NAME_TO_TRICODE[trimmed];
  if (tricode) return tricode;
  const normalized = normalizePredictorTeamName(trimmed);
  return PREDICTOR_TEAM_NAME_TO_TRICODE[normalized];
}

/**
 * Get tricode with fallback: try exact key, then match by "City Mascot" pattern
 * (e.g. "Philadelphia 76ers" vs "76ers" in our ID map we use city + name).
 */
export function predictorTeamNameToTricodeOrThrow(teamName: string): string {
  const tricode = predictorTeamNameToTricode(teamName);
  if (tricode) return tricode;
  throw new Error(`Unknown predictor team name: "${teamName}"`);
}
