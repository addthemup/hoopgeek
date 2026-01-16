import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Sheet,
  Table,
  Avatar,
  Chip,
  Stack,
  LinearProgress,
} from '@mui/joy';
import {
  Leaderboard,
  Person,
  TrendingUp,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';

interface LeaderboardEntry {
  entry_id: string;
  user_id: string;
  user_name: string;
  lineup: {
    player_id: string;
    nba_player_id: number;
    player_name: string;
    player_team: string;
    player_position: string;
    player_salary: number;
    unit: string;
    unit_multiplier: number;
    raw_fantasy_points?: number;
    weighted_points?: number;
  }[];
  live_score: number;
  rank: number;
  prize_amount: number;
  user_points?: number;
}

interface EntriesAggregatorProps {
  poolId: string;
  poolStatus: 'live' | 'completed' | 'scheduled';
  slateDate?: string;
}

function PlayerAvatar({ player }: { player: { nba_player_id: number; player_name: string } }) {
  const [imageError, setImageError] = useState(false);
  
  const imageUrl = player?.nba_player_id && !imageError
    ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`
    : undefined;

  return (
    <Avatar 
      size="sm" 
      src={imageUrl}
      sx={{ 
        bgcolor: imageError || !imageUrl ? 'primary.500' : 'transparent',
        width: 40,
        height: 40,
        '& img': {
          objectFit: 'cover'
        }
      }}
      onError={() => setImageError(true)}
    >
      {(!imageUrl || imageError) && player?.player_name?.charAt(0)}
    </Avatar>
  );
}

export default function EntriesAggregator({ poolId, poolStatus, slateDate }: EntriesAggregatorProps) {
  const { user } = useAuth();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  // Fetch leaderboard entries
  const { data: leaderboard, isLoading: leaderboardLoading, refetch } = useQuery<LeaderboardEntry[]>({
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
            display_name,
            username
          )
        `)
        .eq('pool_id', poolId)
        .eq('is_submitted', true);

      if (entriesError) throw entriesError;

      // Create profile map
      const profileMap = new Map<string, string>();
      (entries || []).forEach((entry: any) => {
        const displayName = entry.profiles?.display_name || entry.profiles?.username || 'Anonymous';
        profileMap.set(entry.user_id, displayName);
      });

      // Fetch user points for all users
      const userIds = [...new Set((entries || []).map((e: any) => e.user_id))];
      const { data: userPointsData } = await supabase
        .from('dfs_user_points')
        .select('user_id, total_points')
        .in('user_id', userIds);

      const pointsMap = new Map<string, number>();
      (userPointsData || []).forEach((up: any) => {
        pointsMap.set(up.user_id, up.total_points || 0);
      });

      // Get lineup for each entry and calculate scores
      const entriesWithScores = await Promise.all(
        (entries || []).map(async (entry: any) => {
          const { data: lineup } = await supabase
            .from('dfs_lineups')
            .select('id')
            .eq('entry_id', entry.id)
            .maybeSingle();

          if (!lineup) {
            return {
              entry_id: entry.id,
              user_id: entry.user_id,
              user_name: profileMap.get(entry.user_id) || 'Anonymous',
              lineup: [],
              live_score: 0,
              rank: 0,
              prize_amount: 0,
              user_points: pointsMap.get(entry.user_id) || 0,
            };
          }

          const { data: positions } = await supabase
            .from('dfs_lineup_positions')
            .select('player_id, nba_player_id, player_name, player_team, player_position, player_salary, unit, unit_position, unit_multiplier, raw_fantasy_points, weighted_points')
            .eq('lineup_id', lineup.id);

          // Use server-side calculated points from database
          // For live pools, the server should update these via update_lineup_position_scores()
          // For completed pools, use final_score from entry
          let totalScore = 0;
          
          if (poolStatus === 'completed') {
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
            user_name: profileMap.get(entry.user_id) || 'Anonymous',
            lineup: (positions || []).map(p => ({
              ...p,
              unit: p.unit || 'starters',
              unit_multiplier: p.unit_multiplier || 1,
              raw_fantasy_points: p.raw_fantasy_points ?? null,
              weighted_points: p.weighted_points ?? null,
            })),
            live_score: totalScore,
            rank: 0,
            prize_amount: 0,
            user_points: pointsMap.get(entry.user_id) || 0,
          };
        })
      );

      const sorted = entriesWithScores.sort((a, b) => b.live_score - a.live_score);
      sorted.forEach((entry, index) => {
        entry.rank = index + 1;
        if (!entry.user_name || entry.user_name === 'Anonymous') {
          entry.user_name = `Player ${index + 1}`;
        }
      });

      return sorted;
    },
    enabled: !!poolId && (poolStatus === 'live' || poolStatus === 'completed'),
    refetchInterval: poolStatus === 'live' ? 30000 : false,
  });

  // Filter entries based on selected tab
  const allEntries = leaderboard || [];
  const myEntries = user ? allEntries.filter(e => e.user_id === user.id) : [];
  const topEntries = allEntries.slice(0, 10);

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

  const handleTabSelect = (index: number) => {
    setSelectedTabIndex(index);
  };

  const renderEntriesTable = (entries: LeaderboardEntry[]) => {
    if (leaderboardLoading) {
      return (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <LinearProgress sx={{ width: '100%' }} />
          <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
            Loading entries...
          </Typography>
        </Box>
      );
    }

    if (entries.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography level="body-md" sx={{ color: '#FFFFFF' }}>
            No entries found
          </Typography>
        </Box>
      );
    }

    return (
      <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', bgcolor: '#000000', borderColor: '#333333' }}>
        <Table sx={{ 
          bgcolor: '#000000',
          '& thead th': {
            bgcolor: '#1a1a1a',
            color: '#FFFFFF',
            fontWeight: 600,
            borderBottom: '1px solid #333333',
          },
          '& tbody td': {
            color: '#FFFFFF',
            borderBottom: '1px solid #333333',
          },
          '& tbody tr:hover': {
            bgcolor: '#1a1a1a',
          },
        }}>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Rank</th>
              <th>Player</th>
              <th style={{ width: '150px', textAlign: 'right' }}>
                {poolStatus === 'live' ? 'Live Score' : 'Final Score'}
              </th>
              <th style={{ width: '100px', textAlign: 'right' }}>Points</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Prize</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
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
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar size="sm" sx={{ width: 32, height: 32 }}>
                      {entry.user_name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 500 }}>
                      {entry.user_name}
                    </Typography>
                  </Stack>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Typography 
                    level="title-md" 
                    sx={{ 
                      fontWeight: 'bold',
                      color: poolStatus === 'live' ? '#ef4444' : '#10b981'
                    }}
                  >
                    {entry.live_score.toFixed(2)}
                  </Typography>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 500 }}>
                    {entry.user_points || 0}
                  </Typography>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Typography level="body-sm" sx={{ color: '#10b981', fontWeight: 500 }}>
                    {entry.prize_amount > 0 ? `$${entry.prize_amount.toFixed(2)}` : '-'}
                  </Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sheet>
    );
  };

  return (
    <Box sx={{ bgcolor: '#000000', borderRadius: 'sm', p: 2 }}>
      <Tabs
        value={selectedTabIndex}
        onChange={(_, value) => handleTabSelect(value as number)}
      >
        {/* Tab List */}
        <TabList 
          sx={{ 
            mb: 3,
            '& button': {
              color: 'rgba(255, 255, 255, 0.7)',
              '&.Mui-selected': {
                color: '#FFD700',
              },
            },
          }}
        >
          <Tab>
            <Leaderboard sx={{ mr: 1, fontSize: 20 }} />
            <span style={{ fontFamily: 'serif', fontWeight: 600 }}>
              All Entries ({allEntries.length})
            </span>
          </Tab>
          {user && (
            <Tab>
              <Person sx={{ mr: 1, fontSize: 20 }} />
              <span style={{ fontFamily: 'serif', fontWeight: 600 }}>
                My Entries ({myEntries.length})
              </span>
            </Tab>
          )}
          <Tab>
            <TrendingUp sx={{ mr: 1, fontSize: 20 }} />
            <span style={{ fontFamily: 'serif', fontWeight: 600 }}>
              Top 10
            </span>
          </Tab>
        </TabList>

        {/* All Entries Tab */}
        <TabPanel value={0}>
          {renderEntriesTable(allEntries)}
        </TabPanel>

        {/* My Entries Tab */}
        {user && (
          <TabPanel value={1}>
            {renderEntriesTable(myEntries)}
          </TabPanel>
        )}

        {/* Top 10 Tab */}
        <TabPanel value={user ? 2 : 1}>
          {renderEntriesTable(topEntries)}
        </TabPanel>
      </Tabs>
    </Box>
  );
}

