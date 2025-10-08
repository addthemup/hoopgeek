import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerComprehensiveData {
  // Basic player info
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
    // Contract data fields
    salary_2025_26?: number;
    salary_2026_27?: number;
    salary_2027_28?: number;
    salary_2028_29?: number;
    contract_years_remaining?: number;
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
  
  // Career stats (regular season)
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
  
  // Career stats (post season)
  careerStatsPostSeason?: {
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
  
  // Career stats (all star)
  careerStatsAllStar?: {
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
  
  // Season breakdown (year by year)
  seasonBreakdown: Array<{
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
  
  // Season rankings
  seasonRankings: Array<{
    season_id: string;
    team_abbreviation: string;
    player_age: number;
    gp: number;
    gs: number;
    rank_min: number;
    rank_fgm: number;
    rank_fga: number;
    rank_fg_pct: number;
    rank_fg3m: number;
    rank_fg3a: number;
    rank_fg3_pct: number;
    rank_ftm: number;
    rank_fta: number;
    rank_ft_pct: number;
    rank_oreb: number;
    rank_dreb: number;
    rank_reb: number;
    rank_ast: number;
    rank_stl: number;
    rank_blk: number;
    rank_tov: number;
    rank_pts: number;
    rank_eff: number;
  }>;
  
  // Recent game logs (2024-25)
  recentGameLogs: Array<{
    id: number;
    game_id: string;
    season_year: string;
    player_name: string;
    team_id: number;
    team_abbreviation: string;
    team_name: string;
    game_date: string;
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
    tov: number;
    stl: number;
    blk: number;
    blka: number;
    pf: number;
    pfd: number;
    pts: number;
    plus_minus: number;
    nba_fantasy_pts: number;
    dd2: number;
    td3: number;
    // Rankings
    gp_rank: number;
    w_rank: number;
    l_rank: number;
    w_pct_rank: number;
    min_rank: number;
    fgm_rank: number;
    fga_rank: number;
    fg_pct_rank: number;
    fg3m_rank: number;
    fg3a_rank: number;
    fg3_pct_rank: number;
    ftm_rank: number;
    fta_rank: number;
    ft_pct_rank: number;
    oreb_rank: number;
    dreb_rank: number;
    reb_rank: number;
    ast_rank: number;
    tov_rank: number;
    stl_rank: number;
    blk_rank: number;
    blka_rank: number;
    pf_rank: number;
    pfd_rank: number;
    pts_rank: number;
    plus_minus_rank: number;
    nba_fantasy_pts_rank: number;
    dd2_rank: number;
    td3_rank: number;
  }>;
  
  // Game logs pagination info
  gameLogsPagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export function usePlayerComprehensive(
  playerId: string, 
  gameLogsPage: number = 1, 
  gameLogsPageSize: number = 20
) {
  return useQuery<PlayerComprehensiveData, Error>({
    queryKey: ['player-comprehensive', playerId, gameLogsPage, gameLogsPageSize],
    queryFn: async () => {
      console.log(`🏀 Fetching comprehensive data for player ${playerId}...`);
      
      try {
        // Fetch player basic info
        const { data: playerData, error: playerError } = await supabase
          .from('players')
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
        const numericPlayerId = Number(playerId);

        const { data: careerData, error: careerError } = await supabase
          .from('player_career_totals_regular_season')
          .select('*')
          .eq('player_id', numericPlayerId)
          .maybeSingle();

        // Fetch career stats (post season)
        const { data: careerPostData, error: careerPostError } = await supabase
          .from('player_career_totals_post_season')
          .select('*')
          .eq('player_id', numericPlayerId)
          .maybeSingle();

        // Fetch career stats (all star)
        const { data: careerAllStarData, error: careerAllStarError } = await supabase
          .from('player_career_totals_all_star_season')
          .select('*')
          .eq('player_id', numericPlayerId)
          .maybeSingle();

        // Fetch season breakdown (last 10 seasons)
        const { data: seasonBreakdownData, error: seasonError } = await supabase
          .from('player_season_totals_regular_season')
          .select('*')
          .eq('player_id', numericPlayerId)
          .order('season_id', { ascending: false })
          .limit(10);

        // Fetch season rankings (last 5 seasons)
        const { data: seasonRankingsData, error: rankingsError } = await supabase
          .from('player_season_rankings_regular_season')
          .select('*')
          .eq('player_id', numericPlayerId)
          .order('season_id', { ascending: false })
          .limit(5);

        // Fetch game logs with pagination
        const { data: gameLogsData, error: gameLogsError, count: gameLogsCount } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact' })
          .eq('player_id', numericPlayerId)
          .eq('season_year', '2024-25')
          .order('game_date', { ascending: false })
          .range((gameLogsPage - 1) * gameLogsPageSize, gameLogsPage * gameLogsPageSize - 1);

        // Calculate pagination info
        const totalGameLogs = gameLogsCount || 0;
        const totalPages = Math.ceil(totalGameLogs / gameLogsPageSize);

        const playerComprehensiveData: PlayerComprehensiveData = {
          player: playerData,
          careerStats: careerData || undefined,
          careerStatsPostSeason: careerPostData || undefined,
          careerStatsAllStar: careerAllStarData || undefined,
          seasonBreakdown: seasonBreakdownData || [],
          seasonRankings: seasonRankingsData || [],
          recentGameLogs: gameLogsData || [],
          gameLogsPagination: {
            total: totalGameLogs,
            page: gameLogsPage,
            pageSize: gameLogsPageSize,
            totalPages: totalPages,
          },
        };

        console.log('✅ Successfully fetched comprehensive player data for:', playerData.name);
        console.log(`📊 Career stats: ${careerData ? 'Yes' : 'No'}`);
        console.log(`📊 Season breakdown: ${seasonBreakdownData?.length || 0} seasons`);
        console.log(`📊 Game logs: ${gameLogsData?.length || 0} games (page ${gameLogsPage}/${totalPages})`);
        
        return playerComprehensiveData;

      } catch (error) {
        console.error('❌ Error in usePlayerComprehensive:', error);
        throw error;
      }
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook for fetching game logs with pagination
export function usePlayerGameLogs(
  playerId: string,
  season: string = '2024-25',
  page: number = 1,
  pageSize: number = 20
) {
  return useQuery({
    queryKey: ['player-game-logs', playerId, season, page, pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact' })
        .eq('player_id', playerId)
        .eq('season_year', season)
        .order('game_date', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
