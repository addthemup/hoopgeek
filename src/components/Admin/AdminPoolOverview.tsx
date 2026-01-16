import { useState } from 'react';
import {
  Box,
  Typography,
  Sheet,
  Table,
  Avatar,
  Chip,
  Stack,
  CircularProgress,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Button,
} from '@mui/joy';
import { ArrowBack, EmojiEvents, Person, AttachMoney } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { format } from 'date-fns';

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

interface AdminPoolOverviewProps {
  poolId: string;
  onBack: () => void;
}

export default function AdminPoolOverview({ poolId, onBack }: AdminPoolOverviewProps) {
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
    enabled: !!poolId,
  });

  // Fetch pool entries with user information and calculate scores
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['admin-pool-entries', poolId, pool?.status],
    queryFn: async () => {
      if (!poolId) return [];

      console.log('🔍 Fetching entries for pool:', poolId);

      // First, get the pool's current_entries count for comparison
      const { data: poolData } = await supabase
        .from('dfs_pools')
        .select('current_entries, status')
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
    enabled: !!poolId,
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
    enabled: !!poolId,
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

  if (poolLoading || entriesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!pool) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography level="h4">Pool not found</Typography>
        <Button onClick={onBack} sx={{ mt: 2 }}>
          Back to Pools
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Back Button */}
      <Stack 
        direction="row" 
        spacing={2} 
        alignItems="center" 
        sx={{ 
          mb: 3,
          bgcolor: '#ffffff',
          p: 2,
          borderRadius: 'sm',
          border: '1px solid #e0e0e0'
        }}
      >
        <Button
          variant="plain"
          startDecorator={<ArrowBack />}
          onClick={onBack}
          sx={{ color: '#000' }}
        >
          Back to Pools
        </Button>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <EmojiEvents color="warning" />
            <Box>
              <Typography level="h4" sx={{ color: '#000' }}>{pool.name}</Typography>
              <Typography level="body-sm" sx={{ color: '#666', fontWeight: 'bold' }}>
                Administrative Pool Overview
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Stack>

      {/* Tabs for all views */}
      <Tabs 
        value={activeTab} 
        onChange={(_, value) => setActiveTab(value as number)} 
        sx={{ 
          mt: 2,
          bgcolor: '#ffffff',
          borderRadius: 'sm',
          p: 1
        }}
      >
        <TabList
          sx={{
            bgcolor: '#f5f5f5',
            borderRadius: 'sm',
            '& button': {
              color: '#000',
              '&.Mui-selected': {
                color: '#000',
                bgcolor: '#ffffff',
              },
            },
          }}
        >
          <Tab>
            Pool Summary
          </Tab>
          <Tab>
            Financial Summary
          </Tab>
          <Tab>
            Configuration
          </Tab>
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
          <Tab>
            Metadata
          </Tab>
        </TabList>

          {/* Pool Summary Tab */}
          <TabPanel value={0} sx={{ bgcolor: '#ffffff', p: 2 }}>
            <Sheet 
              variant="outlined" 
              sx={{ 
                borderRadius: 'sm', 
                overflow: 'auto',
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
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Name</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>{pool.name}</Typography>
                    </td>
                  </tr>
                  {pool.description && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Description</Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000' }}>{pool.description}</Typography>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Pool Type</Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant="soft">{pool.pool_type || 'classic'}</Chip>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Slate Name</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>{pool.slate_name}</Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Slate Date</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.slate_date ? format(new Date(pool.slate_date), 'MMM dd, yyyy') : 'N/A'}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Start Time</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.start_time ? format(new Date(pool.start_time), 'MMM dd, yyyy h:mm a') : 'N/A'}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Lock Time</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.lock_time ? format(new Date(pool.lock_time), 'MMM dd, yyyy h:mm a') : 'N/A'}
                      </Typography>
                    </td>
                  </tr>
                  {pool.end_time && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>End Time</Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000' }}>
                          {format(new Date(pool.end_time), 'MMM dd, yyyy h:mm a')}
                        </Typography>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Status</Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant="soft" color="primary">
                        {pool.status}
                      </Chip>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Entries</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.current_entries} / {pool.max_entries} (min: {pool.min_entries || 2})
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Max Entries Per User</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>{pool.max_entries_per_user || 1}</Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Entry Fee</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>${pool.entry_fee}</Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Prize Pool</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#000' }}>
                        ${pool.prize_pool?.toLocaleString()}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Visibility</Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={1}>
                        <Chip size="sm" variant={pool.is_public ? 'solid' : 'outlined'} color={pool.is_public ? 'success' : 'neutral'}>
                          {pool.is_public ? 'Public' : 'Private'}
                        </Chip>
                        {pool.is_featured && (
                          <Chip size="sm" variant="solid" color="warning">Featured</Chip>
                        )}
                      </Stack>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Sheet>
          </TabPanel>

          {/* Financial Summary Tab */}
          <TabPanel value={1} sx={{ bgcolor: '#ffffff', p: 2 }}>
            <Sheet 
              variant="outlined" 
              sx={{ 
                borderRadius: 'sm', 
                overflow: 'auto',
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
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Total Revenue</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        ${payoutSummary.totalRevenue.toLocaleString()}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Prize Pool</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        ${payoutSummary.totalPrizePool.toLocaleString()}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Paid Out</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        ${payoutSummary.totalPaidOut.toLocaleString()}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Rake</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        ${payoutSummary.rake.toLocaleString()} ({pool.rake_percentage || 10}%)
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Prize Type</Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant="soft">{pool.prize_type || 'top_n'}</Chip>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Guaranteed</Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="sm" variant={pool.is_guaranteed ? 'solid' : 'outlined'} color={pool.is_guaranteed ? 'success' : 'neutral'}>
                          {pool.is_guaranteed ? 'Yes' : 'No'}
                        </Chip>
                        {pool.is_guaranteed && pool.guaranteed_amount && (
                          <Typography level="body-sm" sx={{ color: '#000' }}>
                            ${pool.guaranteed_amount.toLocaleString()}
                          </Typography>
                        )}
                      </Stack>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Sheet>
          </TabPanel>

          {/* Configuration Tab */}
          <TabPanel value={2} sx={{ bgcolor: '#ffffff', p: 2 }}>
            <Sheet 
              variant="outlined" 
              sx={{ 
                borderRadius: 'sm', 
                overflow: 'auto',
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
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Difficulty Tier</Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant="soft" color={
                        pool.difficulty_tier === 'elite' ? 'danger' :
                        pool.difficulty_tier === 'pro' ? 'warning' : 'success'
                      }>
                        {pool.difficulty_tier || 'standard'}
                      </Chip>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Salary Cap</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        ${(pool.salary_cap / 1000000).toFixed(1)}M
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Roster Size</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>{pool.roster_size || 10}</Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Starters</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.starters_count || 5} players × {pool.starters_multiplier || 1.00}x
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Rotation</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.rotation_count || 3} players × {pool.rotation_multiplier || 0.75}x
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Bench</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.bench_count || 2} players × {pool.bench_multiplier || 0.50}x
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Scoring Format</Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant="soft">{pool.scoring_format || 'FanDuel'}</Chip>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Late Swap</Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="sm" variant={pool.allow_late_swap ? 'solid' : 'outlined'} color={pool.allow_late_swap ? 'success' : 'neutral'}>
                          {pool.allow_late_swap ? 'Enabled' : 'Disabled'}
                        </Chip>
                        {pool.allow_late_swap && pool.late_swap_until && (
                          <Typography level="body-xs" sx={{ color: '#666' }}>
                            Until: {format(new Date(pool.late_swap_until), 'MMM dd, h:mm a')}
                          </Typography>
                        )}
                      </Stack>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Allow Duplicates</Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant={pool.allow_duplicates ? 'solid' : 'outlined'} color={pool.allow_duplicates ? 'success' : 'neutral'}>
                        {pool.allow_duplicates ? 'Yes' : 'No'}
                      </Chip>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Require Unique Lineups</Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant={pool.require_unique_lineups ? 'solid' : 'outlined'} color={pool.require_unique_lineups ? 'success' : 'neutral'}>
                        {pool.require_unique_lineups ? 'Yes' : 'No'}
                      </Chip>
                    </td>
                  </tr>
                  {pool.min_unique_players && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Min Unique Players</Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000' }}>{pool.min_unique_players}</Typography>
                      </td>
                    </tr>
                  )}
                  {pool.lineup_requirements && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Lineup Requirements</Typography>
                      </td>
                      <td>
                        <Typography level="body-xs" sx={{ color: '#000', fontFamily: 'monospace' }}>
                          {typeof pool.lineup_requirements === 'string' 
                            ? pool.lineup_requirements 
                            : JSON.stringify(pool.lineup_requirements, null, 2)}
                        </Typography>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Sheet>
          </TabPanel>

          {/* Entries Tab */}
          <TabPanel value={3} sx={{ bgcolor: '#ffffff', p: 2 }}>
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
                    entries.map((entry) => (
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
          <TabPanel value={4} sx={{ bgcolor: '#ffffff', p: 2 }}>
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
          <TabPanel value={5} sx={{ bgcolor: '#ffffff', p: 2 }}>
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

          {/* Metadata Tab */}
          <TabPanel value={6} sx={{ bgcolor: '#ffffff', p: 2 }}>
            <Sheet 
              variant="outlined" 
              sx={{ 
                borderRadius: 'sm', 
                overflow: 'auto',
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
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Icon</Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant="soft">{pool.icon_name || 'N/A'}</Chip>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Primary Color</Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            bgcolor: pool.html_color_primary || '#FFC72C',
                            border: '1px solid #000',
                            borderRadius: '4px'
                          }}
                        />
                        <Typography level="body-sm" sx={{ color: '#000' }}>
                          {pool.html_color_primary || '#FFC72C'}
                        </Typography>
                      </Stack>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Secondary Color</Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            bgcolor: pool.html_color_secondary || '#000000',
                            border: '1px solid #000',
                            borderRadius: '4px'
                          }}
                        />
                        <Typography level="body-sm" sx={{ color: '#000' }}>
                          {pool.html_color_secondary || '#000000'}
                        </Typography>
                      </Stack>
                    </td>
                  </tr>
                  {pool.tags && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Tags</Typography>
                      </td>
                      <td>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {(Array.isArray(pool.tags) ? pool.tags : [pool.tags]).map((tag: string, idx: number) => (
                            <Chip key={idx} size="sm" variant="outlined">{tag}</Chip>
                          ))}
                        </Stack>
                      </td>
                    </tr>
                  )}
                  {pool.rules_url && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Rules URL</Typography>
                      </td>
                      <td>
                        <Typography 
                          level="body-sm" 
                          component="a"
                          href={pool.rules_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: '#0066cc', textDecoration: 'underline' }}
                        >
                          {pool.rules_url}
                        </Typography>
                      </td>
                    </tr>
                  )}
                  {pool.terms_url && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Terms URL</Typography>
                      </td>
                      <td>
                        <Typography 
                          level="body-sm" 
                          component="a"
                          href={pool.terms_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: '#0066cc', textDecoration: 'underline' }}
                        >
                          {pool.terms_url}
                        </Typography>
                      </td>
                    </tr>
                  )}
                  {pool.og_image_url && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>OG Image</Typography>
                      </td>
                      <td>
                        <Typography 
                          level="body-sm" 
                          component="a"
                          href={pool.og_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: '#0066cc', textDecoration: 'underline' }}
                        >
                          View Image
                        </Typography>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Created By Admin</Typography>
                    </td>
                    <td>
                      <Typography level="body-xs" sx={{ color: '#000', fontFamily: 'monospace' }}>
                        {pool.created_by_admin_id || 'N/A'}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Created At</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.created_at ? format(new Date(pool.created_at), 'MMM dd, yyyy h:mm a') : 'N/A'}
                      </Typography>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Updated At</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {pool.updated_at ? format(new Date(pool.updated_at), 'MMM dd, yyyy h:mm a') : 'N/A'}
                      </Typography>
                    </td>
                  </tr>
                  {pool.finalized_at && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Finalized At</Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000' }}>
                          {format(new Date(pool.finalized_at), 'MMM dd, yyyy h:mm a')}
                        </Typography>
                      </td>
                    </tr>
                  )}
                  {pool.cancelled_at && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Cancelled At</Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#dc2626', fontWeight: 'bold' }}>
                          {format(new Date(pool.cancelled_at), 'MMM dd, yyyy h:mm a')}
                        </Typography>
                      </td>
                    </tr>
                  )}
                  {pool.metadata && (
                    <tr>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>Metadata</Typography>
                      </td>
                      <td>
                        <Typography level="body-xs" sx={{ color: '#000', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {typeof pool.metadata === 'string' 
                            ? pool.metadata 
                            : JSON.stringify(pool.metadata, null, 2)}
                        </Typography>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Sheet>
          </TabPanel>
        </Tabs>
    </Box>
  );
}

