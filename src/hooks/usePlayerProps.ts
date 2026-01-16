import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { GameWithProps, PlayerProp } from '../utils/sportsGameOdds';

export interface PlayerPropsData {
  hasGameToday: boolean;
  game?: GameWithProps;
  playerName: string;
  teamTricode: string | null;
}

/**
 * Hook to fetch player props for today's game or next upcoming game
 * Simple approach: Find game from nba_games, then fetch props for that game
 */
export function usePlayerProps(playerId: string, playerName: string) {
  console.log(`🎲 usePlayerProps called with playerId: ${playerId}, playerName: ${playerName}`);
  
  return useQuery({
    queryKey: ['player-props', playerId],
    queryFn: async (): Promise<PlayerPropsData | null> => {
      console.log(`🎲 Fetching player props for ${playerName} (${playerId})...`);
      
      // Step 1: Get player's team
      const { data: playerData, error } = await supabase
        .from('nba_players')
        .select('team_abbreviation, name, nba_player_id')
        .eq('id', playerId)
        .single();
      
      if (error || !playerData) {
        console.error('❌ Error fetching player team:', error);
        return null;
      }
      
      if (!playerData.team_abbreviation) {
        console.log('⚠️ Player has no team assigned');
        return {
          hasGameToday: false,
          playerName: playerData.name || playerName,
          teamTricode: null,
        };
      }
      
      const teamAbbrev = playerData.team_abbreviation;
      
      // Step 2: Find TODAY's game from nba_games
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      console.log(`📅 Looking for game TODAY (${todayDateStr}) or NEXT upcoming game for ${teamAbbrev}`);
      
      // Try to find today's game
      const { data: todayGame, error: todayGameError } = await supabase
        .from('nba_games')
        .select('game_id, game_date, home_team_tricode, away_team_tricode')
        .or(`home_team_tricode.eq.${teamAbbrev},away_team_tricode.eq.${teamAbbrev}`)
        .gte('game_date', todayStart.toISOString())
        .lt('game_date', todayEnd.toISOString())
        .order('game_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      let targetGame: any = null;
      let isActuallyToday = false;
      let gameDateStr: string | null = null;
      
      if (todayGame && !todayGameError) {
        // Found today's game
        targetGame = todayGame;
        const gameDateObj = new Date(todayGame.game_date);
        gameDateStr = `${gameDateObj.getFullYear()}-${String(gameDateObj.getMonth() + 1).padStart(2, '0')}-${String(gameDateObj.getDate()).padStart(2, '0')}`;
        isActuallyToday = true;
        console.log(`✅ Found TODAY's game: ${todayGame.game_id} on ${gameDateStr}`);
      } else {
        // No game today - find next upcoming game
        console.log('ℹ️ No game today, finding next upcoming game...');
        const { data: upcomingGame, error: upcomingError } = await supabase
          .from('nba_games')
          .select('game_id, game_date, home_team_tricode, away_team_tricode')
          .or(`home_team_tricode.eq.${teamAbbrev},away_team_tricode.eq.${teamAbbrev}`)
          .gte('game_date', todayStart.toISOString())
          .order('game_date', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (upcomingGame && !upcomingError) {
          targetGame = upcomingGame;
          const gameDateObj = new Date(upcomingGame.game_date);
          gameDateStr = `${gameDateObj.getFullYear()}-${String(gameDateObj.getMonth() + 1).padStart(2, '0')}-${String(gameDateObj.getDate()).padStart(2, '0')}`;
          isActuallyToday = false;
          console.log(`✅ Found NEXT game: ${upcomingGame.game_id} on ${gameDateStr}`);
        } else {
          console.log('ℹ️ No games found for this team');
          return {
            hasGameToday: false,
            playerName: playerData.name || playerName,
            teamTricode: teamAbbrev,
          };
        }
      }
      
      if (!targetGame || !gameDateStr) {
        console.log('ℹ️ No game found');
        return {
          hasGameToday: false,
          playerName: playerData.name || playerName,
          teamTricode: teamAbbrev,
        };
      }
      
      // Step 3: Fetch props for this game date
      console.log(`📊 Fetching props for game on ${gameDateStr}...`);
      
      const playerNameMatch = playerData.name || playerName || '';
      const orConditions: string[] = [];
      
      if (playerId) {
        orConditions.push(`player_id.eq.${playerId}`);
      }
      if (playerData.nba_player_id) {
        orConditions.push(`nba_player_id.eq.${playerData.nba_player_id}`);
      }
      if (playerNameMatch) {
        orConditions.push(`player_name.ilike.%${playerNameMatch}%`);
      }
      
      // Fetch props for this specific game date
      let propsQuery = supabase
        .from('player_props')
        .select(`
          *,
          player_props_games!inner (
            id,
            event_id,
            game_date,
            home_team,
            away_team,
            home_team_tricode,
            away_team_tricode,
            starts_at
          )
        `)
        .eq('game_date', gameDateStr); // Only props for this specific date
      
      if (orConditions.length > 0) {
        propsQuery = propsQuery.or(orConditions.join(','));
      }
      
      const { data: propsData, error: propsError } = await propsQuery
        .order('bet_type', { ascending: true })
        .order('line', { ascending: true });
      
      if (propsError) {
        console.error('❌ Error fetching player props:', propsError);
      }
      
      // Step 4: Build game object with props (or empty if no props yet)
      const homeTeamTricode = targetGame.home_team_tricode;
      const awayTeamTricode = targetGame.away_team_tricode;
      
      // Group props by game if we have any
      let playerProps: PlayerProp[] = [];
      let eventId = '';
      let startsAt: string | null = targetGame.game_date;
      
      if (propsData && propsData.length > 0) {
        // Extract props
        propsData.forEach((prop: any) => {
          const game = prop.player_props_games;
          if (game) {
            if (!eventId) eventId = game.event_id || '';
            if (!startsAt && game.starts_at) startsAt = game.starts_at;
            
            // Extract period from raw_odd_data
            let period = 'game';
            const rawData = prop.raw_odd_data;
            if (rawData && typeof rawData === 'object') {
              period = rawData.periodID || rawData.period || 'game';
            }
            
            playerProps.push({
              betType: prop.bet_type,
              betTypeId: prop.bet_type_id,
              line: prop.line,
              price: prop.price,
              bookmaker: prop.bookmaker,
              bookmakerId: prop.bookmaker_id,
              period: period,
            });
          }
        });
        
        console.log(`✅ Found ${playerProps.length} props for game on ${gameDateStr}`);
      } else {
        console.log(`ℹ️ No props found for game on ${gameDateStr} (game exists but props not imported yet)`);
      }
      
      return {
        hasGameToday: isActuallyToday,
        game: {
          eventId: eventId,
          homeTeam: homeTeamTricode || '',
          awayTeam: awayTeamTricode || '',
          homeTeamTricode: homeTeamTricode || '',
          awayTeamTricode: awayTeamTricode || '',
          startsAt: startsAt,
          playerProps: playerProps,
        },
        playerName: playerData.name || playerName,
        teamTricode: teamAbbrev,
      };
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}
