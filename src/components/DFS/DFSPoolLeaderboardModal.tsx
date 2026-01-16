import { useState, useEffect } from 'react';
import {
  Modal,
  ModalDialog,
  ModalClose,
  Box,
  Typography,
  Table,
  Chip,
  Avatar,
  Stack,
  Button,
  LinearProgress,
  Sheet,
  Card,
  CardContent,
} from '@mui/joy';
import { EmojiEvents, TrendingUp, Refresh } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';

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

interface DFSPoolLeaderboardModalProps {
  poolId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function DFSPoolLeaderboardModal({ poolId, open, onClose }: DFSPoolLeaderboardModalProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch pool details
  const { data: pool, isLoading: poolLoading } = useQuery<PoolDetails>({
    queryKey: ['dfs-pool-modal', poolId],
    queryFn: async () => {
      if (!poolId) throw new Error('No pool ID');
      
      const { data, error } = await supabase
        .from('dfs_pools')
        .select('id, name, slate_date, entry_fee, prize_pool, status')
        .eq('id', poolId)
        .single();

      if (error) throw error;
      
      const { count } = await supabase
        .from('dfs_entries')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', poolId);

      return {
        ...data,
        total_entries: count || 0,
      };
    },
    enabled: open && !!poolId,
  });

  // Fetch leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading, refetch } = useQuery<PoolEntry[]>({
    queryKey: ['dfs-pool-leaderboard-modal', poolId],
    queryFn: async () => {
      if (!poolId) return [];

      const { data: entries, error: entriesError } = await supabase
        .from('dfs_entries')
        .select(`
          id,
          user_id,
          final_score,
          final_points,
          profiles:user_id (
            username
          )
        `)
        .eq('pool_id', poolId)
        .eq('is_submitted', true);

      if (entriesError) throw entriesError;

      const entriesWithScores = await Promise.all(
        (entries || []).map(async (entry) => {
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

          const { data: positions } = await supabase
            .from('dfs_lineup_positions')
            .select('player_id, nba_player_id, player_name, weighted_points')
            .eq('lineup_id', lineup.id);

          // Use server-side calculated points from database
          // For live pools, the server should update these via update_lineup_position_scores()
          // For completed pools, use final_score from entry
          let totalScore = 0;
          
          if (pool?.status === 'completed') {
            // Use final score from entry (server-calculated)
            totalScore = entry.final_score || entry.final_points || 0;
          } else {
            // For live pools, sum weighted_points from lineup positions (server-calculated)
            totalScore = (positions || []).reduce((sum, p) => {
              return sum + (p.weighted_points || 0);
            }, 0);
          }

          return {
            entry_id: entry.id,
            user_id: entry.user_id,
            user_name: (entry.profiles as any)?.username || 'Anonymous',
            lineup: (positions || []).map(p => ({
              ...p,
              game_id: '',
            })),
            live_score: totalScore,
            rank: 0,
            prize_amount: 0,
          };
        })
      );

      const sorted = entriesWithScores.sort((a, b) => b.live_score - a.live_score);
      sorted.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return sorted;
    },
    enabled: open && !!poolId && !!pool,
    refetchInterval: autoRefresh && pool?.status === 'live' ? 30000 : false,
  });

  // Real-time subscription
  useEffect(() => {
    if (!open || !poolId || !pool || pool.status !== 'live') return;

    const channel = supabase
      .channel(`pool-modal-${poolId}-live-stats`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_player_stats',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [open, poolId, pool?.status, refetch]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'warning';
    if (rank === 2) return 'neutral';
    if (rank === 3) return 'neutral';
    return undefined;
  };

  if (!open || !poolId) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: '90vw',
          width: '1000px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <ModalClose />
        
        {poolLoading || leaderboardLoading ? (
          <Box sx={{ p: 4 }}>
            <LinearProgress />
            <Typography level="body-sm" sx={{ mt: 2, textAlign: 'center' }}>
              Loading leaderboard...
            </Typography>
          </Box>
        ) : pool ? (
          <Box>
            {/* Header */}
            <Box sx={{ p: 3, pb: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Typography level="h4" sx={{ fontWeight: 'bold', flex: 1 }}>
                  {pool.name}
                </Typography>
                {pool.status === 'live' && (
                  <Chip
                    color="danger"
                    variant="solid"
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
                  <Chip color="success" variant="solid">
                    ✅ FINAL
                  </Chip>
                )}
              </Stack>
              <Typography level="body-sm" color="neutral">
                {new Date(pool.slate_date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })} • {pool.total_entries} Entries • ${pool.entry_fee} Entry
              </Typography>
            </Box>

            {/* Prize Pool */}
            <Card sx={{ mx: 3, mb: 2, bgcolor: 'primary.50' }}>
              <CardContent>
                <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
                  <Box sx={{ textAlign: 'center' }}>
                    <EmojiEvents sx={{ fontSize: 32, color: 'warning.500' }} />
                    <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>Prize Pool</Typography>
                    <Typography level="h4" sx={{ fontWeight: 'bold', color: 'primary.700' }}>
                      ${pool.prize_pool.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <TrendingUp sx={{ fontSize: 32, color: 'success.500' }} />
                    <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>Entries</Typography>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {pool.total_entries}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Box sx={{ px: 3, pb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
                  🏆 Leaderboard
                </Typography>
                {pool.status === 'live' && (
                  <Button
                    size="sm"
                    variant="outlined"
                    color={autoRefresh ? 'primary' : 'neutral'}
                    startDecorator={<Refresh />}
                    onClick={() => {
                      setAutoRefresh(!autoRefresh);
                      refetch();
                    }}
                  >
                    {autoRefresh ? 'Auto' : 'Manual'}
                  </Button>
                )}
              </Stack>

              {leaderboard && leaderboard.length > 0 ? (
                <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: '400px' }}>
                  <Table stickyHeader>
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Rank</th>
                        <th>Player</th>
                        <th style={{ width: 100, textAlign: 'right' }}>
                          {pool.status === 'live' ? 'Live' : 'Final'}
                        </th>
                        <th style={{ width: 100, textAlign: 'right' }}>Prize</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry) => (
                        <tr key={entry.entry_id}>
                          <td>
                            <Chip
                              size="sm"
                              variant="soft"
                              color={getRankColor(entry.rank)}
                            >
                              {getRankIcon(entry.rank)}
                            </Chip>
                          </td>
                          <td>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar size="sm">{entry.user_name.charAt(0).toUpperCase()}</Avatar>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {entry.user_name}
                              </Typography>
                            </Stack>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Typography 
                              level="title-md" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: pool.status === 'live' ? 'danger.600' : 'success.600'
                              }}
                            >
                              {entry.live_score.toFixed(2)}
                            </Typography>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.700' }}>
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

              {pool.status === 'live' && (
                <Typography level="body-xs" color="neutral" sx={{ mt: 1, textAlign: 'center' }}>
                  Auto-updates every 30 seconds
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography level="body-md">Pool not found</Typography>
          </Box>
        )}
      </ModalDialog>
    </Modal>
  );
}

