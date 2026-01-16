import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
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
import { supabase } from '../../utils/supabase';


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
  const [liveScores, setLiveScores] = useState<Map<string, { score: number; rank: number }>>(new Map());
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

  // Calculate live scores and ranks
  useEffect(() => {
    if (!liveEntries || liveEntries.length === 0) return;

    const calculateLiveScores = async () => {
      const scoresMap = new Map<string, { score: number; rank: number }>();

      // Group entries by pool_id to calculate ranks
      const entriesByPool = new Map<string, typeof liveEntries>();
      liveEntries.forEach(entry => {
        if (!entriesByPool.has(entry.pool_id)) {
          entriesByPool.set(entry.pool_id, []);
        }
        entriesByPool.get(entry.pool_id)!.push(entry);
      });

      // Process each pool
      for (const [poolId, poolEntries] of entriesByPool.entries()) {
        // Fetch pool games
        const { data: poolGames } = await supabase
          .from('dfs_pool_games')
          .select('game_id')
          .eq('pool_id', poolId);
        
        const gameIds = poolGames?.map(g => g.game_id) || [];
        if (gameIds.length === 0) continue;

        // Fetch ALL entries for this pool to calculate ranks
        const { data: allPoolEntries } = await supabase
          .from('dfs_entries')
          .select('id, user_id')
          .eq('pool_id', poolId)
          .eq('is_submitted', true);

        const allScores: Array<{ entryId: string; score: number }> = [];

        // Calculate scores for all entries using server-side calculated points
        for (const entry of allPoolEntries || []) {
          const { data: lineup } = await supabase
            .from('dfs_lineups')
            .select(`
              id,
              dfs_lineup_positions (
                player_id,
                nba_player_id,
                player_name,
                unit,
                unit_multiplier,
                weighted_points
              )
            `)
            .eq('entry_id', entry.id)
            .maybeSingle();

          const positions = lineup?.dfs_lineup_positions || [];
          // Use server-side calculated weighted_points from database
          const totalScore = (positions || []).reduce((sum: number, p: any) => {
            return sum + (p.weighted_points || 0);
          }, 0);

          allScores.push({ entryId: entry.id, score: totalScore });
        }

        // Sort by score and assign ranks
        allScores.sort((a, b) => b.score - a.score);
        allScores.forEach((entry, index) => {
          scoresMap.set(entry.entryId, {
            score: entry.score,
            rank: index + 1,
          });
        });
      }

      setLiveScores(scoresMap);
    };

    calculateLiveScores();

    // Refresh every 30 seconds
    const interval = setInterval(calculateLiveScores, 30000);
    return () => clearInterval(interval);
  }, [liveEntries]);

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
    <Stack spacing={4}>
      {/* Section Header */}
      <Box
        sx={{
          borderLeft: '4px solid #FFC72C',
          pl: 2,
          py: 0.5,
        }}
      >
        <Typography
          level="h2"
          sx={{
            fontFamily: 'serif',
            fontWeight: 900,
            fontSize: { xs: '1.5rem', md: '2rem' },
            textTransform: 'uppercase',
            color: 'text.primary',
            letterSpacing: '0.05em',
          }}
        >
          YOUR ACTIVE ENTRIES
        </Typography>
      </Box>

      {/* Upcoming & Live Entries Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        {/* Upcoming Entries */}
        <Card
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.4)',
            border: '3px solid',
            borderColor: 'text.primary',
            borderRadius: 0,
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#FFC72C',
                }}
              />
              <Typography
                level="h4"
                sx={{
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  textTransform: 'uppercase',
                  color: 'text.primary',
                  letterSpacing: '0.05em',
                }}
              >
                UPCOMING ENTRIES
              </Typography>
            </Box>
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
                      navigate(`/dfs/pool/${entry.pool_id}?view=entry&entryId=${entry.id}`);
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
          </CardContent>
        </Card>

        {/* Live Entries */}
        <Card
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.4)',
            border: '3px solid',
            borderColor: 'text.primary',
            borderRadius: 0,
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#ef4444',
                  animation: 'pulse-dot 2s ease-in-out infinite',
                  '@keyframes pulse-dot': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
              <Typography
                level="h4"
                sx={{
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  textTransform: 'uppercase',
                  color: 'text.primary',
                  letterSpacing: '0.05em',
                }}
              >
                LIVE ENTRIES
              </Typography>
            </Box>
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
                      navigate(`/dfs/pool/${entry.pool_id}?view=entry&entryId=${entry.id}`);
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
                          {liveScores.get(entry.id)?.score.toFixed(1) || '0.0'}
                        </Typography>
                      </Grid>
                      <Grid xs={3}>
                        <Typography level="body-xs" color="neutral">Current Rank</Typography>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {liveScores.get(entry.id)?.rank ? `#${liveScores.get(entry.id)?.rank}` : '-'}
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
          </CardContent>
        </Card>
      </Box>

      {/* Past Entries - Full Width */}
      <Card
        sx={{
          bgcolor: 'rgba(0, 0, 0, 0.4)',
          border: '3px solid',
          borderColor: 'text.primary',
          borderRadius: 0,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'text.secondary',
              }}
            />
            <Typography
              level="h4"
              sx={{
                fontFamily: 'serif',
                fontWeight: 900,
                fontSize: { xs: '1rem', md: '1.1rem' },
                textTransform: 'uppercase',
                color: 'text.primary',
                letterSpacing: '0.05em',
              }}
            >
              PAST ENTRIES
            </Typography>
          </Box>
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
                      navigate(`/dfs/pool/${entry.pool_id}?view=entry&entryId=${entry.id}`);
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
          </CardContent>
        </Card>

      {/* User Stats - Full Width */}
      <Card
        sx={{
          bgcolor: 'rgba(0, 0, 0, 0.4)',
          border: '3px solid',
          borderColor: 'text.primary',
          borderRadius: 0,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#10b981',
              }}
            />
            <Typography
              level="h4"
              sx={{
                fontFamily: 'serif',
                fontWeight: 900,
                fontSize: { xs: '1rem', md: '1.1rem' },
                textTransform: 'uppercase',
                color: 'text.primary',
                letterSpacing: '0.05em',
              }}
            >
              YOUR STATS
            </Typography>
          </Box>
            {statsLoading ? (
              <Typography level="body-sm" color="neutral">Loading stats...</Typography>
            ) : stats ? (
              <Stack spacing={2}>
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'rgba(255, 199, 44, 0.1)',
                    border: '2px solid rgba(255, 199, 44, 0.3)',
                    borderRadius: 0,
                  }}
                >
                  <Typography level="body-xs" sx={{ mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', fontFamily: 'serif', fontWeight: 700 }}>
                    Total Winnings
                  </Typography>
                  <Typography level="h2" sx={{ fontWeight: 900, color: '#FFC72C', fontFamily: 'serif' }}>
                    ${stats.totalWinnings.toFixed(2)}
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid xs={6}>
                    <Box 
                      sx={{ 
                        p: 1.5, 
                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                        border: '2px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 0,
                      }}
                    >
                      <Typography level="body-xs" sx={{ mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', fontFamily: 'serif', fontWeight: 700 }}>
                        Contests Won
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 900, color: '#10b981', fontFamily: 'serif' }}>
                        {stats.contestsWon}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box 
                      sx={{ 
                        p: 1.5, 
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                        border: '2px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 0,
                      }}
                    >
                      <Typography level="body-xs" sx={{ mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', fontFamily: 'serif', fontWeight: 700 }}>
                        Active Lineups
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 900, color: '#ef4444', fontFamily: 'serif' }}>
                        {stats.activeLineups}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box 
                      sx={{ 
                        p: 1.5, 
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        border: '2px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: 0,
                      }}
                    >
                      <Typography level="body-xs" sx={{ mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', fontFamily: 'serif', fontWeight: 700 }}>
                        Total Contests
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 900, color: 'text.primary', fontFamily: 'serif' }}>
                        {stats.contestsEntered}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6}>
                    <Box 
                      sx={{ 
                        p: 1.5, 
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        border: '2px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: 0,
                      }}
                    >
                      <Typography level="body-xs" sx={{ mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', fontFamily: 'serif', fontWeight: 700 }}>
                        Win Rate
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 900, color: 'text.primary', fontFamily: 'serif' }}>
                        {stats.winRate.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Stack>
            ) : (
              <Typography level="body-sm" color="neutral">No stats available</Typography>
            )}
        </CardContent>
      </Card>

    </Stack>
  );
}

