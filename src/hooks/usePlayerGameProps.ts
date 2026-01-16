import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { GameWithProps, PlayerProp } from '../utils/sportsGameOdds';

export interface PlayerGamePropsData {
  hasGame: boolean;
  game?: GameWithProps;
  nbaGameId?: string;
  gameDate?: string;
  playerName: string;
  teamTricode: string | null;
}

/**
 * Hook to fetch player props by matching nba_games with player_props_games
 * Finds today's game, or most recent game if no game today
 */
export function usePlayerGameProps(playerId: string, playerName: string) {
  return useQuery({
    queryKey: ['player-game-props', playerId],
    queryFn: async (): Promise<PlayerGamePropsData | null> => {
      console.log(`🎲 usePlayerGameProps: Fetching for ${playerName} (${playerId})...`);
      
      // First, get the player's team and nba_player_id
      const { data: playerData, error: playerError } = await supabase
        .from('nba_players')
        .select('team_abbreviation, name, nba_player_id')
        .eq('id', playerId)
        .single();
      
      if (playerError || !playerData) {
        console.error('❌ Error fetching player data:', playerError);
        return null;
      }
      
      const teamAbbrev = playerData.team_abbreviation || null;
      const nbaPlayerId = playerData.nba_player_id;
      
      if (!teamAbbrev) {
        return {
          hasGame: false,
          playerName: playerData.name || playerName,
          teamTricode: null,
        };
      }
      
      // Step 1: Find the player's game in nba_games
      // First try today's game, then most recent game
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      
      // Try today's game first
      let { data: todayGame, error: todayGameError } = await supabase
        .from('nba_games')
        .select('game_id, home_team_tricode, away_team_tricode, game_date')
        .gte('game_date', todayStart.toISOString())
        .lt('game_date', todayEnd.toISOString())
        .or(`home_team_tricode.eq.${teamAbbrev},away_team_tricode.eq.${teamAbbrev}`)
        .order('game_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      let nbaGame = todayGame;
      let gameDate: string | null = null;
      
      // If no game today, find most recent game
      if (!nbaGame || todayGameError) {
        console.log('ℹ️ No game today, finding most recent game...');
        
        const { data: recentGame, error: recentGameError } = await supabase
          .from('nba_games')
          .select('game_id, home_team_tricode, away_team_tricode, game_date')
          .or(`home_team_tricode.eq.${teamAbbrev},away_team_tricode.eq.${teamAbbrev}`)
          .order('game_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentGame && !recentGameError) {
          nbaGame = recentGame;
        }
      }
      
      if (!nbaGame) {
        console.log('ℹ️ No game found for this player');
        return {
          hasGame: false,
          playerName: playerData.name || playerName,
          teamTricode: teamAbbrev,
        };
      }
      
      // Extract game date as YYYY-MM-DD
      const gameDateObj = nbaGame.game_date ? new Date(nbaGame.game_date) : null;
      if (gameDateObj) {
        gameDate = gameDateObj.toISOString().split('T')[0];
      }
      
      console.log(`✅ Found NBA game: ${nbaGame.game_id} on ${gameDate}`);
      
      // Step 2: Match this game to player_props_games by team tricodes and date
      if (!gameDate) {
        console.warn('⚠️ Could not extract game date');
        return {
          hasGame: true,
          nbaGameId: nbaGame.game_id,
          playerName: playerData.name || playerName,
          teamTricode: teamAbbrev,
        };
      }
      
      // Find matching player_props_games entry
      const { data: propsGame, error: propsGameError } = await supabase
        .from('player_props_games')
        .select('id, event_id, game_date, home_team_tricode, away_team_tricode')
        .eq('game_date', gameDate)
        .or(`home_team_tricode.eq.${nbaGame.home_team_tricode},away_team_tricode.eq.${nbaGame.home_team_tricode},home_team_tricode.eq.${nbaGame.away_team_tricode},away_team_tricode.eq.${nbaGame.away_team_tricode}`)
        .limit(1)
        .maybeSingle();
      
      if (propsGameError || !propsGame) {
        console.log('ℹ️ No matching player_props_games entry found');
        return {
          hasGame: true,
          nbaGameId: nbaGame.game_id,
          gameDate,
          playerName: playerData.name || playerName,
          teamTricode: teamAbbrev,
        };
      }
      
      console.log(`✅ Found matching props game: ${propsGame.event_id}`);
      
      // Step 3: Fetch player props for this game
      const orConditions: string[] = [];
      if (playerId) {
        orConditions.push(`player_id.eq.${playerId}`);
      }
      if (nbaPlayerId) {
        orConditions.push(`nba_player_id.eq.${nbaPlayerId}`);
      }
      if (playerName) {
        orConditions.push(`player_name.ilike.%${playerName}%`);
      }
      
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
        .eq('game_id', propsGame.id)
        .eq('game_date', gameDate);
      
      if (orConditions.length > 0) {
        propsQuery = propsQuery.or(orConditions.join(','));
      }
      
      const { data: propsData, error: propsError } = await propsQuery
        .order('bet_type', { ascending: true })
        .order('line', { ascending: true });
      
      if (propsError) {
        console.error('❌ Error fetching player props:', propsError);
        return {
          hasGame: true,
          nbaGameId: nbaGame.game_id,
          gameDate,
          playerName: playerData.name || playerName,
          teamTricode: teamAbbrev,
        };
      }
      
      if (!propsData || propsData.length === 0) {
        console.log('ℹ️ No props available for this game');
        return {
          hasGame: true,
          nbaGameId: nbaGame.game_id,
          gameDate,
          playerName: playerData.name || playerName,
          teamTricode: teamAbbrev,
        };
      }
      
      // Group props by game and format
      const gameEntry = {
        eventId: propsGame.event_id,
        homeTeam: propsData[0].player_props_games.home_team,
        awayTeam: propsData[0].player_props_games.away_team,
        homeTeamTricode: propsData[0].player_props_games.home_team_tricode || propsData[0].player_props_games.home_team,
        awayTeamTricode: propsData[0].player_props_games.away_team_tricode || propsData[0].player_props_games.away_team,
        startsAt: propsData[0].player_props_games.starts_at,
        playerProps: propsData.map((prop: any) => {
          // Extract period from raw_odd_data
          let period = 'game';
          const rawData = prop.raw_odd_data;
          if (rawData && typeof rawData === 'object') {
            period = rawData.periodID || rawData.period || 'game';
          }
          
          return {
            betType: prop.bet_type,
            betTypeId: prop.bet_type_id,
            line: prop.line,
            price: prop.price,
            bookmaker: prop.bookmaker,
            bookmakerId: prop.bookmaker_id,
            period: period,
          } as PlayerProp;
        }),
      };
      
      return {
        hasGame: true,
        game: gameEntry,
        nbaGameId: nbaGame.game_id,
        gameDate,
        playerName: playerData.name || playerName,
        teamTricode: teamAbbrev,
      };
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

