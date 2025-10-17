import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerStats {
  player: {
    id: number;
    nba_player_id: number;
    name: string;
    first_name?: string;
    last_name?: string;
    player_slug?: string;
    position?: string;
    team_id?: number;
    team_name?: string;
    team_abbreviation?: string;
    team_slug?: string;
    team_city?: string;
    is_defunct?: boolean;
    jersey_number?: string;
    height?: string;
    weight?: number;
    age?: number;
    birth_date?: string;
    birth_city?: string;
    birth_state?: string;
    birth_country?: string;
    college?: string;
    country?: string;
    draft_year?: number;
    draft_round?: number;
    draft_number?: number;
    salary?: number;
    is_active?: boolean;
    is_rookie?: boolean;
    years_pro?: number;
    from_year?: number;
    to_year?: number;
    roster_status?: string;
    current_pts?: number;
    current_reb?: number;
    current_ast?: number;
    stats_timeframe?: string;
  };
  careerStats?: {
    gp: number;
    gs: number;
    min_total: number;
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
    fantasy_pts: number;
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
  seasonBreakdown?: Array<{
    season_id: string;
    team_abbreviation: string;
    player_age: number;
    gp: number;
    gs: number;
    min_total: number;
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
    fantasy_pts: number;
  }>;
  recentGames: Array<{
    date: string;
    opponent: string;
    points: number;
    rebounds: number;
    assists: number;
    fantasyPoints: number;
  }>;
}

export function usePlayerStats(playerId: string) {
  return useQuery<PlayerStats, Error>({
    queryKey: ['player-stats', playerId],
    queryFn: async () => {
      console.log(`🏀 Fetching comprehensive stats for player ${playerId}...`);
      
      try {
        // Fetch player basic info
        const { data: playerData, error: playerError } = await supabase
          .from('nba_players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (playerError) {
          console.error('❌ Error fetching player data:', playerError);
          throw new Error(`Failed to fetch player data: ${playerError.message}`);
        }

        if (!playerData) {
          throw new Error('Player not found');
        }

        // Fetch career stats (regular season)
        const { data: careerData, error: careerError } = await supabase
          .from('player_career_totals_regular_season')
          .select('*')
          .eq('player_id', playerId)
          .single();

        // Fetch season breakdown (last 5 seasons)
        const { data: seasonBreakdownData, error: seasonError } = await supabase
          .from('player_season_totals_regular_season')
          .select('*')
          .eq('player_id', playerId)
          .order('season_id', { ascending: false })
          .limit(5);

        // Fetch recent game logs (last 10 games)
        const { data: gameLogsData, error: gameLogsError } = await supabase
          .from('nba_boxscores')
          .select('*')
          .eq('player_id', playerId)
          .order('game_date', { ascending: false })
          .limit(10);

        // Transform the data
        const playerStats: PlayerStats = {
          player: playerData,
          careerStats: careerData || undefined,
          seasonStats: {
            gamesPlayed: careerData?.gp || 0,
            points: careerData?.pts || 0,
            rebounds: careerData?.reb || 0,
            assists: careerData?.ast || 0,
            steals: careerData?.stl || 0,
            blocks: careerData?.blk || 0,
            turnovers: careerData?.tov || 0,
            fieldGoalPercentage: careerData?.fg_pct ? Number((careerData.fg_pct * 100).toFixed(1)) : 0,
            threePointPercentage: careerData?.fg3_pct ? Number((careerData.fg3_pct * 100).toFixed(1)) : 0,
            freeThrowPercentage: careerData?.ft_pct ? Number((careerData.ft_pct * 100).toFixed(1)) : 0,
            minutes: careerData?.min_total || 0,
            fantasyPoints: careerData?.fantasy_pts || 0,
          },
          seasonBreakdown: seasonBreakdownData || [],
          recentGames: (gameLogsData || []).map(game => ({
            date: game.game_date,
            opponent: game.matchup,
            points: game.pts || 0,
            rebounds: game.reb || 0,
            assists: game.ast || 0,
            fantasyPoints: game.fantasy_pts || 0,
          })),
        };

        console.log('✅ Successfully fetched comprehensive player stats for:', playerData.name);
        return playerStats;

      } catch (error) {
        console.error('❌ Error in usePlayerStats:', error);
        throw error;
      }
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}