import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerComprehensiveData {
  // Basic player info
  player: {
    id: string;
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
    // Salary data from nba_hoopshype_salaries
    nba_hoopshype_salaries?: Array<{
      salary_2025_26?: number;
      salary_2026_27?: number;
      salary_2027_28?: number;
      salary_2028_29?: number;
      contract_years_remaining?: number;
    }>;
    // Projections data from nba_espn_projections
    nba_espn_projections?: Array<{
      proj_2026_gp?: number;
      proj_2026_min?: number;
      proj_2026_pts?: number;
      proj_2026_reb?: number;
      proj_2026_ast?: number;
      proj_2026_stl?: number;
      proj_2026_blk?: number;
      proj_2026_to?: number;
      proj_2026_3pm?: number;
      proj_2026_fg_pct?: number;
      proj_2026_ft_pct?: number;
      outlook_2026?: string;
    }>;
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
    id: string;
    player_id: string;
    nba_player_id: number;
    player_name: string;
    game_id: string;
    game_date: string;
    season_year: string;
    matchup: string;
    jersey_num: number;
    position: string;
    team_id: number;
    team_abbreviation: string;
    team_name: string;
    team_city: string;
    team_tricode: string;
    min: string | number;
    fgm: number;
    fga: number;
    fg_pct: string | number;
    fg3m: number;
    fg3a: number;
    fg3_pct: string | number;
    ftm: number;
    fta: number;
    ft_pct: string | number;
    oreb: number;
    dreb: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    tov: number;
    fouls_personal: number;
    pts: number;
    plus_minus_points: number;
    true_shooting_pct: string | number;
    effective_fg_pct: string | number;
    usage_rate: string | number;
    player_efficiency_rating: string | number;
    game_score: string | number;
    is_starter: boolean;
    is_home_game: boolean;
    game_type: string;
    created_at: string;
    updated_at: string;
  }>;
  
  // Game logs pagination info
  gameLogsPagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  
  // ESPN Projections data
  espnProjections?: {
    proj_2026_gp?: number;
    proj_2026_min?: number;
    proj_2026_pts?: number;
    proj_2026_reb?: number;
    proj_2026_ast?: number;
    proj_2026_stl?: number;
    proj_2026_blk?: number;
    proj_2026_to?: number;
    proj_2026_3pm?: number;
    proj_2026_fg_pct?: number;
    proj_2026_ft_pct?: number;
    outlook_2026?: string;
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
        // Fetch player basic info with related data
        const { data: playerData, error: playerError } = await supabase
          .from('nba_players')
          .select(`
            *,
            nba_hoopshype_salaries (
              salary_2025_26,
              salary_2026_27,
              salary_2027_28,
              salary_2028_29,
              contract_years_remaining
            ),
            nba_espn_projections (
              proj_2026_gp,
              proj_2026_min,
              proj_2026_pts,
              proj_2026_reb,
              proj_2026_ast,
              proj_2026_stl,
              proj_2026_blk,
              proj_2026_to,
              proj_2026_3pm,
              proj_2026_fg_pct,
              proj_2026_ft_pct,
              outlook_2026
            )
          `)
          .eq('id', playerId)
          .single();

        if (playerError) {
          console.error('❌ Error fetching player data:', playerError);
          throw new Error(`Failed to fetch player data: ${playerError.message}`);
        }

        if (!playerData) {
          throw new Error('Player not found');
        }

        // Note: Career stats and season breakdown tables are not available in the new schema
        // These would need to be calculated from nba_boxscores if needed
        const careerData = null;
        const careerPostData = null;
        const careerAllStarData = null;
        const seasonBreakdownData = null;
        const seasonRankingsData = null;

        // Fetch game logs with pagination
        const { data: gameLogsData, error: gameLogsError, count: gameLogsCount } = await supabase
          .from('nba_boxscores')
          .select('*', { count: 'exact' })
          .eq('player_id', playerId)
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
          espnProjections: playerData.nba_espn_projections?.[0] || undefined,
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
        .from('nba_boxscores')
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
