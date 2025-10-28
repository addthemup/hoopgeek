import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { FANDUEL_SCORING } from '../utils/fantasyScoring';

export interface LivePlayerStat {
  nba_player_id: number;
  player_name: string;
  team_tricode: string;
  stats: {
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
    tov?: number;
    fgm?: number;
    fga?: number;
    fg_pct?: number;
    fg3m?: number;
    fg3a?: number;
    fg3_pct?: number;
    ftm?: number;
    fta?: number;
    ft_pct?: number;
    oreb?: number;
    dreb?: number;
    pf?: number;
    min?: number;
    plus_minus?: number;
  };
  updated_at: string;
  fantasy_points?: number; // Calculated FanDuel points
}

export interface LivePlayerStatsResponse {
  awayTeam: LivePlayerStat[];
  homeTeam: LivePlayerStat[];
}

export function useLivePlayerStats(gameId: string | null) {
  return useQuery({
    queryKey: ['live-player-stats', gameId],
    queryFn: async (): Promise<LivePlayerStatsResponse> => {
      if (!gameId) {
        return { awayTeam: [], homeTeam: [] };
      }

      // Fetch live player stats for the game
      const { data, error } = await supabase
        .from('live_player_stats')
        .select('nba_player_id, player_name, team_tricode, stats, updated_at')
        .eq('game_id', gameId)
        .order('team_tricode')
        .order('stats->pts', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching live player stats:', error);
        return { awayTeam: [], homeTeam: [] };
      }

      if (!data || data.length === 0) {
        return { awayTeam: [], homeTeam: [] };
      }

      // Calculate fantasy points for each player
      const playersWithFantasyPoints = data.map((player) => {
        const stats = player.stats || {};
        
        // Calculate FanDuel fantasy points
        const fantasyPoints = FANDUEL_SCORING.calculatePoints({
          pts: stats.pts || 0,
          reb: stats.reb || 0,
          ast: stats.ast || 0,
          stl: stats.stl || 0,
          blk: stats.blk || 0,
          tov: stats.tov || 0,
          fgm: stats.fgm || 0,
          fga: stats.fga || 0,
          fg_pct: stats.fg_pct || 0,
          fg3m: stats.fg3m || 0,
          fg3a: stats.fg3a || 0,
          fg3_pct: stats.fg3_pct || 0,
          ftm: stats.ftm || 0,
          fta: stats.fta || 0,
          ft_pct: stats.ft_pct || 0,
          oreb: stats.oreb || 0,
          dreb: stats.dreb || 0,
          pf: stats.pf || 0,
          min: stats.min || 0,
          plus_minus: stats.plus_minus || 0,
        } as any);

        return {
          ...player,
          fantasy_points: fantasyPoints,
        };
      });

      // Separate by team (first team is away, second is home based on sort)
      const teams = [...new Set(playersWithFantasyPoints.map(p => p.team_tricode))];
      const awayTeam = playersWithFantasyPoints.filter(p => p.team_tricode === teams[0]);
      const homeTeam = playersWithFantasyPoints.filter(p => p.team_tricode === teams[1] || teams[0]);

      // Sort by fantasy points descending
      awayTeam.sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0));
      homeTeam.sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0));

      return { awayTeam, homeTeam };
    },
    enabled: !!gameId,
    refetchInterval: 30000, // Refetch every 30 seconds for live games
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}

