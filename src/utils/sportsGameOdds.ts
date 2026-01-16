import SportsGameOdds from 'sports-odds-api';

// Rate limiting: 10 requests per minute
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 10;
  private readonly windowMs = 60 * 1000; // 1 minute

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Remove requests older than the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // If we're at the limit, wait until the oldest request expires
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add 100ms buffer
      
      if (waitTime > 0) {
        console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Record this request
    this.requests.push(Date.now());
  }
}

const rateLimiter = new RateLimiter();

// Initialize client
const getClient = () => {
  const apiKey = import.meta.env.VITE_SPORTS_ODDS_API_KEY || '79ae5f47830d3d87e70896e36b5eefc3';
  
  return new SportsGameOdds({
    apiKeyHeader: apiKey,
    timeout: 20 * 1000, // 20 seconds
    maxRetries: 3,
  });
};

// Map NBA team tricodes to full team names for SportsGameOdds API
// The API likely uses full team names like "Los Angeles Lakers" or "Lakers"
const TEAM_NAME_MAP: Record<string, string[]> = {
  'ATL': ['Atlanta Hawks', 'Hawks'],
  'BOS': ['Boston Celtics', 'Celtics'],
  'BKN': ['Brooklyn Nets', 'Nets'],
  'CHA': ['Charlotte Hornets', 'Hornets'],
  'CHI': ['Chicago Bulls', 'Bulls'],
  'CLE': ['Cleveland Cavaliers', 'Cavaliers'],
  'DAL': ['Dallas Mavericks', 'Mavericks'],
  'DEN': ['Denver Nuggets', 'Nuggets'],
  'DET': ['Detroit Pistons', 'Pistons'],
  'GSW': ['Golden State Warriors', 'Warriors'],
  'HOU': ['Houston Rockets', 'Rockets'],
  'IND': ['Indiana Pacers', 'Pacers'],
  'LAC': ['LA Clippers', 'Clippers', 'Los Angeles Clippers'],
  'LAL': ['Los Angeles Lakers', 'Lakers'],
  'MEM': ['Memphis Grizzlies', 'Grizzlies'],
  'MIA': ['Miami Heat', 'Heat'],
  'MIL': ['Milwaukee Bucks', 'Bucks'],
  'MIN': ['Minnesota Timberwolves', 'Timberwolves'],
  'NOP': ['New Orleans Pelicans', 'Pelicans'],
  'NYK': ['New York Knicks', 'Knicks'],
  'OKC': ['Oklahoma City Thunder', 'Thunder'],
  'ORL': ['Orlando Magic', 'Magic'],
  'PHI': ['Philadelphia 76ers', '76ers'],
  'PHX': ['Phoenix Suns', 'Suns'],
  'POR': ['Portland Trail Blazers', 'Trail Blazers'],
  'SAC': ['Sacramento Kings', 'Kings'],
  'SAS': ['San Antonio Spurs', 'Spurs'],
  'TOR': ['Toronto Raptors', 'Raptors'],
  'UTA': ['Utah Jazz', 'Jazz'],
  'WAS': ['Washington Wizards', 'Wizards'],
};

export interface PlayerProp {
  betType: string;
  betTypeId: string;
  line?: number;
  price?: string;
  bookmaker: string;
  bookmakerId: string;
  period?: string; // e.g., 'game', '1q', '2q', '1h', '2h'
}

