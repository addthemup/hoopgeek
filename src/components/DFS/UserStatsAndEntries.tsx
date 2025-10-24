import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Grid,
  Stack,
  Chip,
  Avatar,
  Sheet,
  Button,
} from '@mui/joy';
import { useNavigate } from 'react-router-dom';
import { useDFSUserStats } from '../../hooks/useDFSUserStats';
import { useDFSUserEntries } from '../../hooks/useDFSUserEntries';
import { formatSalary } from '../../hooks/useDFSLineupSalary';
import PoolDetailsModal from './PoolDetailsModal';

// Component to handle player avatar with NBA headshots
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

interface UserStatsAndEntriesProps {
  userId: string;
}

export default function UserStatsAndEntries({ userId }: UserStatsAndEntriesProps) {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { data: stats, isLoading: statsLoading } = useDFSUserStats(userId);
  const { data: entries, isLoading: entriesLoading } = useDFSUserEntries(userId);

  // Filter entries by pool status
  // The Cloudflare Worker automatically updates pool status:
  // - scheduled → live (when first game starts)
  // - live → completed (when all games finish)
  // - completed pools get finalized_at timestamp set
  
  // PAST: Completed/finalized pools
  const pastEntries = entries?.filter(entry => 
    entry.pool_status === 'completed' || entry.pool_status === 'finalized'
  ) || [];

  // LIVE: Games currently in progress
  const liveEntries = entries?.filter(entry => 
    entry.pool_status === 'live'
  ) || [];

  // UPCOMING: Scheduled pools (not started yet)
  const upcomingEntries = entries?.filter(entry => 
    entry.pool_status === 'scheduled'
  ) || [];

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'danger';
      case 'completed': return 'success';
      case 'scheduled': return 'primary';
      default: return 'neutral';
    }
  };

  return (
    <Card>
      <CardContent>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as number)}>
          <TabList>
            <Tab>🎯 Upcoming</Tab>
            <Tab>🔴 Live</Tab>
            <Tab>📜 Past</Tab>
            <Tab>📊 Stats</Tab>
          </TabList>

          {/* Upcoming Entries Tab */}
          <TabPanel value={0} sx={{ p: 0 }}>
            {entriesLoading ? (
              <Box sx={{ p: 2 }}>
                <Typography level="body-sm" color="neutral">Loading entries...</Typography>
              </Box>
            ) : upcomingEntries && upcomingEntries.length > 0 ? (
              <Stack spacing={2} sx={{ maxHeight: '600px', overflow: 'auto', p: 2 }}>
                {upcomingEntries.map((entry) => (
                  <Sheet
                    key={entry.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 'sm',
                      '&:hover': { bgcolor: 'background.level1' },
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedPoolId(entry.pool_id);
                      setSelectedEntryId(entry.id);
                    }}
                  >
                    {/* Pool Info Header */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Box>
                        <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                          {entry.pool_name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {new Date(entry.slate_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          size="sm" 
                          variant="soft" 
                          color={getDifficultyColor(entry.difficulty_tier)}
                        >
                          {getDifficultyName(entry.difficulty_tier)}
                        </Chip>
                        <Chip 
                          size="sm" 
                          variant="solid" 
                          color={getStatusColor(entry.pool_status)}
                        >
                          {entry.pool_status}
                        </Chip>
                      </Stack>
                    </Stack>

                    {/* Entry Stats */}
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Entry Fee</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          ${entry.entry_fee}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Salary Used</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {formatSalary(entry.total_salary)}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Points</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {entry.final_points || '-'}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Rank</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {entry.final_rank ? `#${entry.final_rank}` : '-'}
                        </Typography>
                      </Grid>
                    </Grid>

                    {/* Player Avatars */}
                    {entry.lineup && entry.lineup.length > 0 ? (
                      <Box>
                        <Typography level="body-xs" color="neutral" sx={{ mb: 1 }}>
                          Lineup ({entry.lineup.length} players)
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                          {entry.lineup
                            .sort((a, b) => {
                              // Sort by unit, then position
                              const unitOrder = { starters: 0, rotation: 1, bench: 2 };
                              if (a.unit !== b.unit) {
                                return unitOrder[a.unit as keyof typeof unitOrder] - unitOrder[b.unit as keyof typeof unitOrder];
                              }
                              return a.unit_position - b.unit_position;
                            })
                            .map((player, idx) => (
                              <Box
                                key={`${player.player_id}-${idx}`}
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'relative',
                                    border: player.unit === 'starters' ? '2px solid' : 'none',
                                    borderColor: 'success.500',
                                    borderRadius: '50%',
                                    p: player.unit === 'starters' ? '2px' : 0,
                                  }}
                                >
                                  <PlayerAvatar 
                                    player={{
                                      nba_player_id: player.nba_player_id,
                                      player_name: player.player_name
                                    }}
                                  />
                                </Box>
                                <Typography 
                                  level="body-xs" 
                                  sx={{ 
                                    fontSize: '0.65rem',
                                    maxWidth: 50,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    textAlign: 'center',
                                  }}
                                >
                                  {player.player_name.split(' ').pop()}
                                </Typography>
                              </Box>
                            ))}
                        </Stack>
                      </Box>
                    ) : entry.is_submitted ? (
                      <Typography level="body-xs" color="neutral" sx={{ fontStyle: 'italic' }}>
                        Lineup submitted (no details available)
                      </Typography>
                    ) : (
                      <Button size="sm" variant="soft" color="primary">
                        Complete Lineup
                      </Button>
                    )}

                    {/* Prize Won */}
                    {entry.prize_won && entry.prize_won > 0 && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'success.50', borderRadius: 'sm' }}>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.700' }}>
                          🏆 Won ${entry.prize_won.toFixed(2)}!
                        </Typography>
                      </Box>
                    )}
                  </Sheet>
                ))}
              </Stack>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
                  No upcoming entries
                </Typography>
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={() => navigate('/dfs')}
                >
                  Enter a Contest
                </Button>
              </Box>
            )}
          </TabPanel>

          {/* Live Entries Tab */}
          <TabPanel value={1} sx={{ p: 0 }}>
            {entriesLoading ? (
              <Box sx={{ p: 2 }}>
                <Typography level="body-sm" color="neutral">Loading entries...</Typography>
              </Box>
            ) : liveEntries && liveEntries.length > 0 ? (
              <Stack spacing={2} sx={{ maxHeight: '600px', overflow: 'auto', p: 2 }}>
                {liveEntries.map((entry) => (
                  <Sheet
                    key={entry.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 'sm',
                      '&:hover': { bgcolor: 'background.level1' },
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: 'danger.500',
                      position: 'relative',
                    }}
                    onClick={() => {
                      setSelectedPoolId(entry.pool_id);
                      setSelectedEntryId(entry.id);
                    }}
                  >
                    {/* LIVE Badge */}
                    <Chip
                      size="sm"
                      color="danger"
                      variant="solid"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        animation: 'pulse 2s ease-in-out infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.7 },
                        },
                      }}
                    >
                      🔴 LIVE
                    </Chip>

                    {/* Pool Info Header */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Box>
                        <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                          {entry.pool_name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {new Date(entry.slate_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Typography>
                      </Box>
                      <Chip 
                        size="sm" 
                        variant="soft" 
                        color={getDifficultyColor(entry.difficulty_tier)}
                      >
                        {getDifficultyName(entry.difficulty_tier)}
                      </Chip>
                    </Stack>

                    {/* Entry Stats */}
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Entry Fee</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          ${entry.entry_fee}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Live Points</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.600' }}>
                          {entry.final_points || '0.0'}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Current Rank</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {entry.final_rank ? `#${entry.final_rank}` : '-'}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Salary Used</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {formatSalary(entry.total_salary)}
                        </Typography>
                      </Grid>
                    </Grid>

                    {/* Player Avatars */}
                    {entry.lineup && entry.lineup.length > 0 ? (
                      <Box>
                        <Typography level="body-xs" color="neutral" sx={{ mb: 1 }}>
                          Lineup ({entry.lineup.length} players)
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                          {entry.lineup
                            .sort((a, b) => {
                              const unitOrder = { starters: 0, rotation: 1, bench: 2 };
                              if (a.unit !== b.unit) {
                                return unitOrder[a.unit as keyof typeof unitOrder] - unitOrder[b.unit as keyof typeof unitOrder];
                              }
                              return a.unit_position - b.unit_position;
                            })
                            .map((player, idx) => (
                              <Box
                                key={`${player.player_id}-${idx}`}
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'relative',
                                    border: player.unit === 'starters' ? '2px solid' : 'none',
                                    borderColor: 'danger.500',
                                    borderRadius: '50%',
                                    p: player.unit === 'starters' ? '2px' : 0,
                                  }}
                                >
                                  <PlayerAvatar 
                                    player={{
                                      nba_player_id: player.nba_player_id,
                                      player_name: player.player_name
                                    }}
                                  />
                                </Box>
                                <Typography 
                                  level="body-xs" 
                                  sx={{ 
                                    fontSize: '0.65rem',
                                    maxWidth: 50,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    textAlign: 'center',
                                  }}
                                >
                                  {player.player_name.split(' ').pop()}
                                </Typography>
                              </Box>
                            ))}
                        </Stack>
                      </Box>
                    ) : (
                      <Typography level="body-xs" color="neutral" sx={{ fontStyle: 'italic' }}>
                        Lineup locked
                      </Typography>
                    )}

                    {/* Click to view leaderboard */}
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: 'danger.50', borderRadius: 'sm', textAlign: 'center' }}>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.700' }}>
                        👉 Click to view live leaderboard
                      </Typography>
                    </Box>
                  </Sheet>
                ))}
              </Stack>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
                  No live entries right now
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Your active contests will appear here when games start
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Past Entries Tab */}
          <TabPanel value={2} sx={{ p: 0 }}>
            {entriesLoading ? (
              <Box sx={{ p: 2 }}>
                <Typography level="body-sm" color="neutral">Loading entries...</Typography>
              </Box>
            ) : pastEntries && pastEntries.length > 0 ? (
              <Stack spacing={2} sx={{ maxHeight: '600px', overflow: 'auto', p: 2 }}>
                {pastEntries.map((entry) => (
                  <Sheet
                    key={entry.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 'sm',
                      '&:hover': { bgcolor: 'background.level1' },
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedPoolId(entry.pool_id);
                      setSelectedEntryId(entry.id);
                    }}
                  >
                    {/* Pool Info Header */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Box>
                        <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                          {entry.pool_name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {new Date(entry.slate_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          size="sm" 
                          variant="soft" 
                          color={getDifficultyColor(entry.difficulty_tier)}
                        >
                          {getDifficultyName(entry.difficulty_tier)}
                        </Chip>
                        <Chip 
                          size="sm" 
                          variant="solid" 
                          color={getStatusColor(entry.pool_status)}
                        >
                          {entry.pool_status}
                        </Chip>
                      </Stack>
                    </Stack>

                    {/* Entry Stats */}
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Entry Fee</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          ${entry.entry_fee}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Salary Used</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {formatSalary(entry.total_salary)}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Points</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {entry.final_points || '-'}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Rank</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {entry.final_rank ? `#${entry.final_rank}` : '-'}
                        </Typography>
                      </Grid>
                    </Grid>

                    {/* Player Avatars */}
                    {entry.lineup && entry.lineup.length > 0 ? (
                      <Box>
                        <Typography level="body-xs" color="neutral" sx={{ mb: 1 }}>
                          Lineup ({entry.lineup.length} players)
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                          {entry.lineup
                            .sort((a, b) => {
                              // Sort by unit, then position
                              const unitOrder = { starters: 0, rotation: 1, bench: 2 };
                              if (a.unit !== b.unit) {
                                return unitOrder[a.unit as keyof typeof unitOrder] - unitOrder[b.unit as keyof typeof unitOrder];
                              }
                              return a.unit_position - b.unit_position;
                            })
                            .map((player, idx) => (
                              <Box
                                key={`${player.player_id}-${idx}`}
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'relative',
                                    border: player.unit === 'starters' ? '2px solid' : 'none',
                                    borderColor: 'success.500',
                                    borderRadius: '50%',
                                    p: player.unit === 'starters' ? '2px' : 0,
                                  }}
                                >
                                  <PlayerAvatar 
                                    player={{
                                      nba_player_id: player.nba_player_id,
                                      player_name: player.player_name
                                    }}
                                  />
                                </Box>
                                <Typography 
                                  level="body-xs" 
                                  sx={{ 
                                    fontSize: '0.65rem',
                                    maxWidth: 50,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    textAlign: 'center',
                                  }}
                                >
                                  {player.player_name.split(' ').pop()}
                                </Typography>
                              </Box>
                            ))}
                        </Stack>
                      </Box>
                    ) : entry.is_submitted ? (
                      <Typography level="body-xs" color="neutral" sx={{ fontStyle: 'italic' }}>
                        Lineup submitted (no details available)
                      </Typography>
                    ) : (
                      <Button size="sm" variant="soft" color="primary">
                        Complete Lineup
                      </Button>
                    )}

                    {/* Prize Won */}
                    {entry.prize_won && entry.prize_won > 0 && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'success.50', borderRadius: 'sm' }}>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.700' }}>
                          🏆 Won ${entry.prize_won.toFixed(2)}!
                        </Typography>
                      </Box>
                    )}
                  </Sheet>
                ))}
              </Stack>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
                  No past entries yet
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Your completed contests will appear here
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* Stats Tab */}
          <TabPanel value={3} sx={{ p: 2 }}>
            {statsLoading ? (
              <Typography level="body-sm" color="neutral">Loading stats...</Typography>
            ) : stats ? (
              <Stack spacing={2}>
                <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 'sm' }}>
                  <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>
                    Total Winnings
                  </Typography>
                  <Typography level="h2" sx={{ fontWeight: 'bold', color: 'primary.600' }}>
                    ${stats.totalWinnings.toFixed(2)}
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid xs={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'success.50', borderRadius: 'sm' }}>
                      <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>
                        Contests Won
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 'bold', color: 'success.600' }}>
                        {stats.contestsWon}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'warning.50', borderRadius: 'sm' }}>
                      <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>
                        Active Lineups
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.600' }}>
                        {stats.activeLineups}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                      <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>
                        Total Contests
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                        {stats.contestsEntered}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                      <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>
                        Win Rate
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                        {stats.winRate.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Stack>
            ) : (
              <Typography level="body-sm" color="neutral">No stats available</Typography>
            )}
          </TabPanel>
        </Tabs>
      </CardContent>

      {/* Pool Details Modal */}
      {selectedPoolId && (
        <PoolDetailsModal
          poolId={selectedPoolId}
          open={!!selectedPoolId}
          onClose={() => {
            setSelectedPoolId(null);
            setSelectedEntryId(null);
          }}
          initialView="entry"
          entryId={selectedEntryId}
        />
      )}
    </Card>
  );
}

