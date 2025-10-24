import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  ModalDialog,
  ModalClose,
  Box,
  Typography,
  Button,
  Chip,
  Sheet,
  Table,
  Grid,
  Divider,
  Stack,
  IconButton,
  Avatar,
  LinearProgress,
  Card,
  CardContent,
} from '@mui/joy';
import { SportsSoccer, EmojiEvents, Timer, TrendingUp, Share, ArrowBack, Refresh, Edit } from '@mui/icons-material';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { calculateFantasyPoints, FANDUEL_SCORING } from '../../utils/fantasyScoring';
import DFSLineupBuilder from './DFSLineupBuilder';
import { useAuth } from '../../hooks/useAuth';

interface PoolDetailsModalProps {
  poolId: string | null;
  open: boolean;
  onClose: () => void;
  initialView?: 'details' | 'leaderboard' | 'entry';
  entryId?: string | null;
}

interface PoolDetails {
  id: string;
  name: string;
  description?: string;
  slate_name: string;
  slate_date: string;
  lock_time: string;
  entry_fee: number;
  current_entries: number;
  max_entries: number;
  prize_pool: number;
  salary_cap: number;
  difficulty_tier: string;
  status: string;
  games_count?: number;
  players_count?: number;
}

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
}

// Component to show player avatar with NBA headshots
function PlayerAvatar({ player }: { player: { nba_player_id: number; player_name: string } }) {
  const [imageError, setImageError] = useState(false);
  
  const imageUrl = player?.nba_player_id && !imageError
    ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`
    : undefined;

  return (
    <Avatar 
      size="md" 
      src={imageUrl}
      sx={{ 
        bgcolor: imageError || !imageUrl ? 'primary.500' : 'transparent',
        width: 60,
        height: 60,
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

export default function PoolDetailsModal({ poolId, open, onClose, initialView = 'details', entryId: initialEntryId = null }: PoolDetailsModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentView, setCurrentView] = useState<'details' | 'leaderboard' | 'entry' | 'lineup-builder'>(initialView);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(initialEntryId);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  console.log('🔵 PoolDetailsModal opened:', {
    poolId,
    initialView,
    entryId: initialEntryId,
    currentView,
    selectedEntryId
  });

  // Reset view when modal opens/closes
  useEffect(() => {
    if (open) {
      setCurrentView(initialView);
      setSelectedEntryId(initialEntryId);
    } else {
      setCurrentView('details');
      setSelectedEntryId(null);
    }
  }, [open, initialView, initialEntryId]);

  // Fetch pool details
  const { data: pool, isLoading: poolLoading } = useQuery<PoolDetails>({
    queryKey: ['dfs-pool-details', poolId],
    queryFn: async () => {
      if (!poolId) throw new Error('No pool ID');
      
      const { data, error } = await supabase
        .from('dfs_pools')
        .select('*')
        .eq('id', poolId)
        .single();

      if (error) throw error;

      const { count } = await supabase
        .from('dfs_entries')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', poolId);

      return {
        ...data,
        current_entries: count || 0,
      };
    },
    enabled: open && !!poolId,
  });

  // Fetch user's entries for this pool
  const { data: userEntries, refetch: refetchUserEntries } = useQuery({
    queryKey: ['dfs-user-pool-entries', poolId, user?.id],
    queryFn: async () => {
      if (!poolId || !user?.id) return [];
      
      const { data, error } = await supabase
        .from('dfs_entries')
        .select('id, is_submitted, total_salary, created_at')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!poolId && !!user?.id,
  });

  // Fetch leaderboard for live/past pools
  const { data: leaderboard, isLoading: leaderboardLoading, refetch } = useQuery<LeaderboardEntry[]>({
    queryKey: ['dfs-pool-leaderboard', poolId, pool?.status],
    queryFn: async () => {
      if (!poolId || !pool) return [];

      console.log('🔍 Fetching leaderboard for pool:', poolId, 'status:', pool.status);

      const { data: entries, error: entriesError } = await supabase
        .from('dfs_entries')
        .select('id, user_id, final_points')
        .eq('pool_id', poolId)
        .eq('is_submitted', true);

      console.log('📊 Leaderboard entries found:', entries?.length, entries);

      if (entriesError) {
        console.error('❌ Error fetching leaderboard entries:', entriesError);
        throw entriesError;
      }

      // Build profile map - use current user's data for their entry, generic names for others
      const profileMap = new Map(
        entries?.map(e => {
          let displayName: string | null = null;
          
          // For the current user, use their auth data
          if (e.user_id === user?.id) {
            displayName = user?.user_metadata?.display_name || 
                         user?.user_metadata?.username || 
                         user?.email?.split('@')[0] || 
                         'You';
          }
          
          return [e.user_id, displayName];
        }) || []
      );
      
      console.log('👥 Built profile map:', profileMap);

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
              user_name: profileMap.get(entry.user_id) || 'Anonymous',
              lineup: [],
              live_score: 0,
              rank: 0,
              prize_amount: 0,
            };
          }

          const { data: positions } = await supabase
            .from('dfs_lineup_positions')
            .select('player_id, nba_player_id, player_name, player_team, player_position, player_salary, unit, unit_position, unit_multiplier, raw_fantasy_points, weighted_points')
            .eq('lineup_id', lineup.id);

          console.log(`📝 Entry ${entry.id} lineup positions:`, positions?.length, 'players');
          if (positions && positions.length > 0) {
            console.log('   Sample player:', positions[0]);
          }

          // Get game IDs for this pool to filter live stats
          const { data: poolGames } = await supabase
            .from('dfs_pool_games')
            .select('game_id')
            .eq('pool_id', poolId);
          const gameIds = poolGames?.map(g => g.game_id) || [];

          let totalScore = 0;
          const playerScores = new Map<string, { raw: number, weighted: number }>();
          
          if (pool?.status === 'live' && gameIds.length > 0) {
            // Fetch live scores for each player, filtered by pool's games
            for (const player of positions || []) {
              const { data: liveStats } = await supabase
                .from('live_player_stats')
                .select('stats')
                .eq('nba_player_id', player.nba_player_id)
                .in('game_id', gameIds)
                .maybeSingle();

              if (liveStats?.stats) {
                const rawFantasyPoints = calculateFantasyPoints(liveStats.stats, FANDUEL_SCORING);
                const weightedPoints = rawFantasyPoints * (player.unit_multiplier || 1);
                playerScores.set(player.player_id, { raw: rawFantasyPoints, weighted: weightedPoints });
                totalScore += weightedPoints;
                console.log(`   ${player.player_name}: ${rawFantasyPoints.toFixed(1)} pts (${player.unit_multiplier}x = ${weightedPoints.toFixed(1)})`);
              }
            }
          } else if (pool?.status === 'completed') {
            totalScore = entry.final_points || 0;
            console.log(`   Using final_points from entry: ${totalScore}`);
          }

          console.log(`✅ Entry ${entry.id} total score: ${totalScore}`);

          return {
            entry_id: entry.id,
            user_id: entry.user_id,
            user_name: profileMap.get(entry.user_id) || 'Anonymous',
            lineup: (positions || []).map(p => {
              const scores = playerScores.get(p.player_id);
              return {
                ...p,
                unit: p.unit || 'starters',
                unit_multiplier: p.unit_multiplier || 1,
                raw_fantasy_points: scores?.raw ?? p.raw_fantasy_points ?? null,
                weighted_points: scores?.weighted ?? p.weighted_points ?? null,
              };
            }),
            live_score: totalScore,
            rank: 0,
            prize_amount: 0,
          };
        })
      );

      const sorted = entriesWithScores.sort((a, b) => b.live_score - a.live_score);
      sorted.forEach((entry, index) => {
        entry.rank = index + 1;
        // If user_name is still "Anonymous" or null, show rank-based name
        if (!entry.user_name || entry.user_name === 'Anonymous') {
          entry.user_name = `Player ${index + 1}`;
        }
      });

      return sorted;
    },
    enabled: open && !!poolId && !!pool && (pool.status === 'live' || pool.status === 'completed'),
    refetchInterval: autoRefresh && pool?.status === 'live' ? 30000 : false,
  });

  // Real-time subscription for live pools
  useEffect(() => {
    if (!open || !poolId || !pool || pool.status !== 'live') return;

    const channel = supabase
      .channel(`pool-${poolId}-live-stats`)
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

  const handleClose = () => {
    setCurrentView('details');
    setSelectedEntryId(null);
    onClose();
  };

  const handleShare = () => {
    if (!poolId) return;
    const shareUrl = `${window.location.origin}/dfs/join/${poolId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  // Enter Contest - ALWAYS creates a NEW entry
  const handleEnterContest = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedEntryId(null); // Always null = new entry
      setCurrentView('lineup-builder');
      setTimeout(() => setIsTransitioning(false), 300);
    }, 400);
  };

  // Edit Entry - for editing EXISTING draft entries (before pool starts)
  const handleEditEntry = (entryId: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedEntryId(entryId);
      setCurrentView('lineup-builder');
      setTimeout(() => setIsTransitioning(false), 300);
    }, 400);
  };

  // View Entry - for viewing submitted/live entries (after pool starts)
  const handleViewEntry = (entryId: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedEntryId(entryId);
      setCurrentView('entry');
      setTimeout(() => setIsTransitioning(false), 300);
    }, 400);
  };

  const handleViewLeaderboard = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentView('leaderboard');
      setTimeout(() => setIsTransitioning(false), 300);
    }, 400);
  };

  const handleBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      if (currentView === 'entry' || currentView === 'leaderboard' || currentView === 'lineup-builder') {
        setCurrentView('details');
        setSelectedEntryId(null);
      }
      setTimeout(() => setIsTransitioning(false), 300);
    }, 400);
  };

  const formatMoney = (amount: number) => {
    if (amount === 0) return '$0 (Free Pool)';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount}`;
  };

  const formatSalary = (amount: number) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const getDifficultyLabel = (tier: string) => {
    switch (tier) {
      case 'elite': return '⚡ Standard ($154.6M - Hardest)';
      case 'pro': return '💪 Apron 1 ($195.9M)';
      case 'standard': return '🔥 Apron 2 ($207.8M - Easiest)';
      default: return tier;
    }
  };

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

  // Get the selected entry for entry detail view
  // Only use leaderboard data (entries must be submitted and scored to view)
  const selectedEntry = selectedEntryId 
    ? leaderboard?.find(e => e.entry_id === selectedEntryId) || null
    : null;

  console.log('📊 Entry data:', {
    selectedEntryId,
    selectedEntry,
    leaderboard: leaderboard?.length,
    poolStatus: pool?.status,
    currentView
  });

  // Auto-switch to lineup-builder if trying to view an entry that's not in leaderboard
  // (This happens for upcoming/scheduled pools where entry isn't submitted yet)
  useEffect(() => {
    if (currentView === 'entry' && selectedEntryId && !selectedEntry && pool?.status === 'scheduled') {
      console.log('🔄 Switching to lineup-builder for upcoming entry');
      setCurrentView('lineup-builder');
    }
  }, [currentView, selectedEntryId, selectedEntry, pool?.status]);

  // Determine if we should show "View Leaderboard" button
  const shouldShowLeaderboard = pool && (pool.status === 'live' || pool.status === 'completed');

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        sx={{
          minWidth: { 
            xs: '95vw', 
            sm: 700, 
            md: currentView === 'entry' && pool?.status === 'completed' ? 1100 : 850 
          },
          maxWidth: currentView === 'entry' && pool?.status === 'completed' ? 1200 : 950,
          maxHeight: '95vh',
          overflow: 'auto',
          p: 0,
          position: 'relative',
        }}
      >
        <ModalClose />
        
        {/* Loading Overlay */}
        {isTransitioning && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'background.backdrop',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <LinearProgress 
              sx={{ 
                width: '50%',
                '--LinearProgress-radius': '8px',
                '--LinearProgress-thickness': '8px',
              }} 
            />
            <Typography level="body-sm" color="neutral">
              Loading...
            </Typography>
          </Box>
        )}
        
        {/* Back button for non-details views */}
        {currentView !== 'details' && !isTransitioning && (
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <IconButton
              size="sm"
              variant="plain"
              onClick={handleBack}
            >
              <ArrowBack />
            </IconButton>
          </Box>
        )}
        
        {/* Loading State */}
        {poolLoading ? (
          <Box sx={{ p: 4 }}>
            <LinearProgress />
            <Typography level="body-sm" sx={{ mt: 2, textAlign: 'center' }}>
              Loading pool details...
            </Typography>
          </Box>
        ) : !pool ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography level="body-md">Pool not found</Typography>
          </Box>
        ) : (
          <>
            {/* LINEUP BUILDER VIEW */}
            {currentView === 'lineup-builder' && (
              <Box sx={{ p: 3 }}>
                <DFSLineupBuilder
                  poolId={poolId || undefined}
                  entryId={selectedEntryId || undefined}
                  onSuccess={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      refetchUserEntries();
                      handleClose();
                      setIsTransitioning(false);
                    }, 400);
                  }}
                  onPlayerClick={(nbaPlayerId) => {
                    navigate(`/player/${nbaPlayerId}`);
                    handleClose();
                  }}
                />
              </Box>
            )}

            {/* ENTRY DETAIL VIEW */}
            {currentView === 'entry' && (leaderboardLoading || !selectedEntry) && (
              <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <LinearProgress sx={{ width: '100%' }} />
                <Typography level="body-sm" sx={{ textAlign: 'center' }}>
                  Loading entry details...
                </Typography>
              </Box>
            )}

            {currentView === 'entry' && selectedEntry && !leaderboardLoading && (
              <Box sx={{ p: 3 }}>
                {/* Side-by-side layout for completed pools */}
                {pool.status === 'completed' ? (
                  <Grid container spacing={2}>
                    {/* LEFT: Entry Lineup */}
                    <Grid xs={12} md={8}>
                      <Stack spacing={1.5}>
                  {/* Entry Header */}
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                    <Avatar size="sm" sx={{ width: 36, height: 36 }}>
                      {selectedEntry.user_name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography level="title-md" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                        {selectedEntry.user_name}'s Lineup
                      </Typography>
                      <Typography level="body-xs" color="neutral" sx={{ lineHeight: 1.2 }}>
                        {getRankIcon(selectedEntry.rank)} • {selectedEntry.live_score.toFixed(1)} pts
                      </Typography>
                    </Box>
                  </Stack>

                    {/* Lineup by Unit */}
                  {['starters', 'rotation', 'bench'].map((unit) => {
                    const unitPlayers = selectedEntry.lineup.filter(p => p.unit === unit);
                    if (unitPlayers.length === 0) return null;

                    const unitMultiplier = unitPlayers[0]?.unit_multiplier || 1;
                    const unitLabel = unit === 'starters' ? 'Starters' : unit === 'rotation' ? 'Rotation' : 'Bench';
                    const unitColor = unit === 'starters' ? 'success' : unit === 'rotation' ? 'warning' : 'neutral';

                    return (
                      <Box key={unit}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {unitLabel}
                          </Typography>
                          <Chip size="sm" variant="solid" color={unitColor} sx={{ minHeight: 20 }}>
                            {unitMultiplier}×
                          </Chip>
                        </Stack>
                        {/* Table layout for players - similar to TeamRoster */}
                        <Box sx={{ overflowX: 'auto' }}>
                          <Table size="sm" sx={{ '& th': { py: 0.5 }, '& td': { py: 0.75 } }}>
                            <thead>
                              <tr>
                                <th style={{ width: '200px' }}>Player</th>
                                <th style={{ width: '80px' }}>Team</th>
                                <th style={{ width: '100px' }}>Salary</th>
                                <th style={{ width: '80px', textAlign: 'right' }}>Pts</th>
                                {unitMultiplier !== 1 && (
                                  <th style={{ width: '80px', textAlign: 'right' }}>Raw</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {unitPlayers.map((player) => {
                                console.log('🎯 Player data:', {
                                  name: player.player_name,
                                  weighted: player.weighted_points,
                                  raw: player.raw_fantasy_points,
                                  multiplier: player.unit_multiplier
                                });
                                
                                return (
                                  <tr key={player.player_id}>
                                    <td>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Avatar 
                                          size="sm"
                                          src={player.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png` : undefined}
                                          sx={{ width: 28, height: 28 }}
                                        >
                                          {player.player_name.charAt(0)}
                                        </Avatar>
                                        <Typography level="body-sm" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                                          {player.player_name}
                                        </Typography>
                                      </Stack>
                                    </td>
                                    <td>
                                      <Typography level="body-xs">
                                        {player.player_team}
                                      </Typography>
                                    </td>
                                    <td>
                                      <Typography level="body-xs" sx={{ color: 'neutral.600' }}>
                                        {formatSalary(player.player_salary)}
                                      </Typography>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <Typography 
                                        level="body-sm" 
                                        sx={{ 
                                          fontWeight: 'bold',
                                          color: pool.status === 'live' ? 'danger.600' : 'success.600',
                                          fontSize: '0.85rem'
                                        }}
                                      >
                                        {player.weighted_points != null ? player.weighted_points.toFixed(1) : '0.0'}
                                      </Typography>
                                    </td>
                                    {unitMultiplier !== 1 && (
                                      <td style={{ textAlign: 'right' }}>
                                        <Typography level="body-xs" color="neutral">
                                          {player.raw_fantasy_points != null ? `${player.raw_fantasy_points.toFixed(1)}×${unitMultiplier}` : '--'}
                                        </Typography>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        </Box>
                      </Box>
                    );
                  })}

                      </Stack>
                    </Grid>

                    {/* RIGHT: Leaderboard */}
                    <Grid xs={12} md={4}>
                      <Box>
                        <Typography level="body-md" sx={{ fontWeight: 'bold', mb: 1 }}>
                          Standings
                        </Typography>
                        
                        {/* Leaderboard Table */}
                        {leaderboard && leaderboard.length > 0 ? (
                          <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: '600px' }}>
                            <Table
                              size="sm"
                              stickyHeader
                              sx={{
                                '& thead th': {
                                  bgcolor: 'background.surface',
                                  py: 0.5,
                                  fontSize: '0.7rem',
                                },
                                '& tbody tr': {
                                  cursor: 'pointer',
                                  '&:hover': {
                                    bgcolor: 'background.level1',
                                  },
                                },
                                '& td': {
                                  py: 0.5,
                                },
                              }}
                            >
                              <thead>
                                <tr>
                                  <th style={{ width: 40, textAlign: 'center' }}>#</th>
                                  <th>Player</th>
                                  <th style={{ width: 50, textAlign: 'right' }}>Pts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leaderboard.map((entry) => (
                                  <tr
                                    key={entry.entry_id}
                                    onClick={() => handleViewEntry(entry.entry_id)}
                                    style={{
                                      backgroundColor: entry.entry_id === selectedEntry.entry_id ? 'var(--joy-palette-primary-50)' : undefined,
                                    }}
                                  >
                                    <td style={{ textAlign: 'center' }}>
                                      <Typography level="body-xs" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                                        {getRankIcon(entry.rank)}
                                      </Typography>
                                    </td>
                                    <td>
                                      <Stack direction="row" spacing={0.5} alignItems="center">
                                        <Avatar size="sm" sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                          {entry.user_name.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Typography 
                                          level="body-xs" 
                                          sx={{ 
                                            fontWeight: entry.entry_id === selectedEntry.entry_id ? 'bold' : 'normal',
                                            lineHeight: 1.2,
                                            fontSize: '0.75rem'
                                          }}
                                        >
                                          {entry.user_name}
                                        </Typography>
                                      </Stack>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <Typography 
                                        level="body-sm" 
                                        sx={{ 
                                          fontWeight: 'bold', 
                                          color: entry.entry_id === selectedEntry.entry_id ? 'primary.600' : 'success.600',
                                          fontSize: '0.8rem'
                                        }}
                                      >
                                        {entry.live_score.toFixed(1)}
                                      </Typography>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </Sheet>
                        ) : (
                          <Typography level="body-sm" color="neutral">
                            No other entries yet
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                ) : (
                  // Three column layout for live/scheduled pools
                  <Box>
                    {/* Entry Header */}
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                      <Avatar size="sm" sx={{ width: 36, height: 36 }}>
                        {selectedEntry.user_name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography level="title-md" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                          {selectedEntry.user_name}'s Lineup
                        </Typography>
                        <Typography level="body-xs" color="neutral" sx={{ lineHeight: 1.2 }}>
                          {getRankIcon(selectedEntry.rank)} • {selectedEntry.live_score.toFixed(1)} pts
                        </Typography>
                      </Box>
                      {pool.status === 'live' && (
                        <Chip color="danger" variant="solid" size="sm">
                          LIVE
                        </Chip>
                      )}
                    </Stack>

                    {/* Three Column Layout: Starters | Rotation | Bench */}
                    <Grid container spacing={1}>
                      {['starters', 'rotation', 'bench'].map((unit) => {
                        const unitPlayers = selectedEntry.lineup.filter(p => p.unit === unit);
                        if (unitPlayers.length === 0) return null;

                        const unitMultiplier = unitPlayers[0]?.unit_multiplier || 1;
                        const unitLabel = unit === 'starters' ? 'Starters' : unit === 'rotation' ? 'Rotation' : 'Bench';
                        const unitColor = unit === 'starters' ? 'success' : unit === 'rotation' ? 'warning' : 'neutral';

                        return (
                          <Grid key={unit} xs={12} md={4}>
                            <Sheet variant="outlined" sx={{ p: 1, borderRadius: 'sm', height: '100%' }}>
                              {/* Unit Header */}
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
                                <Typography level="body-xs" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                                  {unitLabel}
                                </Typography>
                                <Chip size="sm" variant="solid" color={unitColor} sx={{ minHeight: 18, fontSize: '0.65rem' }}>
                                  {unitMultiplier}×
                                </Chip>
                              </Stack>

                              {/* Players Table */}
                              <Table size="sm" sx={{ 
                                '& td': { py: 0.5, fontSize: '0.7rem' } 
                              }}>
                                <tbody>
                                  {unitPlayers.map((player) => {
                                    console.log('🎯 Player data (LIVE):', {
                                      name: player.player_name,
                                      weighted: player.weighted_points,
                                      raw: player.raw_fantasy_points,
                                      multiplier: player.unit_multiplier
                                    });
                                    
                                    return (
                                      <tr key={player.player_id}>
                                        <td>
                                          <Stack direction="row" spacing={0.5} alignItems="center">
                                            <Avatar 
                                              size="sm"
                                              src={player.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png` : undefined}
                                              sx={{ width: 26, height: 26 }}
                                            >
                                              {player.player_name.charAt(0)}
                                            </Avatar>
                                            <Box sx={{ minWidth: 0 }}>
                                              <Typography 
                                                level="body-xs" 
                                                sx={{ 
                                                  fontWeight: 'bold', 
                                                  lineHeight: 1.2,
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap'
                                                }}
                                              >
                                                {player.player_name.split(' ').pop()}
                                              </Typography>
                                              <Typography 
                                                level="body-xs" 
                                                color="neutral" 
                                                sx={{ lineHeight: 1, fontSize: '0.6rem' }}
                                              >
                                                {player.player_team}
                                              </Typography>
                                            </Box>
                                          </Stack>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                          <Typography 
                                            level="body-xs" 
                                            sx={{ 
                                              fontWeight: 'bold',
                                              color: pool.status === 'live' ? 'danger.600' : 'success.600',
                                            }}
                                          >
                                            {player.weighted_points != null ? player.weighted_points.toFixed(1) : '0.0'}
                                          </Typography>
                                          {unitMultiplier !== 1 && player.raw_fantasy_points != null && (
                                            <Typography level="body-xs" color="neutral" sx={{ fontSize: '0.55rem' }}>
                                              {player.raw_fantasy_points.toFixed(1)}×{unitMultiplier}
                                            </Typography>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </Table>
                            </Sheet>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                )}
              </Box>
            )}

            {/* LEADERBOARD VIEW */}
            {currentView === 'leaderboard' && (
              <Box sx={{ p: 3 }}>
                {/* Header */}
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      {pool.name}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {new Date(pool.slate_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })} • {pool.current_entries} Entries • ${pool.entry_fee} Entry
                    </Typography>
                  </Box>
                  {pool.status === 'live' && (
                    <Chip color="danger" variant="solid">
                      LIVE
                    </Chip>
                  )}
                  {pool.status === 'completed' && (
                    <Chip color="success" variant="solid">
                      FINAL
                    </Chip>
                  )}
                </Stack>

                {/* Prize Pool */}
                <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
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
                          {pool.current_entries}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Leaderboard */}
                <Box>
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

                  {leaderboardLoading ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <LinearProgress />
                    </Box>
                  ) : leaderboard && leaderboard.length > 0 ? (
                    <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: '500px' }}>
                      <Table stickyHeader>
                        <thead>
                          <tr>
                            <th style={{ width: 60 }}>Rank</th>
                            <th>Player</th>
                            <th style={{ width: 100, textAlign: 'right' }}>
                              {pool.status === 'live' ? 'Live' : 'Final'}
                            </th>
                            <th style={{ width: 100, textAlign: 'right' }}>Prize</th>
                            <th style={{ width: 80 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((entry) => (
                            <tr 
                              key={entry.entry_id}
                              style={{ cursor: 'pointer' }}
                            >
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
                              <td>
                                <Button
                                  size="sm"
                                  variant="plain"
                                  onClick={() => handleViewEntry(entry.entry_id)}
                                >
                                  View
                                </Button>
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
            )}

            {/* POOL DETAILS VIEW */}
            {currentView === 'details' && (
              <>
        {/* Header */}
        <Box sx={{ 
          p: 3,
          borderBottom: '2px solid',
          borderColor: 'divider',
        }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography level="h3">
            {pool.name}
          </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        color="neutral"
                        size="sm"
                        startDecorator={<Share />}
                        onClick={handleShare}
                      >
                        {linkCopied ? 'Copied!' : 'Share'}
                      </Button>
                      {shouldShowLeaderboard ? (
                        <Button
                          color="primary"
                          size="sm"
                          onClick={handleViewLeaderboard}
                        >
                          View Leaderboard
                        </Button>
                      ) : pool.status !== 'scheduled' ? (
                        <Button
                          color="neutral"
                          size="sm"
                          disabled
                          startDecorator={<Timer />}
                        >
                          Locked
                        </Button>
                      ) : (
                        <Button
                          color="primary"
                          size="sm"
                          onClick={() => handleEnterContest()}
                        >
                          Enter Contest
                        </Button>
                      )}
                    </Box>
                  </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <Chip size="sm" variant="soft" color={
              pool.difficulty_tier === 'elite' ? 'danger' :
              pool.difficulty_tier === 'pro' ? 'warning' : 'success'
            }>
              {getDifficultyLabel(pool.difficulty_tier)}
            </Chip>
            <Typography level="body-sm" color="neutral">
              {pool.slate_name}
            </Typography>
            <Typography level="body-sm" color="neutral">
              • {format(new Date(pool.slate_date), 'EEEE, MMM dd')}
            </Typography>
          </Box>

          {/* Key Stats Grid */}
          <Grid container spacing={2}>
            <Grid xs={3}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>Entry Fee</Typography>
                <Typography level="h4">
                  {pool.entry_fee === 0 ? 'FREE' : `$${pool.entry_fee}`}
                </Typography>
              </Box>
            </Grid>
            <Grid xs={3}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>Entries</Typography>
                <Typography level="h4">
                  {pool.current_entries}/{pool.max_entries}
                </Typography>
              </Box>
            </Grid>
            <Grid xs={3}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>Prize Pool</Typography>
                <Typography level="h4" color="success">
                  {formatMoney(pool.prize_pool)}
                </Typography>
              </Box>
            </Grid>
            <Grid xs={3}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>Locks In</Typography>
                        <Typography level="h4" sx={{ fontSize: '1.5rem' }}>
                          {new Date(pool.lock_time).toLocaleString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {new Date(pool.lock_time).toLocaleString('en-US', {
                            timeZoneName: 'short'
                          }).split(', ')[1]}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Body */}
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Left Column */}
            <Grid xs={12} md={7}>
              {/* Summary */}
              <Box sx={{ mb: 3 }}>
                <Typography level="title-lg" sx={{ mb: 1.5 }}>
                  Contest Summary
                </Typography>
                <Box sx={{ 
                  p: 2,
                  bgcolor: 'background.level1',
                  borderRadius: 'sm',
                }}>
                  <Typography level="body-md" sx={{ lineHeight: 1.7, mb: 2 }}>
                    {pool.description || `This ${pool.max_entries}-player contest features ${formatMoney(pool.prize_pool)} in total prizes. 
                    Build your optimal 10-player lineup using REAL NBA salaries under a ${formatSalary(pool.salary_cap)} salary cap.`}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip size="sm" variant="outlined">
                      Cap: {formatSalary(pool.salary_cap)}
                    </Chip>
                    <Chip size="sm" variant="outlined">
                      {pool.games_count} Games
                    </Chip>
                    <Chip size="sm" variant="outlined">
                      {pool.players_count} Players
                    </Chip>
                    <Chip size="sm" variant="soft" color="success">
                      Real NBA Salaries
                    </Chip>
                  </Box>
                </Box>
              </Box>

                      {/* User's Entries */}
                      {user && userEntries && userEntries.length > 0 && (
                        <Box sx={{ mb: 3 }}>
                          <Typography level="title-lg" sx={{ mb: 1.5 }}>
                            Your Entries ({userEntries.length})
                          </Typography>
                          <Stack spacing={1}>
                            {userEntries.map((entry, index) => (
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
                                  // If pool is scheduled and entry not submitted: edit mode
                                  // Otherwise: view entry performance mode
                                  if (pool.status === 'scheduled' && !entry.is_submitted) {
                                    handleEditEntry(entry.id);
                                  } else {
                                    handleViewEntry(entry.id);
                                  }
                                }}
                              >
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  <Box>
                                    <Typography level="title-sm" sx={{ fontWeight: 'bold' }}>
                                      Entry #{index + 1}
                                    </Typography>
                                    <Typography level="body-xs" color="neutral">
                                      {entry.is_submitted ? 'Submitted' : 'In Progress'} • {formatSalary(entry.total_salary || 0)} used
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    {entry.is_submitted ? (
                                      <Chip size="sm" variant="soft" color="success">
                                        ✓ Submitted
                                      </Chip>
                                    ) : (
                                      <Chip size="sm" variant="soft" color="warning">
                                        Draft
                                      </Chip>
                                    )}
                                    {pool.status === 'scheduled' && !entry.is_submitted && (
                                      <IconButton size="sm" color="primary">
                                        <Edit />
                                      </IconButton>
                                    )}
                                  </Box>
                                </Stack>
                              </Sheet>
                            ))}
                          </Stack>
                        </Box>
                      )}

              {/* Roster Requirements */}
              <Box>
                <Typography level="title-lg" sx={{ mb: 1.5 }}>
                  Lineup Requirements
                </Typography>
                <Box sx={{ 
                  p: 2,
                  bgcolor: 'background.level1',
                  borderRadius: 'sm',
                }}>
                  <Typography level="body-sm" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Build a 10-player lineup with position-based multipliers
                  </Typography>
                  
                  <Stack spacing={1.5}>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      p: 1.5, 
                      bgcolor: 'background.surface',
                      borderRadius: 'sm',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}>
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          Starters (5 players)
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          PG • SG • SF • PF • C
                        </Typography>
                      </Box>
                      <Chip size="sm" variant="solid" color="success">1.0×</Chip>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      p: 1.5, 
                      bgcolor: 'background.surface',
                      borderRadius: 'sm',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}>
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          Rotation (3 players)
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          Any Position
                        </Typography>
                      </Box>
                      <Chip size="sm" variant="solid" color="warning">0.75×</Chip>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      p: 1.5, 
                      bgcolor: 'background.surface',
                      borderRadius: 'sm',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}>
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          Bench (2 players)
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          Any Position
                        </Typography>
                      </Box>
                      <Chip size="sm" variant="solid" color="neutral">0.50×</Chip>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            </Grid>

            {/* Right Column - Prize Table */}
            <Grid xs={12} md={5}>
              <Typography level="title-lg" sx={{ mb: 1.5 }}>
                Prize Payouts
              </Typography>
              <Sheet 
                variant="outlined" 
                sx={{ 
                  maxHeight: 450, 
                  overflow: 'auto', 
                  borderRadius: 'sm',
                }}
              >
                <Table size="sm">
                  <thead>
                    <tr>
                      <th>Place</th>
                      <th style={{ textAlign: 'right' }}>Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.entry_fee === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ textAlign: 'center', padding: '2rem' }}>
                          <Typography level="body-sm" color="neutral" sx={{ fontStyle: 'italic' }}>
                            Free Pool — No Prize Payouts
                          </Typography>
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr>
                          <td style={{ fontWeight: 'bold' }}>1st</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>$200,000.00</td>
                        </tr>
                        <tr>
                          <td>2nd</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>$80,000.00</td>
                        </tr>
                        <tr>
                          <td>3rd</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>$40,000.00</td>
                        </tr>
                        <tr>
                          <td>4th-5th</td>
                          <td style={{ textAlign: 'right' }}>$20,000.00</td>
                        </tr>
                        <tr>
                          <td>6th-10th</td>
                          <td style={{ textAlign: 'right' }}>$10,000.00</td>
                        </tr>
                        <tr>
                          <td>11th-20th</td>
                          <td style={{ textAlign: 'right' }}>$5,000.00</td>
                        </tr>
                        <tr>
                          <td>21st-50th</td>
                          <td style={{ textAlign: 'right' }}>$1,000.00</td>
                        </tr>
                        <tr>
                          <td>51st-100th</td>
                          <td style={{ textAlign: 'right' }}>$500.00</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </Table>
              </Sheet>

              {/* Contest Info */}
              <Box sx={{ 
                mt: 2,
                p: 2,
                bgcolor: 'background.level1',
                borderRadius: 'sm',
              }}>
                <Typography level="title-sm" sx={{ mb: 1.5 }}>
                  Contest Info
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Fill Rate:</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {Math.round((pool.current_entries / pool.max_entries) * 100)}%
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Lock Time:</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {new Date(pool.lock_time).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZoneName: 'short'
                              })}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Status:</Typography>
                    <Chip size="sm" variant="soft" color="primary">
                      {pool.status}
                    </Chip>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Box>
              </>
            )}
          </>
        )}
      </ModalDialog>
    </Modal>
  );
}
