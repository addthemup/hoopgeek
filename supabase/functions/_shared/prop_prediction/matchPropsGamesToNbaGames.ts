/**
 * Utility to match player_props_games with nba_games
 * 
 * Since player_props_games.nba_game_id is often null, we need to match by:
 * 1. Date (converting to EST for comparison)
 * 2. Team names/tricodes (handling variations)
 */

import { utcToESTDate } from './nbaDateUtils.ts'

interface NbaGame {
  game_id: string;
  game_date: string;
  home_team_tricode: string | null;
  away_team_tricode: string | null;
  home_team_name?: string | null;
  away_team_name?: string | null;
  home_team_city?: string | null;
  away_team_city?: string | null;
}

interface PropsGame {
  id: string;
  event_id: string;
  game_date: string;
  home_team: string | null;
  away_team: string | null;
  home_team_tricode: string | null;
  away_team_tricode: string | null;
  nba_game_id: string | null;
}

/**
 * Normalize team name for matching (handles variations like "Los Angeles Lakers" vs "Lakers")
 */
function normalizeTeamName(name: string | null | undefined): string {
  if (!name) return '';
  
  const normalized = name.toLowerCase().trim();
  
  // Remove common prefixes
  const prefixes = ['los angeles', 'new york', 'golden state', 'san antonio', 'new orleans', 'oklahoma city'];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      return normalized.substring(prefix.length).trim();
    }
  }
  
  return normalized;
}

/**
 * Extract team name parts (city and team name)
 */
function getTeamParts(name: string): { city: string; team: string; full: string } {
  if (!name) return { city: '', team: '', full: '' };
  
  const normalized = name.toLowerCase().trim();
  
  // Common team name patterns
  const teamNames = [
    'bulls', 'lakers', 'warriors', 'heat', 'celtics', 'knicks', 'nets', '76ers', 'sixers',
    'raptors', 'wizards', 'hawks', 'hornets', 'cavaliers', 'cavs', 'pistons', 'pacers',
    'bucks', 'magic', 'pelicans', 'thunder', 'mavericks', 'mavs', 'rockets', 'spurs',
    'grizzlies', 'jazz', 'trail blazers', 'blazers', 'nuggets', 'timberwolves', 'wolves',
    'kings', 'suns', 'clippers', 'pistons'
  ];
  
  // Try to extract city and team name
  for (const teamName of teamNames) {
    if (normalized.includes(teamName)) {
      const teamIndex = normalized.indexOf(teamName);
      const city = normalized.substring(0, teamIndex).trim();
      const team = teamName;
      return { city, team, full: normalized };
    }
  }
  
  // If no pattern found, return as-is
  return { city: '', team: normalized, full: normalized };
}

/**
 * Check if two team names match (handles variations)
 */
function teamsMatch(name1: string | null | undefined, name2: string | null | undefined): boolean {
  if (!name1 || !name2) return false;
  
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  // Exact match
  if (n1 === n2) return true;
  
  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Extract parts and compare
  const parts1 = getTeamParts(n1);
  const parts2 = getTeamParts(n2);
  
  // Match by team name (e.g., "Bulls" matches "Chicago Bulls")
  if (parts1.team && parts2.team && parts1.team === parts2.team) return true;
  
  // Match if one team name contains the other
  if (parts1.team && parts2.team && (parts1.team.includes(parts2.team) || parts2.team.includes(parts1.team))) {
    return true;
  }
  
  // Match by full name containing team name
  if (parts1.team && n2.includes(parts1.team)) return true;
  if (parts2.team && n1.includes(parts2.team)) return true;
  
  return false;
}

/**
 * Normalize date to EST date string (YYYY-MM-DD)
 */
function normalizeToESTDate(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    // If it's a full timestamp, convert to EST
    if (dateStr.includes('T') || dateStr.includes(' ')) {
      const date = new Date(dateStr);
      return utcToESTDate(date);
    } else {
      // Date string only - treat as UTC midnight and convert to EST
      const utcDate = new Date(dateStr + 'T00:00:00Z');
      return utcToESTDate(utcDate);
    }
  } catch (e) {
    console.warn('Error normalizing date:', dateStr, e);
    return dateStr.split('T')[0]; // Fallback to just the date part
  }
}

