/**
 * Example functions demonstrating how to use the SportsGameOdds API
 * These examples show the structure of API responses and how to work with them
 */

import SportsGameOdds from 'sports-odds-api';

// Initialize client
const getClient = () => {
  const apiKey = import.meta.env.VITE_SPORTS_ODDS_API_KEY || '79ae5f47830d3d87e70896e36b5eefc3';
  
  return new SportsGameOdds({
    apiKeyHeader: apiKey,
    timeout: 20 * 1000,
    maxRetries: 3,
  });
};

/**
 * Example 1: Fetch NBA events for today
 * 
 * This shows the basic structure of fetching events from the API
 */
export async function exampleFetchNBAGames() {
  const client = getClient();
  
  try {
    // Fetch NBA events with odds available
    const page = await client.events.get({
      leagueID: 'NBA',
      oddsAvailable: true,
      finalized: false,
      limit: 50,
    });
    
    console.log(`Found ${page.data.length} NBA games`);
    
    // Each event has this structure:
    // {
    //   eventID: string,
    //   teams: {
    //     home: { name: string, ... },
    //     away: { name: string, ... }
    //   },
    //   status: {
    //     startsAt: string (ISO date),
    //     ...
    //   },
    //   odds: { ... } // Object keyed by oddID
    // }
    
    return page.data;
  } catch (error) {
    console.error('Error fetching NBA games:', error);
    throw error;
  }
}

/**
 * Example 2: Fetch a specific event with full odds data
 * 
 * This shows how to get detailed odds information for a game
 */
export async function exampleFetchEventOdds(eventId: string) {
  const client = getClient();
  
  try {
    // Fetch a specific event
    const event = await client.events.get({
      eventID: eventId,
    });
    
    // The odds object contains all betting lines
    // Structure: { [oddID]: { betTypeID, line, price, bookmakerID, ... } }
    
    console.log('Event odds structure:', event.odds);
    
    return event;
  } catch (error) {
    console.error('Error fetching event odds:', error);
    throw error;
  }
}

/**
 * Example 3: Find player props for a specific player
 * 
 * This demonstrates how to search through odds to find player props
 */
export async function exampleFindPlayerProps(eventId: string, playerName: string) {
  const client = getClient();
  
  try {
    const event = await client.events.get({
      eventID: eventId,
    });
    
    const playerProps: any[] = [];
    
    // Iterate through odds object
    if (event.odds && typeof event.odds === 'object') {
      for (const [oddID, odd] of Object.entries(event.odds)) {
        const oddData = odd as any;
        
        // Check if this is a player prop
        // Player props typically have:
        // - betTypeID that includes stat types (points, rebounds, etc.)
        // - description/name that includes player name
        // - line (the over/under number)
        
        const description = (oddData.description || oddData.name || '').toLowerCase();
        const betType = (oddData.betTypeID || oddData.betType || '').toLowerCase();
        
        // Check if it matches the player name
        if (description.includes(playerName.toLowerCase()) || 
            betType.includes(playerName.toLowerCase())) {
          
          // Check if it's a stat prop (points, rebounds, assists, etc.)
          const statTypes = ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'threes'];
          const isStatProp = statTypes.some(stat => 
            betType.includes(stat) || description.includes(stat)
          );
          
          if (isStatProp) {
            playerProps.push({
              oddID,
              betType: oddData.betTypeID || oddData.betType,
              line: oddData.line,
              price: oddData.price,
              bookmaker: oddData.bookmakerID || oddData.bookmaker,
              description: oddData.description || oddData.name,
            });
          }
        }
      }
    }
    
    console.log(`Found ${playerProps.length} props for ${playerName}`);
    return playerProps;
  } catch (error) {
    console.error('Error finding player props:', error);
    throw error;
  }
}

/**
 * Example 4: Get all player props for a game
 * 
 * This shows how to extract all player props from an event
 */
export async function exampleGetAllPlayerProps(eventId: string) {
  const client = getClient();
  
  try {
    const event = await client.events.get({
      eventID: eventId,
    });
    
    const allPlayerProps: any[] = [];
    
    // Common player prop bet types
    const playerPropTypes = [
      'points', 'point', 'pts',
      'rebounds', 'rebound', 'reb',
      'assists', 'assist', 'ast',
      'steals', 'steal', 'stl',
      'blocks', 'block', 'blk',
      'turnovers', 'turnover', 'tov',
      'threes', 'three', '3pt', '3-pointer', '3pm',
    ];
    
    if (event.odds && typeof event.odds === 'object') {
      for (const [oddID, odd] of Object.entries(event.odds)) {
        const oddData = odd as any;
        
        const betType = (oddData.betTypeID || oddData.betType || '').toLowerCase();
        const description = (oddData.description || oddData.name || '').toLowerCase();
        
        // Check if this is a player prop
        const isPlayerProp = playerPropTypes.some(type => 
          betType.includes(type) || description.includes(type)
        );
        
        if (isPlayerProp && oddData.line !== undefined) {
          allPlayerProps.push({
            oddID,
            betType: oddData.betTypeID || oddData.betType,
            line: oddData.line,
            price: oddData.price,
            bookmaker: oddData.bookmakerID || oddData.bookmaker,
            description: oddData.description || oddData.name,
          });
        }
      }
    }
    
    console.log(`Found ${allPlayerProps.length} total player props for event ${eventId}`);
    return allPlayerProps;
  } catch (error) {
    console.error('Error getting player props:', error);
    throw error;
  }
}

/**
 * Example 5: Match NBA game to SportsGameOdds event
 * 
 * This shows how to match your database games to API events
 */
export async function exampleMatchGameToEvent(
  homeTeamTricode: string,
  awayTeamTricode: string,
  gameDate: string
) {
  const client = getClient();
  
  try {
    // Fetch events for the date
    const page = await client.events.get({
      leagueID: 'NBA',
      oddsAvailable: true,
      finalized: false,
      limit: 50,
    });
    
    // Team name mapping
    const teamNameMap: Record<string, string[]> = {
      'ATL': ['Atlanta Hawks', 'Hawks'],
      'BOS': ['Boston Celtics', 'Celtics'],
      // ... (use the same mapping from sportsGameOdds.ts)
    };
    
    const homeTeamNames = teamNameMap[homeTeamTricode] || [];
    const awayTeamNames = teamNameMap[awayTeamTricode] || [];
    
    // Find matching event
    for (const event of page.data) {
      const homeTeam = event.teams?.home?.name || '';
      const awayTeam = event.teams?.away?.name || '';
      
      const homeMatches = homeTeamNames.some(name => 
        homeTeam.toLowerCase().includes(name.toLowerCase())
      );
      const awayMatches = awayTeamNames.some(name => 
        awayTeam.toLowerCase().includes(name.toLowerCase())
      );
      
      if (homeMatches && awayMatches) {
        // Check date matches
        if (event.status?.startsAt) {
          const eventDate = new Date(event.status.startsAt);
          const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
          
          if (eventDateStr === gameDate) {
            console.log(`✅ Matched game: ${awayTeam} @ ${homeTeam}`);
            return event;
          }
        }
      }
    }
    
    console.log(`⚠️ No matching event found`);
    return null;
  } catch (error) {
    console.error('Error matching game to event:', error);
    throw error;
  }
}

