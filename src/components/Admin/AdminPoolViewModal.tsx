import { useState } from 'react';
import {
  Box,
  Typography,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  Sheet,
  Table,
  Avatar,
  Chip,
  Stack,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { format } from 'date-fns';
import { EmojiEvents, Person, AttachMoney } from '@mui/icons-material';

interface AdminPoolViewModalProps {
  poolId: string | null;
  open: boolean;
  onClose: () => void;
}

interface PoolEntry {
  entry_id: string;
  user_id: string;
  user_email: string;
  user_avatar_url: string | null;
  final_points: number | null;
  rank: number | null;
  prize_amount: number | null;
  is_submitted: boolean;
  created_at: string;
  total_salary: number;
}

export default function AdminPoolViewModal({ poolId, open, onClose }: AdminPoolViewModalProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Fetch pool details
  const { data: pool, isLoading: poolLoading } = useQuery({
    queryKey: ['admin-pool-detail', poolId],
    queryFn: async () => {
      if (!poolId) return null;

      const { data, error } = await supabase
        .from('dfs_pools')
        .select('*')
        .eq('id', poolId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!poolId,
  });

  // Fetch pool entries with user information
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['admin-pool-entries', poolId],
    queryFn: async () => {
      if (!poolId) return [];

      console.log('🔍 Fetching entries for pool:', poolId);

      // First, get the pool's current_entries count for comparison
      const { data: poolData } = await supabase
        .from('dfs_pools')
        .select('current_entries')
        .eq('id', poolId)
        .single();
      
      console.log('📊 Pool current_entries count from table:', poolData?.current_entries);

      // Also get a direct count of all entries (this might be filtered by RLS)
      const { count: directCount, data: directEntries } = await supabase
        .from('dfs_entries')
        .select('id, user_id', { count: 'exact' })
        .eq('pool_id', poolId);
      
      console.log('📊 Direct count of entries in dfs_entries table:', directCount);
      console.log('📊 Direct entries data (first 5):', directEntries?.slice(0, 5));

      // Try RPC function first (if it exists)
      let entriesData: any[] | null = null;
      let entriesError: any = null;
      
      try {
        const rpcResult = await supabase.rpc(
          'get_admin_pool_entries',
          { p_pool_id: poolId }
        );
        entriesData = rpcResult.data;
        entriesError = rpcResult.error;
        
        console.log('📊 RPC function returned:', entriesData?.length, 'entries');
        if (entriesData && entriesData.length > 0) {
          console.log('📊 Sample entry user_ids:', entriesData.slice(0, 5).map((e: any) => e.user_id));
        }
      } catch (err) {
        console.warn('⚠️ RPC function not available or error:', err);
        entriesError = err;
      }

      // If RPC fails or returns 404, use direct query with admin policy
      if (entriesError || !entriesData || entriesData.length === 0) {
        console.log('📊 Using direct query fallback (admin policy should allow all entries)');
        
        // Direct query - admin policy should allow viewing all entries
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('dfs_entries')
          .select(`
            id,
            user_id,
            final_points,
            final_score,
            final_rank,
            prize_amount,
            is_submitted,
            created_at,
            total_salary,
            lineup_locked
          `)
          .eq('pool_id', poolId)
          .order('final_rank', { ascending: true, nullsLast: true });

        if (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          throw fallbackError;
        }

        console.log('📊 Fetched entries (fallback):', fallbackData?.length);

        // Fetch user information for all unique user IDs
        const uniqueUserIds = [...new Set((fallbackData || []).map(e => e.user_id))];
        const userInfoMap = new Map<string, { email: string; avatar_url: string | null }>();
        
        // Try to get user emails from profiles table (if accessible)
        for (const userId of uniqueUserIds) {
          try {
            // Try to get from profiles first
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', userId)
              .maybeSingle();
            
            if (profile) {
              // Try to get email from auth.users via a service role call
              // Since we can't directly query auth.users, we'll use the profile display_name
              userInfoMap.set(userId, {
                email: profile.display_name || `user-${userId.substring(0, 8)}`,
                avatar_url: profile.avatar_url
              });
            } else {
              userInfoMap.set(userId, {
                email: `user-${userId.substring(0, 8)}`,
                avatar_url: null
              });
            }
          } catch (err) {
            console.warn(`Could not fetch user info for ${userId}:`, err);
            userInfoMap.set(userId, {
              email: `user-${userId.substring(0, 8)}`,
              avatar_url: null
            });
          }
        }

        // Calculate scores for entries that don't have final_points
        const entriesWithScores = await Promise.all(
          (fallbackData || []).map(async (entry) => {
            let calculatedScore = entry.final_points || entry.final_score || null;

            // If score is null, calculate from lineup positions
            if (!calculatedScore) {
              const { data: lineup } = await supabase
                .from('dfs_lineups')
                .select('id')
                .eq('entry_id', entry.id)
                .maybeSingle();

              if (lineup) {
                const { data: positions } = await supabase
                  .from('dfs_lineup_positions')
                  .select('weighted_points, raw_fantasy_points')
                  .eq('lineup_id', lineup.id);

                if (positions && positions.length > 0) {
                  // Sum weighted_points for the total score
                  calculatedScore = positions.reduce((sum, p) => {
                    return sum + (p.weighted_points || 0);
                  }, 0);
                  
                  // If no weighted_points, try raw_fantasy_points
                  if (calculatedScore === 0) {
                    calculatedScore = positions.reduce((sum, p) => {
                      return sum + (p.raw_fantasy_points || 0);
                    }, 0);
                  }
                }
              }
            }

            const userInfo = userInfoMap.get(entry.user_id) || { email: `user-${entry.user_id.substring(0, 8)}`, avatar_url: null };
            return {
              entry_id: entry.id,
              user_id: entry.user_id,
              user_email: userInfo.email,
              user_avatar_url: userInfo.avatar_url,
              final_points: calculatedScore,
              rank: entry.final_rank,
              prize_amount: entry.prize_amount,
              is_submitted: entry.is_submitted || entry.lineup_locked,
              created_at: entry.created_at,
              total_salary: entry.total_salary,
            };
          })
        );

        return entriesWithScores as PoolEntry[];
      }

      console.log('✅ Fetched entries via RPC:', entriesData?.length);
      console.log('📊 Comparison: Table shows', poolData?.current_entries, 'entries, RPC returned', entriesData?.length, 'entries');

      // Calculate scores for RPC entries that don't have final_points
      const entriesWithScores = await Promise.all(
        (entriesData || []).map(async (entry: any) => {
          let calculatedScore = entry.final_points || entry.final_score || null;

          // If score is null, calculate from lineup positions
          if (!calculatedScore) {
            const { data: lineup } = await supabase
              .from('dfs_lineups')
              .select('id')
              .eq('entry_id', entry.entry_id)
              .maybeSingle();

            if (lineup) {
              const { data: positions } = await supabase
                .from('dfs_lineup_positions')
                .select('weighted_points, raw_fantasy_points')
                .eq('lineup_id', lineup.id);

              if (positions && positions.length > 0) {
                // Sum weighted_points for the total score
                calculatedScore = positions.reduce((sum, p) => {
                  return sum + (p.weighted_points || 0);
                }, 0);
                
                // If no weighted_points, try raw_fantasy_points
                if (calculatedScore === 0) {
                  calculatedScore = positions.reduce((sum, p) => {
                    return sum + (p.raw_fantasy_points || 0);
                  }, 0);
                }
              }
            }
          }

          return {
            entry_id: entry.entry_id,
            user_id: entry.user_id,
            user_email: entry.user_email || entry.user_display_name || 'Unknown',
            user_avatar_url: entry.user_avatar_url,
            final_points: calculatedScore,
            rank: entry.final_rank,
            prize_amount: entry.prize_amount,
            is_submitted: entry.is_submitted || entry.lineup_locked,
            created_at: entry.created_at,
            total_salary: entry.total_salary,
          };
        })
      );

      return entriesWithScores as PoolEntry[];
    },
    enabled: open && !!poolId,
  });

  // Fetch pool games
  const { data: games } = useQuery({
    queryKey: ['admin-pool-games', poolId],
    queryFn: async () => {
      if (!poolId) return [];

      const { data, error } = await supabase
        .from('dfs_pool_games')
        .select('*')
        .eq('pool_id', poolId)
        .order('game_date');

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!poolId,
  });

  // Calculate payout summary
  const payoutSummary = {
    totalPrizePool: pool?.prize_pool || 0,
    totalPaidOut: entries?.reduce((sum, e) => sum + (e.prize_amount || 0), 0) || 0,
    totalEntries: entries?.length || 0,
    totalRevenue: (pool?.entry_fee || 0) * (entries?.length || 0),
    rake: ((pool?.entry_fee || 0) * (entries?.length || 0)) - (pool?.prize_pool || 0),
  };

  const getAvatarContent = (email: string) => {
    return email?.charAt(0).toUpperCase() || '?';
  };

  if (!poolId || !open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog 
        sx={{ 
          minWidth: { xs: '95vw', sm: '90vw', md: '80vw' }, 
          maxWidth: CONTENT_MAX_WIDTH, 
          maxHeight: '90vh', 
          overflow: 'auto',
          bgcolor: '#fff',
          border: '2px solid #000',
          boxShadow: '4px 4px 0px #000'
        }}
      >
        <DialogTitle sx={{ color: '#000' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <EmojiEvents color="warning" />
            <Box>
              <Typography level="h4" sx={{ color: '#000' }}>{pool?.name || 'Pool Details'}</Typography>
              <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                Administrative Pool Overview
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent>
          {poolLoading || entriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={3}>
              {/* Pool Summary */}
              <Card variant="outlined" sx={{ bgcolor: '#fff', border: '2px solid #000', boxShadow: '4px 4px 0px #000' }}>
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 2, color: '#000' }}>Pool Summary</Typography>
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={2} 
                    divider={<Divider orientation="vertical" />}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Slate Date</Typography>
                      <Typography level="title-sm" sx={{ color: '#000' }}>
                        {pool?.slate_date ? format(new Date(pool.slate_date), 'MMM dd, yyyy') : 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Status</Typography>
                      <Chip size="sm" variant="soft" color="primary">
                        {pool?.status}
                      </Chip>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Entries</Typography>
                      <Typography level="title-sm" sx={{ color: '#000' }}>
                        {pool?.current_entries} / {pool?.max_entries}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Entry Fee</Typography>
                      <Typography level="title-sm" sx={{ color: '#000' }}>${pool?.entry_fee}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Prize Pool</Typography>
                      <Typography level="title-sm" sx={{ fontWeight: 'bold', color: '#000' }}>
                        ${pool?.prize_pool?.toLocaleString()}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card variant="outlined" sx={{ bgcolor: '#fff', border: '2px solid #000', boxShadow: '4px 4px 0px #000' }}>
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 2, color: '#000' }}>Financial Summary</Typography>
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={2} 
                    divider={<Divider orientation="vertical" />}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Total Revenue</Typography>
                      <Typography level="title-sm" sx={{ color: '#000' }}>
                        ${payoutSummary.totalRevenue.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Prize Pool</Typography>
                      <Typography level="title-sm" sx={{ color: '#000' }}>
                        ${payoutSummary.totalPrizePool.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Paid Out</Typography>
                      <Typography level="title-sm" sx={{ color: '#000' }}>
                        ${payoutSummary.totalPaidOut.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Rake (10%)</Typography>
                      <Typography level="title-sm" sx={{ color: '#000' }}>
                        ${payoutSummary.rake.toLocaleString()}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Tabs for different views */}
              <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as number)}>
                <TabList>
                  <Tab>
                    <Person sx={{ mr: 1 }} />
                    Entries ({entries?.length || 0}
                    {pool?.current_entries !== undefined && entries?.length !== pool.current_entries && (
                      <span style={{ color: '#ff6b6b', marginLeft: '4px' }}>
                        (Table: {pool.current_entries})
                      </span>
                    )})
                  </Tab>
                  <Tab>
                    <AttachMoney sx={{ mr: 1 }} />
                    Payouts
                  </Tab>
                  <Tab>
                    Games ({games?.length || 0})
                  </Tab>
                </TabList>

                {/* Entries Tab */}
                <TabPanel value={0}>
                  <Sheet 
                    variant="outlined" 
                    sx={{ 
                      borderRadius: 'sm', 
                      overflow: 'auto',
                      maxHeight: { xs: '50vh', md: '60vh' },
                      bgcolor: '#fff',
                      border: '2px solid #000'
                    }}
                  >
                    <Table stickyHeader sx={{
                      '& thead th': {
                        bgcolor: '#000',
                        color: '#fff',
                        fontFamily: 'serif',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        borderBottom: '2px solid #000',
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em'
                      },
                      '& tbody td': {
                        borderBottom: '1px solid #000',
                        fontFamily: 'serif',
                        color: '#000',
                        bgcolor: '#fff'
                      },
                      '& tbody tr:hover': {
                        bgcolor: '#f5f5f5'
                      }
                    }}>
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>Rank</th>
                          <th>User</th>
                          <th style={{ width: '120px' }}>Score</th>
                          <th style={{ width: '120px' }}>Salary Used</th>
                          <th style={{ width: '100px' }}>Status</th>
                          <th style={{ width: '120px' }}>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries && entries.length > 0 ? (
                          entries.map((entry, index) => (
                            <tr key={entry.entry_id}>
                              <td>
                                <Chip 
                                  size="sm" 
                                  variant={entry.rank ? 'solid' : 'soft'}
                                  color={
                                    entry.rank === 1 ? 'warning' : 
                                    entry.rank === 2 ? 'neutral' : 
                                    entry.rank === 3 ? 'danger' : 'neutral'
                                  }
                                >
                                  {entry.rank ? `#${entry.rank}` : '-'}
                                </Chip>
                              </td>
                              <td>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <Avatar 
                                    size="sm"
                                    src={entry.user_avatar_url || undefined}
                                    alt={entry.user_email}
                                  >
                                    {getAvatarContent(entry.user_email)}
                                  </Avatar>
                                  <Typography level="body-sm" sx={{ color: '#000' }}>
                                    {entry.user_email.split('@')[0]}
                                  </Typography>
                                </Stack>
                              </td>
                              <td>
                                <Typography level="title-sm" sx={{ fontWeight: 'bold', color: '#000' }}>
                                  {entry.final_points?.toFixed(2) || '-'}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ color: '#000' }}>
                                  ${(entry.total_salary / 1000000).toFixed(1)}M
                                </Typography>
                              </td>
                              <td>
                                <Chip 
                                  size="sm" 
                                  variant="soft"
                                  color={entry.is_submitted ? 'success' : 'neutral'}
                                >
                                  {entry.is_submitted ? 'Submitted' : 'Draft'}
                                </Chip>
                              </td>
                              <td>
                                <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>
                                  {format(new Date(entry.created_at), 'MMM dd, h:mm a')}
                                </Typography>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6}>
                              <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                                  No entries yet
                                </Typography>
                              </Box>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Sheet>
                </TabPanel>

                {/* Payouts Tab */}
                <TabPanel value={1}>
                  <Sheet 
                    variant="outlined" 
                    sx={{ 
                      borderRadius: 'sm', 
                      overflow: 'auto',
                      maxHeight: { xs: '50vh', md: '60vh' },
                      bgcolor: '#fff',
                      border: '2px solid #000'
                    }}
                  >
                    <Table stickyHeader sx={{
                      '& thead th': {
                        bgcolor: '#000',
                        color: '#fff',
                        fontFamily: 'serif',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        borderBottom: '2px solid #000',
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em'
                      },
                      '& tbody td': {
                        borderBottom: '1px solid #000',
                        fontFamily: 'serif',
                        color: '#000',
                        bgcolor: '#fff'
                      },
                      '& tbody tr:hover': {
                        bgcolor: '#f5f5f5'
                      }
                    }}>
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>Rank</th>
                          <th>User</th>
                          <th style={{ width: '120px' }}>Score</th>
                          <th style={{ width: '120px' }}>Prize</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries && entries.filter(e => (e.prize_amount || 0) > 0).length > 0 ? (
                          entries
                            .filter(e => (e.prize_amount || 0) > 0)
                            .map((entry) => (
                              <tr key={entry.entry_id}>
                                <td>
                                  <Chip 
                                    size="sm" 
                                    variant="solid"
                                    color={
                                      entry.rank === 1 ? 'warning' : 
                                      entry.rank === 2 ? 'neutral' : 
                                      entry.rank === 3 ? 'danger' : 'primary'
                                    }
                                  >
                                    #{entry.rank}
                                  </Chip>
                                </td>
                                <td>
                                  <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Avatar 
                                      size="sm"
                                      src={entry.user_avatar_url || undefined}
                                      alt={entry.user_email}
                                    >
                                      {getAvatarContent(entry.user_email)}
                                    </Avatar>
                                    <Typography level="body-sm" sx={{ color: '#000' }}>
                                      {entry.user_email.split('@')[0]}
                                    </Typography>
                                  </Stack>
                                </td>
                                <td>
                                  <Typography level="title-sm" sx={{ color: '#000' }}>
                                    {entry.final_points?.toFixed(2)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography 
                                    level="title-sm" 
                                    sx={{ fontWeight: 'bold', color: '#000' }}
                                  >
                                    ${entry.prize_amount?.toLocaleString()}
                                  </Typography>
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan={4}>
                              <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                                  No payouts yet - pool may not be finalized
                                </Typography>
                              </Box>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Sheet>
                </TabPanel>

                {/* Games Tab */}
                <TabPanel value={2}>
                  <Sheet 
                    variant="outlined" 
                    sx={{ 
                      borderRadius: 'sm', 
                      overflow: 'auto',
                      maxHeight: { xs: '50vh', md: '60vh' },
                      bgcolor: '#fff',
                      border: '2px solid #000'
                    }}
                  >
                    <Table sx={{
                      '& thead th': {
                        bgcolor: '#000',
                        color: '#fff',
                        fontFamily: 'serif',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        borderBottom: '2px solid #000',
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em'
                      },
                      '& tbody td': {
                        borderBottom: '1px solid #000',
                        fontFamily: 'serif',
                        color: '#000',
                        bgcolor: '#fff'
                      },
                      '& tbody tr:hover': {
                        bgcolor: '#f5f5f5'
                      }
                    }}>
                      <thead>
                        <tr>
                          <th>Matchup</th>
                          <th>Game Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {games && games.length > 0 ? (
                          games.map((game: any) => (
                            <tr key={game.id}>
                              <td>
                                <Typography level="title-sm" sx={{ color: '#000' }}>
                                  {game.away_team} @ {game.home_team}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ color: '#000' }}>
                                  {format(new Date(game.game_date), 'MMM dd, yyyy h:mm a')}
                                </Typography>
                              </td>
                              <td>
                                <Chip size="sm" variant="soft">
                                  {game.game_status === 1 ? 'Scheduled' : 
                                   game.game_status === 2 ? 'Live' : 'Final'}
                                </Chip>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3}>
                              <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                                  No games found
                                </Typography>
                              </Box>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Sheet>
                </TabPanel>
              </Tabs>
            </Stack>
          )}
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
}

