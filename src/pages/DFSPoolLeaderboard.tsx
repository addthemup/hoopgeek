import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  Chip,
  Avatar,
  Stack,
  Button,
  LinearProgress,
  Sheet,
  IconButton,
} from '@mui/joy';
import { ArrowBack, EmojiEvents, TrendingUp, Refresh } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { calculateFantasyPoints, FANDUEL_SCORING } from '../utils/fantasyScoring';

interface PoolEntry {
  entry_id: string;
  user_id: string;
  user_name: string;
  lineup: {
    player_id: string;
    nba_player_id: number;
    player_name: string;
    game_id: string;
  }[];
  live_score: number;
  rank: number;
  prize_amount: number;
}

interface PoolDetails {
  id: string;
  name: string;
  slate_date: string;
  entry_fee: number;
  prize_pool: number;
  status: string;
  total_entries: number;
}

export default function DFSPoolLeaderboard() {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch pool details
  const { data: pool, isLoading: poolLoading } = useQuery<PoolDetails>({
    queryKey: ['dfs-pool', poolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_pools')
        .select('id, name, slate_date, entry_fee, prize_pool, status')
        .eq('id', poolId)
        .single();

      if (error) throw error;
      
      // Get total entries count
      const { count } = await supabase
        .from('dfs_entries')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', poolId);

      return {
        ...data,
        total_entries: count || 0,
      };
    },
    enabled: !!poolId,
  });

  // Fetch leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading, refetch } = useQuery<PoolEntry[]>({
    queryKey: ['dfs-pool-leaderboard', poolId],
    queryFn: async () => {
      if (!poolId) return [];

      // Get all entries for this pool
      const { data: entries, error: entriesError } = await supabase
        .from('dfs_entries')
        .select(`
          id,
          user_id,
          final_points,
          profiles:user_id (
            username
          )
        `)
        .eq('pool_id', poolId)
        .eq('is_submitted', true);

      if (entriesError) throw entriesError;

      // Get lineup for each entry and calculate live scores
      const entriesWithScores = await Promise.all(
        (entries || []).map(async (entry) => {
          // Get lineup
          const { data: lineup } = await supabase
            .from('dfs_lineups')
            .select('id')
            .eq('entry_id', entry.id)
            .maybeSingle();

          if (!lineup) {
            return {
              entry_id: entry.id,
              user_id: entry.user_id,
              user_name: (entry.profiles as any)?.username || 'Anonymous',
              lineup: [],
              live_score: 0,
              rank: 0,
              prize_amount: 0,
            };
          }

          // Get lineup positions
          const { data: positions } = await supabase
            .from('dfs_lineup_positions')
            .select('player_id, nba_player_id, player_name')
            .eq('lineup_id', lineup.id);

          // Get games for today's slate
          const { data: games } = await supabase
            .from('nba_games')
            .select('game_id')
            .eq('slate_date', pool?.slate_date)
            .eq('game_status', 2); // Live games only

          const gameIds = games?.map(g => g.game_id) || [];

          // Calculate live score by fetching stats for each player
          let totalScore = 0;
          
          if (pool?.status === 'live' && gameIds.length > 0) {
            for (const player of positions || []) {
              // Find which game this player is in
              const { data: liveStats } = await supabase
                .from('live_player_stats')
                .select('stats')
                .eq('nba_player_id', player.nba_player_id)
                .in('game_id', gameIds)
                .maybeSingle();

              if (liveStats?.stats) {
                const fantasyPoints = calculateFantasyPoints(liveStats.stats, FANDUEL_SCORING);
                totalScore += fantasyPoints;
              }
            }
          } else if (pool?.status === 'completed') {
            // Use final points for completed pools
            totalScore = entry.final_points || 0;
          }

          return {
            entry_id: entry.id,
            user_id: entry.user_id,
            user_name: (entry.profiles as any)?.username || 'Anonymous',
            lineup: (positions || []).map(p => ({
              ...p,
              game_id: '', // We'd need to join with player schedules to get this
            })),
            live_score: totalScore,
            rank: 0, // Will calculate below
            prize_amount: 0, // Will calculate based on payout structure
          };
        })
      );

      // Sort by score and assign ranks
      const sorted = entriesWithScores.sort((a, b) => b.live_score - a.live_score);
      sorted.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return sorted;
    },
    enabled: !!poolId && !!pool,
    refetchInterval: autoRefresh && pool?.status === 'live' ? 30000 : false, // Auto-refresh every 30 seconds if live
  });

  // Real-time subscription to live_player_stats updates
  useEffect(() => {
    if (!poolId || !pool || pool.status !== 'live') return;

    console.log('🔔 Setting up real-time subscription for pool:', poolId);

    const channel = supabase
      .channel(`pool-${poolId}-live-stats`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_player_stats',
        },
        (payload) => {
          console.log('📊 Live stats updated:', payload);
          // Refetch leaderboard when any player stats update
          refetch();
        }
      )
      .subscribe();

    return () => {
      console.log('👋 Unsubscribing from real-time updates');
      channel.unsubscribe();
    };
  }, [poolId, pool?.status, refetch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'danger';
      case 'completed': return 'success';
      case 'scheduled': return 'primary';
      default: return 'neutral';
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'warning';
    if (rank === 2) return 'neutral';
    if (rank === 3) return 'neutral';
    return undefined;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (poolLoading || leaderboardLoading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <LinearProgress />
        <Typography level="body-sm" sx={{ mt: 2, textAlign: 'center' }}>
          Loading leaderboard...
        </Typography>
      </Box>
    );
  }

  if (!pool) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, textAlign: 'center' }}>
        <Typography level="h4">Pool not found</Typography>
        <Button onClick={() => navigate('/dfs')} sx={{ mt: 2 }}>
          Back to DFS
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/dfs')} variant="outlined">
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography level="h3" sx={{ fontWeight: 'bold' }}>
              {pool.name}
            </Typography>
            {pool.status === 'live' && (
              <Chip
                color="danger"
                variant="solid"
                size="lg"
                sx={{
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                  },
                }}
              >
                🔴 LIVE
              </Chip>
            )}
            {pool.status === 'completed' && (
              <Chip color="success" variant="solid" size="lg">
                ✅ FINAL
              </Chip>
            )}
          </Stack>
          <Typography level="body-sm" color="neutral">
            {new Date(pool.slate_date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })} • {pool.total_entries} Entries • ${pool.entry_fee} Entry Fee
          </Typography>
        </Box>
        {pool.status === 'live' && (
          <Button
            variant="outlined"
            color={autoRefresh ? 'primary' : 'neutral'}
            startDecorator={<Refresh />}
            onClick={() => {
              setAutoRefresh(!autoRefresh);
              refetch();
            }}
          >
            {autoRefresh ? 'Auto-refreshing' : 'Refresh'}
          </Button>
        )}
      </Stack>

      {/* Prize Pool Card */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
        <CardContent>
          <Stack direction="row" spacing={4} alignItems="center" justifyContent="center">
            <Box sx={{ textAlign: 'center' }}>
              <EmojiEvents sx={{ fontSize: 40, color: 'warning.500', mb: 1 }} />
              <Typography level="body-xs" color="neutral">Total Prize Pool</Typography>
              <Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.700' }}>
                ${pool.prize_pool.toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <TrendingUp sx={{ fontSize: 40, color: 'success.500', mb: 1 }} />
              <Typography level="body-xs" color="neutral">Total Entries</Typography>
              <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                {pool.total_entries}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardContent>
          <Typography level="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
            🏆 Leaderboard
          </Typography>
          
          {leaderboard && leaderboard.length > 0 ? (
            <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto' }}>
              <Table>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Rank</th>
                    <th>Player</th>
                    <th style={{ width: 120, textAlign: 'right' }}>
                      {pool.status === 'live' ? 'Live Score' : 'Final Score'}
                    </th>
                    <th style={{ width: 120, textAlign: 'right' }}>Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.entry_id}>
                      <td>
                        <Chip
                          size="lg"
                          variant="soft"
                          color={getRankColor(entry.rank)}
                        >
                          {getRankIcon(entry.rank)}
                        </Chip>
                      </td>
                      <td>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar size="sm">{entry.user_name.charAt(0).toUpperCase()}</Avatar>
                          <Box>
                            <Typography level="body-md" sx={{ fontWeight: 'bold' }}>
                              {entry.user_name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {entry.lineup.length} players
                            </Typography>
                          </Box>
                        </Stack>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Typography 
                          level="h4" 
                          sx={{ 
                            fontWeight: 'bold',
                            color: pool.status === 'live' ? 'danger.600' : 'success.600'
                          }}
                        >
                          {entry.live_score.toFixed(2)}
                        </Typography>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Typography level="body-md" sx={{ fontWeight: 'bold', color: 'success.700' }}>
                          {entry.prize_amount > 0 ? `$${entry.prize_amount.toFixed(2)}` : '-'}
                        </Typography>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Sheet>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography level="body-md" color="neutral">
                No entries yet
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {pool.status === 'live' && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography level="body-xs" color="neutral">
            Scores update automatically every 30 seconds
          </Typography>
        </Box>
      )}
    </Box>
  );
}

