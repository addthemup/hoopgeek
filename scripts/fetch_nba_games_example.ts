/**
 * Example script to fetch NBA games from SportsGameOdds API for a specific date
 * Run with: npx tsx scripts/fetch_nba_games_example.ts
 */

import SportsGameOdds from 'sports-odds-api';

const API_KEY = '79ae5f47830d3d87e70896e36b5eefc3';

async function fetchNBAGamesForDate(targetDate: string) {
  const client = new SportsGameOdds({
    apiKeyHeader: API_KEY,
    timeout: 20 * 1000,
    maxRetries: 3,
  });

  try {
    console.log(`📊 Fetching NBA games for ${targetDate}...\n`);

    // Fetch NBA events - try multiple queries to find games
    console.log('Fetching games with odds (non-finalized)...');
    const pageWithOdds = await client.events.get({
      leagueID: 'NBA',
      oddsAvailable: true,
      finalized: false,
      limit: 50,
    });
    
    console.log('Fetching finalized games (may not have odds)...');
    let pageFinalized: any = { data: [] };
    try {
      pageFinalized = await client.events.get({
        leagueID: 'NBA',
        finalized: true,
        limit: 50,
      });
    } catch (e: any) {
      console.log('  (Finalized games query not available or returned error)');
    }
    
    // Also try without any filters
    console.log('Fetching all NBA games...');
    let pageAll: any = { data: [] };
    try {
      pageAll = await client.events.get({
        leagueID: 'NBA',
        limit: 100,
      });
    } catch (e: any) {
      console.log('  (All games query returned error)');
    }
    
    // Combine all results, removing duplicates by eventID
    const eventMap = new Map();
    [...(pageWithOdds.data || []), ...(pageFinalized.data || []), ...(pageAll.data || [])].forEach((event: any) => {
      const eventId = event.eventID || event.id;
      if (eventId && !eventMap.has(eventId)) {
        eventMap.set(eventId, event);
      }
    });
    
    const page = { data: Array.from(eventMap.values()) };

    console.log(`✅ Found ${page.data.length} total NBA events with odds\n`);

    // Filter for the target date
    const targetDateObj = new Date(targetDate);
    const targetDateStr = targetDate;

    const gamesForDate = page.data.filter((event: any) => {
      if (!event.status?.startsAt) return false;
      
      const eventDate = new Date(event.status.startsAt);
      const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
      
      return eventDateStr === targetDateStr;
    });

    console.log(`📅 Found ${gamesForDate.length} games on ${targetDate}:\n`);

    if (gamesForDate.length === 0) {
      console.log('⚠️ No games found for this date.\n');
      
      // Group games by date to show what's available
      const gamesByDate = new Map<string, any[]>();
      
      page.data.forEach((event: any) => {
        if (event.status?.startsAt) {
          const eventDate = new Date(event.status.startsAt);
          const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
          
          if (!gamesByDate.has(eventDateStr)) {
            gamesByDate.set(eventDateStr, []);
          }
          gamesByDate.get(eventDateStr)!.push(event);
        }
      });
      
      console.log(`📅 Available game dates (${gamesByDate.size} unique dates):\n`);
      
      // Sort dates and show first 10
      const sortedDates = Array.from(gamesByDate.keys()).sort();
      sortedDates.slice(0, 10).forEach((date) => {
        const games = gamesByDate.get(date)!;
        const awayTeam = games[0].teams?.away?.names?.long || 'Away';
        const homeTeam = games[0].teams?.home?.names?.long || 'Home';
        console.log(`  ${date}: ${games.length} game(s) (e.g., ${awayTeam} @ ${homeTeam})`);
      });
      
      if (sortedDates.length > 10) {
        console.log(`  ... and ${sortedDates.length - 10} more dates`);
      }
      
      // Check if any of these are finalized games with props still available
      console.log(`\n🔍 Checking if finalized games still have player props...\n`);
      const finalizedGames = page.data.filter((event: any) => {
        if (!event.status?.startsAt) return false;
        const eventDate = new Date(event.status.startsAt);
        const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
        // Check if game is in the past (likely finalized)
        return eventDate < new Date() && event.odds && Object.keys(event.odds).length > 0;
      });
      
      if (finalizedGames.length > 0) {
        console.log(`Found ${finalizedGames.length} past games with odds data. Checking first one for player props...\n`);
        const sampleGame = finalizedGames[0];
        const gameDate = new Date(sampleGame.status.startsAt);
        const awayTeam = sampleGame.teams?.away?.names?.long || 'Away';
        const homeTeam = sampleGame.teams?.home?.names?.long || 'Home';
        
        console.log(`Sample Finalized Game: ${awayTeam} @ ${homeTeam}`);
        console.log(`Date: ${gameDate.toISOString().split('T')[0]}`);
        console.log(`Odds Available: ${Object.keys(sampleGame.odds || {}).length} betting lines`);
        
        // Count player props
        let playerPropsCount = 0;
        const sampleProps: any[] = [];
        const playerNames = new Set<string>();
        
        if (sampleGame.odds) {
          for (const [oddID, odd] of Object.entries(sampleGame.odds)) {
            const oddData = odd as any;
            const betType = (oddData.betTypeID || oddData.betType || '').toLowerCase();
            const description = (oddData.description || oddData.name || '').toLowerCase();
            const hasPlayerName = /[A-Z][a-z]+ [A-Z][a-z]+/.test(oddData.description || oddData.name || '');
            const isPlayerProp = ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'threes'].some(type => 
              betType.includes(type) || description.includes(type)
            );
            
            if ((isPlayerProp || hasPlayerName) && oddData.line !== undefined) {
              playerPropsCount++;
              const fullDescription = oddData.description || oddData.name || '';
              const nameMatch = fullDescription.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
              if (nameMatch) playerNames.add(nameMatch[1]);
              
              if (sampleProps.length < 5) {
                sampleProps.push({
                  description: fullDescription.substring(0, 70),
                  line: oddData.line,
                  price: oddData.price,
                });
              }
            }
          }
        }
        
        console.log(`\n✅ Player Props Still Available: ${playerPropsCount}`);
        console.log(`Unique Players: ${playerNames.size}`);
        if (sampleProps.length > 0) {
          console.log(`\nSample Props:`);
          sampleProps.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.description} - Line: ${p.line}`);
          });
        }
        
        // Show sample of all odds to understand structure
        console.log(`\n📋 Sample of all odds (first 10):`);
        const oddsEntries = Object.entries(sampleGame.odds || {}).slice(0, 10);
        oddsEntries.forEach(([oddID, odd]: [string, any], i) => {
          console.log(`  ${i + 1}. ID: ${oddID.substring(0, 20)}...`);
          console.log(`     Description: ${(odd.description || odd.name || 'N/A').substring(0, 60)}`);
          console.log(`     Bet Type: ${odd.betTypeID || odd.betType || 'N/A'}`);
          console.log(`     Line: ${odd.line !== undefined ? odd.line : 'N/A'}`);
          console.log(``);
        });
      }
      
      return;
    }

    // Display each game
    gamesForDate.forEach((event: any, index: number) => {
      console.log(`\n${'='.repeat(60)}`);
      
      // Get team names from the names object
      const awayTeam = event.teams?.away?.names?.long || 
                      event.teams?.away?.names?.medium ||
                      event.teams?.away?.names?.short ||
                      event.teams?.away?.name ||
                      'Away';
      const homeTeam = event.teams?.home?.names?.long || 
                      event.teams?.home?.names?.medium ||
                      event.teams?.home?.names?.short ||
                      event.teams?.home?.name ||
                      'Home';
      
      const awayTricode = event.teams?.away?.names?.short || 'Away';
      const homeTricode = event.teams?.home?.names?.short || 'Home';
      
      console.log(`Game ${index + 1}: ${awayTeam} (${awayTricode}) @ ${homeTeam} (${homeTricode})`);
      console.log(`Event ID: ${event.eventID || event.id}`);
      
      if (event.status?.startsAt) {
        const startDate = new Date(event.status.startsAt);
        console.log(`Starts At: ${startDate.toLocaleString()}`);
      } else {
        console.log(`Starts At: Unknown`);
      }
      
      
      // Check game status
      const gameStatus = event.status?.status || event.status?.state || 'Unknown';
      const isFinalized = event.finalized || gameStatus === 'final' || gameStatus === 'completed';
      console.log(`Game Status: ${gameStatus}${isFinalized ? ' (FINALIZED)' : ''}`);
      
      // Count player props if odds are available
      if (event.odds && typeof event.odds === 'object') {
        const oddsCount = Object.keys(event.odds).length;
        console.log(`\nOdds Available: ${oddsCount} betting lines`);
        
        // Count player props (look for common prop types and player names)
        const playerPropTypes = ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'threes', 'three', '3pt', '3pm'];
        let playerPropsCount = 0;
        const sampleProps: any[] = [];
        const playerNames = new Set<string>();
        
        for (const [oddID, odd] of Object.entries(event.odds)) {
          const oddData = odd as any;
          const betType = (oddData.betTypeID || oddData.betType || oddData.type || '').toLowerCase();
          const description = (oddData.description || oddData.name || '').toLowerCase();
          
          // Check if this is a player prop
          const isPlayerProp = playerPropTypes.some(type => 
            betType.includes(type) || description.includes(type)
          );
          
          // Also check if description contains a player name (common pattern)
          const hasPlayerName = /[A-Z][a-z]+ [A-Z][a-z]+/.test(oddData.description || oddData.name || '');
          
          if ((isPlayerProp || hasPlayerName) && oddData.line !== undefined) {
            playerPropsCount++;
            
            // Extract player name if possible
            const fullDescription = oddData.description || oddData.name || '';
            const nameMatch = fullDescription.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
            if (nameMatch) {
              playerNames.add(nameMatch[1]);
            }
            
            if (sampleProps.length < 5) {
              sampleProps.push({
                oddID: oddID.substring(0, 20) + '...',
                betType: oddData.betTypeID || oddData.betType || 'Unknown',
                line: oddData.line,
                price: oddData.price,
                description: fullDescription.substring(0, 60),
                bookmaker: oddData.bookmakerID || oddData.bookmaker || 'Unknown',
              });
            }
          }
        }
        
        console.log(`Player Props: ~${playerPropsCount} estimated`);
        console.log(`Unique Players with Props: ${playerNames.size}`);
        
        if (sampleProps.length > 0) {
          console.log(`\nSample Player Props:`);
          sampleProps.forEach((prop, i) => {
            console.log(`  ${i + 1}. ${prop.description}`);
            console.log(`     Bet Type: ${prop.betType}, Line: ${prop.line}, Price: ${prop.price || 'N/A'}`);
          });
        }
        
        // Show a few unique player names
        if (playerNames.size > 0) {
          const playerArray = Array.from(playerNames).slice(0, 10);
          console.log(`\nPlayers with props (sample): ${playerArray.join(', ')}${playerNames.size > 10 ? '...' : ''}`);
        }
      } else {
        console.log(`\nNo odds data available`);
      }
      
      console.log(`${'='.repeat(60)}`);
    });

    console.log(`\n✅ Summary: ${gamesForDate.length} game(s) found for ${targetDate}\n`);

    return gamesForDate;
  } catch (error: any) {
    console.error('❌ Error fetching NBA games:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

// Run for 2025-11-09 (today)
const targetDate = '2025-11-09';

fetchNBAGamesForDate(targetDate)
  .then((games) => {
    if (games && games.length > 0) {
      console.log('\n🎉 Successfully fetched games!');
    }
  })
  .catch((error) => {
    console.error('\n❌ Failed to fetch games:', error);
    process.exit(1);
  });