/** Return date string YYYY-MM-DD as sortable; 0 = exact, 1 = off by 1 day, 2 = off by 2 days */
function dateDistance(dateA: string, dateB: string): number {
  if (!dateA || !dateB) return 999;
  const a = dateA.slice(0, 10);
  const b = dateB.slice(0, 10);
  if (a === b) return 0;
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  const diffDays = Math.abs(Math.round((d2 - d1) / 86400000));
  return Math.min(diffDays, 2);
}

/**
 * Match a single player_props_game to an nba_game.
 * Allows ±1 day on date so props feed offset doesn't drop games.
 */
export function matchPropsGameToNbaGame(
  propsGame: PropsGame,
  nbaGames: NbaGame[]
): NbaGame | null {
  // If nba_game_id is already set and matches, use it
  if (propsGame.nba_game_id) {
    const matched = nbaGames.find(g => g.game_id === propsGame.nba_game_id);
    if (matched) return matched;
  }

  const propsGameDateEST = normalizeToESTDate(propsGame.game_date);
  if (!propsGameDateEST) return null;

  // Include nba games within ±1 day (props feed often off by one calendar day)
  const candidates = nbaGames
    .map(nbaGame => ({
      game: nbaGame,
      nbaDateEST: normalizeToESTDate(nbaGame.game_date),
    }))
    .filter(
      ({ nbaDateEST }) =>
        nbaDateEST &&
        dateDistance(propsGameDateEST, nbaDateEST) <= 1
    )
    .sort((a, b) => dateDistance(propsGameDateEST, a.nbaDateEST) - dateDistance(propsGameDateEST, b.nbaDateEST))
    .map(({ game }) => game);

  if (candidates.length === 0) return null;

  const tryMatch = (list: NbaGame[]): NbaGame | null => {
    if (propsGame.home_team_tricode && propsGame.away_team_tricode) {
      const byTricode = list.find(nbaGame => {
        if (!nbaGame.home_team_tricode || !nbaGame.away_team_tricode) return false;
        const m1 =
          nbaGame.home_team_tricode === propsGame.home_team_tricode &&
          nbaGame.away_team_tricode === propsGame.away_team_tricode;
        const m2 =
          nbaGame.home_team_tricode === propsGame.away_team_tricode &&
          nbaGame.away_team_tricode === propsGame.home_team_tricode;
        return m1 || m2;
      });
      if (byTricode) return byTricode;
    }
    if (propsGame.home_team && propsGame.away_team) {
      const byName = list.find(nbaGame => {
        const homeLabel = nbaGame.home_team_name || (nbaGame.home_team_city ?? '') + ' ' + (nbaGame.home_team_name || '');
        const awayLabel = nbaGame.away_team_name || (nbaGame.away_team_city ?? '') + ' ' + (nbaGame.away_team_name || '');
        const m1 = teamsMatch(propsGame.home_team, homeLabel) && teamsMatch(propsGame.away_team, awayLabel);
        const m2 = teamsMatch(propsGame.home_team, nbaGame.away_team_name || '') && teamsMatch(propsGame.away_team, nbaGame.home_team_name || '');
        return m1 || m2;
      });
      if (byName) return byName;
    }
    return null;
  };

  return tryMatch(candidates) ?? null;
}

/**
 * Match multiple player_props_games to nba_games
 * Returns a Map of props_game.id -> nba_game
 */
export function matchPropsGamesToNbaGames(
  propsGames: PropsGame[],
  nbaGames: NbaGame[]
): Map<string, NbaGame> {
  const matches = new Map<string, NbaGame>();
  
  for (const propsGame of propsGames) {
    const matched = matchPropsGameToNbaGame(propsGame, nbaGames);
    if (matched) {
      matches.set(propsGame.id, matched);
    }
  }
  
  return matches;
}

/**
 * Get nba_game_id for a player_props_game
 * Returns the nba_game_id if a match is found, null otherwise
 */
export function getNbaGameIdForPropsGame(
  propsGame: PropsGame,
  nbaGames: NbaGame[]
): string | null {
  const matched = matchPropsGameToNbaGame(propsGame, nbaGames);
  return matched?.game_id || null;
}
