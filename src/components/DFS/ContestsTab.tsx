import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  LinearProgress,
  Alert,
  Chip,
  Button,
  Stack,
} from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';

interface DFSContest {
  pool_id: string;
  name: string;
  description: string;
  slate_name: string;
  slate_date: string;
  lock_time: string;
  entry_fee: number;
  prize_pool: number;
  current_entries: number;
  max_entries: number;
  min_entries: number;
  max_entries_per_user: number;
  difficulty_tier: 'elite' | 'pro' | 'standard';
  salary_cap: number;
  prize_type: string;
  is_guaranteed: boolean;
  is_featured: boolean;
  status: string;
  fill_percentage: number;
  games_count: number;
  active_players_count: number;
  seconds_until_lock: number;
  games: Array<{
    game_id: string;
    home_team: string;
    away_team: string;
    game_date: string;
  }>;
}

interface ContestsTabProps {
  selectedGameId: string | null;
  onPoolSelect: (poolId: string, view?: 'details' | 'lineup-builder') => void;
}

export default function ContestsTab({ selectedGameId, onPoolSelect }: ContestsTabProps) {
  // Fetch DFS contests
  const { data: dfsContests, isLoading: dfsLoading } = useQuery<DFSContest[]>({
    queryKey: ['dfs-todays-contests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_todays_contests')
        .select('*')
        .order('lock_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Filter contests by selected game
  const filteredContests = selectedGameId
    ? dfsContests?.filter((contest) =>
        contest.games?.some((g) => g.game_id === selectedGameId)
      )
    : dfsContests;

  return (
    <Box>
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent sx={{ bgcolor: '#000000' }}>
          <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold', color: '#FFFFFF' }}>
            Contests Available
          </Typography>
          
          {dfsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <LinearProgress sx={{ width: '100%' }} />
            </Box>
          ) : filteredContests && filteredContests.length > 0 ? (
            <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <Table hoverRow size="sm" sx={{ 
                bgcolor: '#000000', 
                tableLayout: 'auto',
                '& tbody td': {
                  color: '#FFFFFF',
                },
                '& tbody tr:hover': {
                  bgcolor: '#1a1a1a',
                },
              }}>
                <thead>
                  <tr>
                    <th style={{ color: '#FFFFFF', width: '25%' }}>Contest</th>
                    <th style={{ color: '#FFFFFF', width: '12%' }}>Prize Pool</th>
                    <th style={{ color: '#FFFFFF', width: '10%' }}>Entry Fee</th>
                    <th style={{ color: '#FFFFFF', width: '12%' }}>Entries</th>
                    <th style={{ color: '#FFFFFF', width: '12%' }}>Lock Time</th>
                    <th style={{ color: '#FFFFFF', width: '29%', minWidth: '140px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContests.map((contest) => (
                    <tr key={contest.pool_id}>
                      <td>
                        <Box>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                            {contest.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                            {contest.is_featured && (
                              <Chip size="sm" color="warning" variant="soft">
                                Featured
                              </Chip>
                            )}
                            {contest.is_guaranteed && (
                              <Chip size="sm" color="success" variant="soft">
                                Guaranteed
                              </Chip>
                            )}
                          </Box>
                        </Box>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                          ${(contest.prize_pool / 100).toFixed(0)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                          ${(contest.entry_fee / 100).toFixed(0)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                          {contest.current_entries} / {contest.max_entries || '∞'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                          {new Date(contest.lock_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </Typography>
                      </td>
                      <td>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'nowrap' }}>
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() => onPoolSelect(contest.pool_id, 'details')}
                            sx={{ 
                              borderColor: '#333333', 
                              color: '#FFFFFF',
                              minWidth: 'auto',
                              px: 1,
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="solid"
                            color="primary"
                            onClick={() => onPoolSelect(contest.pool_id, 'lineup-builder')}
                            sx={{
                              bgcolor: '#FFC72C',
                              color: '#000000',
                              fontWeight: 'bold',
                              minWidth: 'auto',
                              px: 1,
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                              '&:hover': {
                                bgcolor: '#FFD700',
                              },
                            }}
                          >
                            Enter
                          </Button>
                        </Stack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Box>
          ) : (
            <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
              <Typography sx={{ color: '#FFFFFF' }}>
                {selectedGameId ? 'No contests for this game right now' : 'No contests available'}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