export interface GameWithProps {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamTricode?: string;
  awayTeamTricode?: string;
  startsAt?: string;
  playerProps: PlayerProp[];
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Find NBA events for today
 */
export async function getTodaysNBAGames(): Promise<any[]> {
  await rateLimiter.waitIfNeeded();
  
  const client = getClient();
  const today = getTodayDateString();
  
  try {
    console.log(`📊 Fetching NBA games for ${today}...`);
    
    // Fetch NBA events with odds available
    const page = await client.events.get({
      leagueID: 'NBA',
      oddsAvailable: true,
      finalized: false,
      limit: 50,
    });
    
    console.log(`📊 Found ${page.data.length} NBA games with odds`);
    
    // Filter for today's games
    const todaysGames = page.data.filter((event: any) => {
      if (!event.status?.startsAt) return false;
      const eventDate = new Date(event.status.startsAt);
      const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
      return eventDateStr === today;
    });
    
    console.log(`📊 Found ${todaysGames.length} games today`);
    return todaysGames;
  } catch (error) {
    console.error('❌ Error fetching NBA games:', error);
    throw error;
  }
}

/**
 * Find a game by team tricode
 */
export async function findGameByTeam(teamTricode: string): Promise<any | null> {
  const games = await getTodaysNBAGames();
  const teamNames = TEAM_NAME_MAP[teamTricode] || [];
  
  if (teamNames.length === 0) {
    console.warn(`⚠️ No team name mapping for ${teamTricode}`);
    return null;
  }
  
  // Try to find a game where either team matches
  for (const game of games) {
    const homeTeam = game.teams?.home?.name || '';
    const awayTeam = game.teams?.away?.name || '';
    
    // Check if any team name variant matches
    const homeMatches = teamNames.some(name => 
      homeTeam.toLowerCase().includes(name.toLowerCase()) || 
      name.toLowerCase().includes(homeTeam.toLowerCase())
    );
    const awayMatches = teamNames.some(name => 
      awayTeam.toLowerCase().includes(name.toLowerCase()) || 
      name.toLowerCase().includes(awayTeam.toLowerCase())
    );
    
    if (homeMatches || awayMatches) {
      console.log(`✅ Found game: ${awayTeam} @ ${homeTeam}`);
      return game;
    }
  }
  
  console.log(`⚠️ No game found for team ${teamTricode}`);
  return null;
}

/**
 * Extract player props from an event
 * Player props are typically in the odds object with specific betTypeIDs
 * Based on SportsGameOdds API structure: odds is an object keyed by oddID
 */
export function extractPlayerProps(event: any, playerName?: string): PlayerProp[] {
  if (!event.odds || typeof event.odds !== 'object') {
    return [];
  }
  
  const props: PlayerProp[] = [];
  
  // Common player prop bet types
  const playerPropTypes = [
    'points', 'point', 'pts', 'rebounds', 'rebound', 'reb', 'assists', 'assist', 'ast',
    'steals', 'steal', 'stl', 'blocks', 'block', 'blk', 
    'threes', 'three', '3pt', '3-pointer', '3pm',
    'points_rebounds', 'points_assists', 'rebounds_assists',
    'points_rebounds_assists', 'p+r+a', 'pra',
    'double_double', 'triple_double', 'dd', 'td'
  ];
  
  const playerNameLower = playerName?.toLowerCase() || '';
  
  // Iterate through odds object (keyed by oddID)
  for (const [oddID, odd] of Object.entries(event.odds)) {
    const oddData = odd as any;
    
    if (!oddData || typeof oddData !== 'object') continue;
    
    // Get bet type from various possible fields
    const betType = oddData.betTypeID || oddData.betType || oddData.type || oddData.name || '';
    const betTypeLower = String(betType).toLowerCase();
    
    // Get description/name for player matching
    const description = (oddData.description || oddData.name || '').toLowerCase();
    
    // Check if this is a player prop:
    // 1. Bet type matches common player prop types
    // 2. Description/name contains player name
    // 3. Bet type contains player name
    const matchesPropType = playerPropTypes.some(type => 
      betTypeLower.includes(type) || description.includes(type)
    );
    
    const matchesPlayerName = playerNameLower && (
      betTypeLower.includes(playerNameLower) ||
      description.includes(playerNameLower) ||
      oddData.playerName?.toLowerCase().includes(playerNameLower)
    );
    
    if (matchesPropType || matchesPlayerName) {
      // Try to extract line value (could be in different formats)
      let line: number | undefined;
      if (oddData.line !== undefined && oddData.line !== null) {
        line = typeof oddData.line === 'number' ? oddData.line : parseFloat(String(oddData.line));
        if (isNaN(line)) line = undefined;
      }
      
      // Get price/odds
      const price = oddData.price || oddData.odds || oddData.decimal || undefined;
      
      // Get bookmaker name
      const bookmaker = oddData.bookmakerID || oddData.bookmaker || oddData.book || 'Unknown';
      
      props.push({
        betType: betType || 'Unknown',
        betTypeId: oddData.betTypeID || oddID,
        line: line,
        price: price ? String(price) : undefined,
        bookmaker: String(bookmaker),
        bookmakerId: oddData.bookmakerID || oddID,
      });
    }
  }
  
  // Sort props by bet type for better organization
  props.sort((a, b) => {
    const aType = a.betType.toLowerCase();
    const bType = b.betType.toLowerCase();
    
    // Prioritize common props
    const priority = ['points', 'rebounds', 'assists', 'steals', 'blocks'];
    const aPriority = priority.findIndex(p => aType.includes(p));
    const bPriority = priority.findIndex(p => bType.includes(p));
    
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    
    return aType.localeCompare(bType);
  });
  
  return props;
}

/**
 * Get player props for a specific player's game today
 */
export async function getPlayerPropsForToday(
  teamTricode: string,
  playerName: string
): Promise<GameWithProps | null> {
  try {
    const game = await findGameByTeam(teamTricode);
    
    if (!game) {
      return null;
    }
    
    const props = extractPlayerProps(game, playerName);
    
    return {
      eventId: game.eventID,
      homeTeam: game.teams?.home?.name || 'Unknown',
      awayTeam: game.teams?.away?.name || 'Unknown',
      startsAt: game.status?.startsAt,
      playerProps: props,
    };
  } catch (error) {
    console.error('❌ Error getting player props:', error);
    return null;
  }
}

