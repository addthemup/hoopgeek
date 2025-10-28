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

      // Use RPC function to get entries with user emails (requires admin)
      const { data: entriesData, error: entriesError } = await supabase.rpc(
        'get_admin_pool_entries',
        { p_pool_id: poolId }
      );

      if (entriesError) {
        console.error('❌ Error fetching entries via RPC:', entriesError);
        
        // Fallback: Try direct query if RPC fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('dfs_entries')
          .select(`
            id,
            user_id,
            final_points,
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

        // Map fallback data to expected format
        const mappedEntries = (fallbackData || []).map((entry) => ({
          entry_id: entry.id,
          user_id: entry.user_id,
          user_email: `User ${entry.user_id.substring(0, 8)}`,
          user_avatar_url: null,
          final_points: entry.final_points,
          rank: entry.final_rank,
          prize_amount: entry.prize_amount,
          is_submitted: entry.is_submitted || entry.lineup_locked,
          created_at: entry.created_at,
          total_salary: entry.total_salary,
        }));

        return mappedEntries as PoolEntry[];
      }

      console.log('✅ Fetched entries via RPC:', entriesData?.length);

      // Map RPC data to expected format
      const mappedEntries = (entriesData || []).map((entry: any) => ({
        entry_id: entry.entry_id,
        user_id: entry.user_id,
        user_email: entry.user_email || entry.user_display_name || 'Unknown',
        user_avatar_url: entry.user_avatar_url,
        final_points: entry.final_points,
        rank: entry.final_rank,
        prize_amount: entry.prize_amount,
        is_submitted: entry.is_submitted || entry.lineup_locked,
        created_at: entry.created_at,
        total_salary: entry.total_salary,
      }));

      return mappedEntries as PoolEntry[];
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
          maxWidth: 1200, 
          maxHeight: '90vh', 
          overflow: 'auto' 
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <EmojiEvents color="warning" />
            <Box>
              <Typography level="h4">{pool?.name || 'Pool Details'}</Typography>
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
              <Card variant="outlined">
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 2 }}>Pool Summary</Typography>
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={2} 
                    divider={<Divider orientation="vertical" />}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Slate Date</Typography>
                      <Typography level="title-sm">
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
                      <Typography level="title-sm">
                        {pool?.current_entries} / {pool?.max_entries}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Entry Fee</Typography>
                      <Typography level="title-sm">${pool?.entry_fee}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Prize Pool</Typography>
                      <Typography level="title-sm" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                        ${pool?.prize_pool?.toLocaleString()}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card variant="outlined">
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 2 }}>Financial Summary</Typography>
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={2} 
                    divider={<Divider orientation="vertical" />}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Total Revenue</Typography>
                      <Typography level="title-sm" sx={{ color: 'success.600' }}>
                        ${payoutSummary.totalRevenue.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Prize Pool</Typography>
                      <Typography level="title-sm">
                        ${payoutSummary.totalPrizePool.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Paid Out</Typography>
                      <Typography level="title-sm">
                        ${payoutSummary.totalPaidOut.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>Rake (10%)</Typography>
                      <Typography level="title-sm" sx={{ color: 'primary.600' }}>
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
                    Entries ({entries?.length || 0})
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
                      maxHeight: { xs: '50vh', md: '60vh' }
                    }}
                  >
                    <Table stickyHeader sx={{
                      '& thead th': {
                        bgcolor: '#000',
                        color: '#fff',
                        fontFamily: 'serif',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        borderBottom: '3px solid #000',
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em'
                      },
                      '& tbody td': {
                        borderBottom: '2px solid #000',
                        fontFamily: 'serif'
                      },
                      '& tbody tr:hover': {
                        bgcolor: '#f0f0f0'
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
                                  <Typography level="body-sm">
                                    {entry.user_email.split('@')[0]}
                                  </Typography>
                                </Stack>
                              </td>
                              <td>
                                <Typography level="title-sm" sx={{ fontWeight: 'bold' }}>
                                  {entry.final_points?.toFixed(2) || '-'}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
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
                      maxHeight: { xs: '50vh', md: '60vh' }
                    }}
                  >
                    <Table stickyHeader sx={{
                      '& thead th': {
                        bgcolor: '#000',
                        color: '#fff',
                        fontFamily: 'serif',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        borderBottom: '3px solid #000',
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em'
                      },
                      '& tbody td': {
                        borderBottom: '2px solid #000',
                        fontFamily: 'serif'
                      },
                      '& tbody tr:hover': {
                        bgcolor: '#f0f0f0'
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
                                    <Typography level="body-sm">
                                      {entry.user_email.split('@')[0]}
                                    </Typography>
                                  </Stack>
                                </td>
                                <td>
                                  <Typography level="title-sm">
                                    {entry.final_points?.toFixed(2)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography 
                                    level="title-sm" 
                                    sx={{ fontWeight: 'bold', color: 'success.600' }}
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
                      maxHeight: { xs: '50vh', md: '60vh' }
                    }}
                  >
                    <Table sx={{
                      '& thead th': {
                        bgcolor: '#000',
                        color: '#fff',
                        fontFamily: 'serif',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        borderBottom: '3px solid #000',
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em'
                      },
                      '& tbody td': {
                        borderBottom: '2px solid #000',
                        fontFamily: 'serif'
                      },
                      '& tbody tr:hover': {
                        bgcolor: '#f0f0f0'
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
                                <Typography level="title-sm">
                                  {game.away_team} @ {game.home_team}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
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

