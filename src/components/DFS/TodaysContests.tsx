import React, { useState } from 'react';
import {
  Box,
  Typography,
  Sheet,
  Table,
  Chip,
  Button,
  LinearProgress,
  Tooltip,
  IconButton,
} from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { format } from 'date-fns';
import {
  EmojiEvents,
  People,
  AttachMoney,
  AccessTime,
  InfoOutlined,
  Share,
} from '@mui/icons-material';
import PoolDetailsModal from './PoolDetailsModal';

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

export default function TodaysContests() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [copiedPoolId, setCopiedPoolId] = useState<string | null>(null);

  const handleShare = (poolId: string) => {
    const shareUrl = `${window.location.origin}/dfs/join/${poolId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedPoolId(poolId);
      setTimeout(() => setCopiedPoolId(null), 2000);
    });
  };

  // Fetch today's contests
  const { data: contests, isLoading } = useQuery<DFSContest[]>({
    queryKey: ['dfs-todays-contests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_todays_contests')
        .select('*')
        .order('lock_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getDifficultyColor = (tier: string) => {
    switch (tier) {
      case 'elite': return 'danger';
      case 'pro': return 'warning';
      case 'standard': return 'success';
      default: return 'neutral';
    }
  };

  const getDifficultyName = (tier: string) => {
    switch (tier) {
      case 'elite': return 'Standard';
      case 'pro': return 'Apron 1';
      case 'standard': return 'Apron 2';
      default: return tier;
    }
  };

  const formatSalaryCap = (cap: number) => {
    return `$${(cap / 1000000).toFixed(1)}M`;
  };

  const formatTimeUntilLock = (seconds: number) => {
    if (seconds <= 0) return 'Locked';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const filteredContests = selectedDifficulty
    ? contests?.filter(c => c.difficulty_tier === selectedDifficulty)
    : contests;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography level="h2" sx={{ mb: 0.5 }}>
            Today's Contests
          </Typography>
          <Typography level="body-sm" color="neutral">
            {contests?.length || 0} contests available
          </Typography>
        </Box>

        {/* Difficulty Filter */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="sm"
            variant={selectedDifficulty === null ? 'solid' : 'outlined'}
            onClick={() => setSelectedDifficulty(null)}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={selectedDifficulty === 'elite' ? 'solid' : 'outlined'}
            color="danger"
            onClick={() => setSelectedDifficulty('elite')}
          >
            Standard
          </Button>
          <Button
            size="sm"
            variant={selectedDifficulty === 'pro' ? 'solid' : 'outlined'}
            color="warning"
            onClick={() => setSelectedDifficulty('pro')}
          >
            Apron 1
          </Button>
          <Button
            size="sm"
            variant={selectedDifficulty === 'standard' ? 'solid' : 'outlined'}
            color="success"
            onClick={() => setSelectedDifficulty('standard')}
          >
            Apron 2
          </Button>
        </Box>
      </Box>

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <LinearProgress />
          <Typography level="body-sm" sx={{ mt: 2 }}>
            Loading contests...
          </Typography>
        </Box>
      )}

      {/* No Contests */}
      {!isLoading && filteredContests?.length === 0 && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography level="body-md" color="neutral">
            No contests available right now
          </Typography>
          <Typography level="body-sm" color="neutral">
            Check back later for upcoming contests
          </Typography>
        </Box>
      )}

      {/* Contests Table */}
      {!isLoading && filteredContests && filteredContests.length > 0 && (
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: 'sm',
            overflow: 'hidden',
          }}
        >
          <Table
            sx={{
              '& thead th': {
                bgcolor: 'background.level1',
                fontWeight: 'bold',
              },
            }}
          >
            <thead>
              <tr>
                <th style={{ width: '33%' }}>Contest</th>
                <th style={{ width: '11%' }}>Entry Fee</th>
                <th style={{ width: '11%' }}>Prize Pool</th>
                <th style={{ width: '14%' }}>Entries</th>
                <th style={{ width: '10%' }}>Games</th>
                <th style={{ width: '11%' }}>Locks In</th>
                <th style={{ width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContests.map((contest) => (
                <tr key={contest.pool_id}>
                  {/* Contest Name */}
                  <td>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {contest.is_featured && (
                          <Chip size="sm" color="primary" variant="soft">
                            Featured
                          </Chip>
                        )}
                        {contest.is_guaranteed && (
                          <Chip size="sm" color="success" variant="soft">
                            Guaranteed
                          </Chip>
                        )}
                        <Chip
                          size="sm"
                          color={getDifficultyColor(contest.difficulty_tier)}
                          variant="soft"
                        >
                          {getDifficultyName(contest.difficulty_tier)}
                        </Chip>
                      </Box>
                      <Typography 
                        level="title-md" 
                        sx={{ 
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          '&:hover': {
                            color: 'primary.500',
                            textDecoration: 'underline'
                          }
                        }}
                        onClick={() => setSelectedPoolId(contest.pool_id)}
                      >
                        {contest.name}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        {contest.slate_name} • {formatSalaryCap(contest.salary_cap)} cap
                      </Typography>
                    </Box>
                  </td>

                  {/* Entry Fee */}
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AttachMoney sx={{ fontSize: 16, color: 'success.500' }} />
                      <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                        ${contest.entry_fee.toFixed(2)}
                      </Typography>
                    </Box>
                  </td>

                  {/* Prize Pool */}
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmojiEvents sx={{ fontSize: 16, color: 'warning.500' }} />
                      <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                        ${contest.prize_pool.toLocaleString()}
                      </Typography>
                    </Box>
                  </td>

                  {/* Entries Progress */}
                  <td>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <People sx={{ fontSize: 16 }} />
                        <Typography level="body-sm">
                          {contest.current_entries} / {contest.max_entries}
                        </Typography>
                      </Box>
                      <LinearProgress
                        determinate
                        value={contest.fill_percentage}
                        sx={{
                          '--LinearProgress-thickness': '6px',
                        }}
                        color={
                          contest.fill_percentage >= 80 ? 'success' :
                          contest.fill_percentage >= 50 ? 'warning' : 'neutral'
                        }
                      />
                      <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                        {contest.fill_percentage}% full
                      </Typography>
                    </Box>
                  </td>

                  {/* Games Count */}
                  <td>
                    <Tooltip
                      title={
                        <Box>
                          {contest.games?.map((game) => (
                            <Typography key={game.game_id} level="body-xs">
                              {game.away_team} @ {game.home_team}
                            </Typography>
                          ))}
                        </Box>
                      }
                      placement="top"
                    >
                      <Chip size="sm" variant="outlined">
                        {contest.games_count} games
                      </Chip>
                    </Tooltip>
                  </td>

                  {/* Time Until Lock */}
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTime sx={{ fontSize: 16, color: 'warning.500' }} />
                      <Typography
                        level="body-sm"
                        sx={{ fontWeight: 'bold' }}
                        color={contest.seconds_until_lock < 3600 ? 'danger' : 'neutral'}
                      >
                        {formatTimeUntilLock(contest.seconds_until_lock)}
                      </Typography>
                    </Box>
                  </td>

                  {/* Actions */}
                  <td>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title={copiedPoolId === contest.pool_id ? "Link copied!" : "Share contest"}>
                        <IconButton 
                          size="sm" 
                          variant="outlined"
                          color={copiedPoolId === contest.pool_id ? "success" : "neutral"}
                          onClick={() => handleShare(contest.pool_id)}
                        >
                          <Share />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Contest details">
                        <IconButton 
                          size="sm" 
                          variant="outlined"
                          onClick={() => setSelectedPoolId(contest.pool_id)}
                        >
                          <InfoOutlined />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Sheet>
      )}

      {/* Pool Details Modal */}
      <PoolDetailsModal
        poolId={selectedPoolId}
        open={!!selectedPoolId}
        onClose={() => setSelectedPoolId(null)}
      />
    </Box>
  );
}

