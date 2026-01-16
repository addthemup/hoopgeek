import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  Stepper,
  Step,
  StepIndicator,
  StepButton,
  Alert,
  CircularProgress,
} from '@mui/joy';
import { SportsSoccer, EmojiEvents, Timer, TrendingUp, Share, ArrowBack, Refresh, Edit, InfoOutlined } from '@mui/icons-material';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import DFSLineupBuilder from './DFSLineupBuilder';
import { useAuth } from '../../hooks/useAuth';
import SlateGamesRow from './SlateGamesRow';
import EntriesAggregator from './EntriesAggregator';

interface PoolDetailsTabProps {
  poolId: string | null;
  initialView?: 'details' | 'leaderboard' | 'entry' | 'lineup-builder';
  entryId?: string | null;
  onBack?: () => void;
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
  icon_name?: string | null;
  html_color_primary?: string | null;
  html_color_secondary?: string | null;
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

export default function PoolDetailsTab({ poolId, initialView = 'details', entryId: initialEntryId = null, onBack }: PoolDetailsTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentView, setCurrentView] = useState<'details' | 'leaderboard' | 'entry' | 'lineup-builder'>(initialView);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(initialEntryId);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);

  // Reset view when props change
  useEffect(() => {
    setCurrentView(initialView);
    setSelectedEntryId(initialEntryId);
  }, [initialView, initialEntryId]);

  // Fetch pool details
  const { data: pool, isLoading: poolLoading } = useQuery<PoolDetails>({
    queryKey: ['dfs-pool-details', poolId],
    queryFn: async () => {
      if (!poolId) throw new Error('No pool ID');
      
      const { data, error } = await supabase
        .from('dfs_pools')
        .select('*, icon_name, html_color_primary, html_color_secondary')
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
        // Explicitly preserve icon fields
        icon_name: data.icon_name,
        html_color_primary: data.html_color_primary,
        html_color_secondary: data.html_color_secondary,
      };
    },
    enabled: !!poolId,
  });

  // Fetch user's entries for this pool with lineup players
  const { data: userEntries, refetch: refetchUserEntries } = useQuery({
    queryKey: ['dfs-user-pool-entries', poolId, user?.id],
    queryFn: async () => {
      if (!poolId || !user?.id) return [];
      
      const { data: entries, error } = await supabase
        .from('dfs_entries')
        .select('id, is_submitted, total_salary, created_at')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!entries) return [];

      // For each entry, fetch the lineup players
      const entriesWithLineups = await Promise.all(
        entries.map(async (entry) => {
          // Get lineup for this entry
          const { data: lineup, error: lineupError } = await supabase
            .from('dfs_lineups')
            .select('id')
            .eq('entry_id', entry.id)
            .eq('pool_id', poolId)
            .maybeSingle();

          if (lineupError || !lineup) {
            return { ...entry, players: [] };
          }

          // Get lineup positions with unit information
          const { data: positions, error: positionsError } = await supabase
            .from('dfs_lineup_positions')
            .select('nba_player_id, player_name, unit')
            .eq('lineup_id', lineup.id)
            .eq('pool_id', poolId)
            .order('unit', { ascending: true })
            .order('unit_position', { ascending: true });

          if (positionsError) {
            return { ...entry, players: [] };
          }

          return {
            ...entry,
            players: positions || [],
          };
        })
      );

      return entriesWithLineups;
    },
    enabled: !!poolId && !!user?.id,
  });

  // Countdown timer for lock time
  const [timeUntilLock, setTimeUntilLock] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!pool?.lock_time) {
      setTimeUntilLock('N/A');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const lockTime = new Date(pool.lock_time);
      const timeDiff = lockTime.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setTimeUntilLock('Locked');
        setIsLocked(true);
        return;
      }

      setIsLocked(false);
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeUntilLock(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeUntilLock(`${minutes}m ${seconds}s`);
      } else {
        setTimeUntilLock(`${seconds}s`);
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [pool?.lock_time]);

  // Fetch leaderboard for live/past pools
  const { data: leaderboard, isLoading: leaderboardLoading, refetch } = useQuery<LeaderboardEntry[]>({
    queryKey: ['dfs-pool-leaderboard', poolId, pool?.status],
    queryFn: async () => {
      if (!poolId || !pool) return [];

      const { data: entries, error: entriesError } = await supabase
        .from('dfs_entries')
        .select('id, user_id, final_score, final_points')
        .eq('pool_id', poolId)
        .eq('is_submitted', true);

      if (entriesError) throw entriesError;

      // Build profile map
      const profileMap = new Map(
        entries?.map(e => {
          let displayName: string | null = null;
          
          if (e.user_id === user?.id) {
            displayName = user?.user_metadata?.display_name || 
                         user?.user_metadata?.username || 
                         user?.email?.split('@')[0] || 
                         'You';
          }
          
          return [e.user_id, displayName];
        }) || []
      );

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
    enabled: !!poolId && !!pool && (pool.status === 'live' || pool.status === 'completed'),
    refetchInterval: autoRefresh && pool?.status === 'live' ? 30000 : false,
  });

  // Real-time subscription for live pools
  useEffect(() => {
    if (!poolId || !pool || pool.status !== 'live') return;

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
  }, [poolId, pool?.status, refetch]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipOpen && infoButtonRef.current && !infoButtonRef.current.contains(event.target as Node)) {
        const tooltipElement = document.getElementById('pool-info-tooltip');
        if (tooltipElement && !tooltipElement.contains(event.target as Node)) {
          setTooltipOpen(false);
        }
      }
    };

    if (tooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tooltipOpen]);

  const handleShare = () => {
    if (!poolId) return;
    const shareUrl = `${window.location.origin}/dfs/join/${poolId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleEnterContest = async () => {
    // Create a new entry explicitly
    if (!poolId || !user?.id || !pool) return;
    
    try {
      const { data: newEntry, error } = await supabase
        .from('dfs_entries')
        .insert({
          pool_id: poolId,
          user_id: user.id,
          entry_fee_paid: pool.entry_fee || 0,
          total_salary: 0,
          projected_points: 0,
          is_submitted: false,
        })
        .select('id')
        .single();

      if (error) throw error;
      
      if (newEntry) {
        setSelectedEntryId(newEntry.id);
        setCurrentView('lineup-builder');
        // Invalidate queries to refresh entries list
        refetchUserEntries();
      }
    } catch (error) {
      console.error('Error creating new entry:', error);
      alert('Failed to create new entry. Please try again.');
    }
  };

  const handleEditEntry = async (entryId: string) => {
    // Check if entry is submitted and unsubmit it if needed
    if (!poolId || !user?.id) return;
    
    console.log('✏️ Editing entry:', { entryId, poolId, userId: user.id });
    
    try {
      // Get entry to check if it's submitted
      const { data: entry, error: entryError } = await supabase
        .from('dfs_entries')
        .select('id, is_submitted')
        .eq('id', entryId)
        .eq('user_id', user.id)
        .single();

      if (entryError) {
        console.error('❌ Error fetching entry:', entryError);
        throw entryError;
      }
      
      console.log('📋 Entry status:', { entryId: entry?.id, is_submitted: entry?.is_submitted });
      
      // If entry is submitted, unsubmit it first to allow editing
      if (entry?.is_submitted) {
        console.log('🔄 Unsubmitting entry...');
        
        // Directly update the entry instead of using RPC (which finds by pool/user, not entry_id)
        const { error: updateError } = await supabase
          .from('dfs_entries')
          .update({
            is_submitted: false,
            submitted_at: null,
            lineup_locked: false,
          })
          .eq('id', entryId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('❌ Error unsubmitting entry:', updateError);
          alert(`Cannot edit: ${updateError.message || 'Failed to unsubmit entry'}`);
          return;
        }
        
        // Decrement pool entry count manually
        const { data: poolData, error: poolFetchError } = await supabase
          .from('dfs_pools')
          .select('current_entries')
          .eq('id', poolId)
          .single();
        
        if (!poolFetchError && poolData) {
          const { error: poolUpdateError } = await supabase
            .from('dfs_pools')
            .update({ current_entries: Math.max(0, (poolData.current_entries || 0) - 1) })
            .eq('id', poolId);
          
          if (poolUpdateError) {
            console.warn('⚠️ Could not decrement pool entries:', poolUpdateError);
            // Continue anyway - this is not critical
          }
        }
        
        console.log('✅ Entry unsubmitted successfully');
        
        // Invalidate all related queries to refresh data
        await queryClient.invalidateQueries({ queryKey: ['dfs-lineup', poolId, user.id, entryId] });
        await queryClient.invalidateQueries({ queryKey: ['dfs-lineup', poolId, user.id] });
        await queryClient.invalidateQueries({ queryKey: ['dfs-lineup-salary', poolId, user.id, entryId] });
        await queryClient.invalidateQueries({ queryKey: ['dfs-lineup-salary', poolId, user.id] });
        await queryClient.invalidateQueries({ queryKey: ['dfs-user-pool-entries', poolId, user.id] });
      }
      
      // Small delay to ensure queries are invalidated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('✅ Setting entry for editing:', entryId);
      setSelectedEntryId(entryId);
      setCurrentView('lineup-builder');
      
      // Refresh entries list
      refetchUserEntries();
    } catch (error) {
      console.error('❌ Error preparing entry for edit:', error);
      alert(`Failed to edit entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleViewEntry = (entryId: string) => {
    setSelectedEntryId(entryId);
    setCurrentView('entry');
  };

  const handleViewLeaderboard = () => {
    setCurrentView('leaderboard');
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

  const selectedEntry = selectedEntryId 
    ? leaderboard?.find(e => e.entry_id === selectedEntryId) || null
    : null;

  const shouldShowLeaderboard = pool && (pool.status === 'live' || pool.status === 'completed');

  // Define steps based on pool status
  const getSteps = () => {
    const steps = ['Details'];
    if (shouldShowLeaderboard) steps.push('Leaderboard');
    if (user) steps.push('My Entries');
    return steps;
  };

  const getStepIndex = () => {
    if (currentView === 'details') return 0;
    if (currentView === 'leaderboard') return 1;
    if (currentView === 'entry' || currentView === 'lineup-builder') return 2;
    return 0;
  };

  const handleStepChange = (step: number) => {
    const steps = getSteps();
    if (step === 0) setCurrentView('details');
    else if (step === 1) setCurrentView('leaderboard');
    else if (step === 2) {
      // Show user entries or lineup builder
      if (userEntries && userEntries.length > 0 && pool?.status === 'scheduled') {
        // Show first draft entry for editing
        const draftEntry = userEntries.find(e => !e.is_submitted);
        if (draftEntry) {
          setSelectedEntryId(draftEntry.id);
          setCurrentView('lineup-builder');
        } else {
          setCurrentView('lineup-builder');
        }
      } else {
        setCurrentView('lineup-builder');
      }
    }
  };

  if (!poolId) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <Typography sx={{ color: '#FFFFFF' }}>
          No pool selected
        </Typography>
      </Alert>
    );
  }

  if (poolLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <LinearProgress sx={{ width: '100%' }} />
      </Box>
    );
  }

  if (!pool) {
    return (
      <Alert color="danger" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <Typography sx={{ color: '#FFFFFF' }}>
          Pool not found
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header with Back to Contests, Pool Name, and Info Button */}
      {onBack && pool && currentView !== 'lineup-builder' && (
        <Box sx={{ mb: 3, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button
              variant="plain"
              startDecorator={<ArrowBack />}
              onClick={onBack}
              size="sm"
              sx={{
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Back to Contests
            </Button>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography level="h3" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                {pool.name}
              </Typography>
              <IconButton
                ref={infoButtonRef}
                size="sm"
                variant="plain"
                onClick={() => setTooltipOpen(!tooltipOpen)}
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  '&:hover': {
                    color: '#FFFFFF',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                <InfoOutlined sx={{ fontSize: 18 }} />
              </IconButton>
              {tooltipOpen && (
                <Card
                  id="pool-info-tooltip"
                  variant="soft"
                  sx={{
                    position: 'absolute',
                    top: 40,
                    right: 0,
                    zIndex: 20,
                    maxWidth: 300,
                    bgcolor: '#1a1a1a',
                    borderColor: '#333333',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <Box sx={{ p: 2 }}>
                    <Typography level="body-sm" sx={{ mb: 1, fontWeight: 600, color: '#FFFFFF' }}>
                      Contest Details
                    </Typography>
                    <Typography level="body-xs" sx={{ mb: 0.5, color: 'rgba(255, 255, 255, 0.8)' }}>
                      {pool.description || `This ${pool.max_entries}-player contest features ${formatMoney(pool.prize_pool)} in total prizes. Build your optimal 10-player lineup using REAL NBA salaries under a ${formatSalary(pool.salary_cap)} salary cap.`}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
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
                </Card>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* LINEUP BUILDER VIEW */}
      {currentView === 'lineup-builder' && (() => {
        console.log('📊 Lineup builder view render check:', {
          currentView,
          poolId,
          pool: !!pool,
          poolLoading,
          selectedEntryId,
          hasPool: !!pool,
        });
        
        if (!poolId) {
          return (
            <Box sx={{ p: 3 }}>
              <Alert color="warning">No pool ID provided</Alert>
            </Box>
          );
        }
        
        if (poolLoading) {
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
              <CircularProgress />
              <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                Loading pool details...
              </Typography>
            </Box>
          );
        }
        
        if (!pool) {
          return (
            <Box sx={{ p: 3 }}>
              <Alert color="danger">Pool not found</Alert>
            </Box>
          );
        }
        
        return (
          <Box>
            <DFSLineupBuilder
              poolId={poolId}
              entryId={selectedEntryId || undefined}
              onSuccess={() => {
                refetchUserEntries();
                setCurrentView('details');
                if (onBack) onBack();
              }}
              onPlayerClick={(nbaPlayerId) => {
                navigate(`/player/${nbaPlayerId}`);
              }}
            />
          </Box>
        );
      })()}

      {/* ENTRY DETAIL VIEW */}
      {currentView === 'entry' && selectedEntry && (
        <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar size="sm" sx={{ width: 36, height: 36 }}>
                  {selectedEntry.user_name.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography level="title-md" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                    {selectedEntry.user_name}'s Lineup
                  </Typography>
                  <Typography level="body-xs" sx={{ color: '#FFFFFF' }}>
                    {getRankIcon(selectedEntry.rank)} • {selectedEntry.live_score.toFixed(1)} pts
                  </Typography>
                </Box>
              </Stack>

              {/* Lineup Table */}
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="sm" sx={{ 
                  bgcolor: '#000000',
                  '& tbody td': {
                    color: '#FFFFFF',
                  },
                  '& tbody tr:hover': {
                    bgcolor: '#1a1a1a',
                  },
                }}>
                  <thead>
                    <tr>
                      <th style={{ color: '#FFFFFF' }}>Player</th>
                      <th style={{ color: '#FFFFFF' }}>Team</th>
                      <th style={{ color: '#FFFFFF' }}>Position</th>
                      <th style={{ color: '#FFFFFF' }}>Salary</th>
                      <th style={{ color: '#FFFFFF', textAlign: 'right' }}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEntry.lineup.map((player) => (
                      <tr key={player.player_id}>
                        <td>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PlayerAvatar player={player} />
                            <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                              {player.player_name}
                            </Typography>
                          </Stack>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                            {player.player_team}
                          </Typography>
                        </td>
                        <td>
                          <Chip size="sm" variant="soft">
                            {player.unit} ({player.unit_multiplier}×)
                          </Chip>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                            {formatSalary(player.player_salary)}
                          </Typography>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                            {player.weighted_points != null ? player.weighted_points.toFixed(1) : '0.0'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* LEADERBOARD VIEW */}
      {currentView === 'leaderboard' && pool && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
              🏆 Leaderboard
            </Typography>
            {pool.status === 'live' && (
              <Button
                size="sm"
                variant="outlined"
                color={autoRefresh ? 'primary' : undefined}
                startDecorator={<Refresh />}
                onClick={() => {
                  setAutoRefresh(!autoRefresh);
                  refetch();
                }}
                sx={{
                  borderColor: autoRefresh ? '#FFC72C' : '#333333',
                  color: '#FFFFFF',
                  '&:hover': {
                    borderColor: autoRefresh ? '#FFD700' : '#555555',
                    bgcolor: autoRefresh ? 'rgba(255, 199, 44, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                {autoRefresh ? 'Auto' : 'Manual'}
              </Button>
            )}
          </Stack>
          <EntriesAggregator 
            poolId={poolId || ''} 
            poolStatus={pool.status as 'live' | 'completed' | 'scheduled'}
            slateDate={pool.slate_date}
          />
        </Box>
      )}

      {/* POOL DETAILS VIEW */}
      {currentView === 'details' && (
        <Box>
          {/* Share and Enter Contest Buttons */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="outlined"
              size="sm"
              startDecorator={<Share />}
              onClick={handleShare}
              sx={{
                borderColor: '#333333',
                color: '#FFFFFF',
                '&:hover': {
                  borderColor: '#555555',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              {linkCopied ? 'Copied!' : 'Share'}
            </Button>
            {shouldShowLeaderboard ? (
              <Button
                color="primary"
                size="sm"
                onClick={handleViewLeaderboard}
                sx={{
                  bgcolor: '#FFC72C',
                  color: '#000000',
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: '#FFD700',
                  },
                }}
              >
                View Leaderboard
              </Button>
            ) : pool.status !== 'scheduled' ? (
              <Button
                size="sm"
                disabled
                startDecorator={<Timer />}
                sx={{
                  bgcolor: '#333333',
                  color: '#FFFFFF',
                }}
              >
                Locked
              </Button>
            ) : (
              <Button
                color="primary"
                size="sm"
                onClick={handleEnterContest}
                sx={{
                  bgcolor: '#FFC72C',
                  color: '#000000',
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: '#FFD700',
                  },
                }}
              >
                Enter Contest
              </Button>
            )}
          </Box>

          {/* Slate Games Row */}
          {poolId && <SlateGamesRow poolId={poolId} />}

          <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333', mb: 3 }}>
            <CardContent>
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip size="sm" variant="soft" color={
                    pool.difficulty_tier === 'elite' ? 'danger' :
                    pool.difficulty_tier === 'pro' ? 'warning' : 'success'
                  }>
                    {getDifficultyLabel(pool.difficulty_tier)}
                  </Chip>
                  <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                    {pool.slate_name}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                    • {format(new Date(pool.slate_date), 'EEEE, MMM dd')}
                  </Typography>
                </Box>

                {/* Key Stats Grid */}
                <Grid container spacing={2}>
                  <Grid xs={3}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#1a1a1a', borderRadius: 'sm' }}>
                      <Typography level="body-xs" sx={{ mb: 0.5, color: '#FFFFFF' }}>Entry Fee</Typography>
                      <Typography level="h4" sx={{ color: '#FFFFFF' }}>
                        {pool.entry_fee === 0 ? 'FREE' : `$${pool.entry_fee}`}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={3}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#1a1a1a', borderRadius: 'sm' }}>
                      <Typography level="body-xs" sx={{ mb: 0.5, color: '#FFFFFF' }}>Entries</Typography>
                      <Typography level="h4" sx={{ color: '#FFFFFF' }}>
                        {pool.current_entries}/{pool.max_entries}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={3}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#1a1a1a', borderRadius: 'sm' }}>
                      <Typography level="body-xs" sx={{ mb: 0.5, color: '#FFFFFF' }}>Prize Pool</Typography>
                      <Typography level="h4" sx={{ color: '#FFFFFF' }}>
                        {formatMoney(pool.prize_pool)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={3}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#1a1a1a', borderRadius: 'sm' }}>
                      <Typography level="body-xs" sx={{ mb: 0.5, color: '#FFFFFF' }}>Locks In</Typography>
                      <Typography 
                        level="h4" 
                        sx={{ 
                          fontSize: '1.5rem', 
                          color: isLocked ? '#FF6B6B' : '#FFFFFF',
                          fontWeight: 'bold'
                        }}
                      >
                        {timeUntilLock || 'Calculating...'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>

          {/* User's Entries */}
          {user && userEntries && userEntries.length > 0 && (
            <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333', mb: 3 }}>
              <CardContent>
                <Typography level="title-lg" sx={{ mb: 1.5, color: '#FFFFFF' }}>
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
                        '&:hover': { bgcolor: '#1a1a1a' },
                        cursor: 'pointer',
                        bgcolor: '#1a1a1a',
                      }}
                      onClick={() => {
                        if (pool.status === 'scheduled' && !entry.is_submitted) {
                          handleEditEntry(entry.id);
                        } else {
                          handleViewEntry(entry.id);
                        }
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Typography level="title-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                              Entry #{index + 1}
                            </Typography>
                            {entry.is_submitted ? (
                              <Chip size="sm" variant="soft" color="success">
                                ✓ Submitted
                              </Chip>
                            ) : (
                              <Chip size="sm" variant="soft" color="warning">
                                Draft
                              </Chip>
                            )}
                          </Stack>
                          <Typography level="body-xs" sx={{ color: '#FFFFFF', mb: 1 }}>
                            {formatSalary(entry.total_salary || 0)} used
                          </Typography>
                          {/* Player Avatars grouped by unit */}
                          {entry.players && entry.players.length > 0 && (() => {
                            // Group players by unit
                            const starters = entry.players.filter(p => p.unit === 'starters');
                            const rotation = entry.players.filter(p => p.unit === 'rotation');
                            const bench = entry.players.filter(p => p.unit === 'bench');
                            
                            return (
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                                {/* Starters */}
                                {starters.length > 0 && (
                                  <>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                      {starters.map((player, playerIndex) => (
                                        <Avatar
                                          key={`starters-${playerIndex}`}
                                          size="sm"
                                          src={player.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png` : undefined}
                                          sx={{ 
                                            width: 32, 
                                            height: 32,
                                            border: '1px solid #333333',
                                          }}
                                          title={player.player_name}
                                        >
                                          {player.player_name?.charAt(0) || '?'}
                                        </Avatar>
                                      ))}
                                    </Stack>
                                    {(rotation.length > 0 || bench.length > 0) && (
                                      <Divider orientation="vertical" sx={{ height: 24, borderColor: '#333333' }} />
                                    )}
                                  </>
                                )}
                                
                                {/* Rotation */}
                                {rotation.length > 0 && (
                                  <>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                      {rotation.map((player, playerIndex) => (
                                        <Avatar
                                          key={`rotation-${playerIndex}`}
                                          size="sm"
                                          src={player.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png` : undefined}
                                          sx={{ 
                                            width: 32, 
                                            height: 32,
                                            border: '1px solid #333333',
                                          }}
                                          title={player.player_name}
                                        >
                                          {player.player_name?.charAt(0) || '?'}
                                        </Avatar>
                                      ))}
                                    </Stack>
                                    {bench.length > 0 && (
                                      <Divider orientation="vertical" sx={{ height: 24, borderColor: '#333333' }} />
                                    )}
                                  </>
                                )}
                                
                                {/* Bench */}
                                {bench.length > 0 && (
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    {bench.map((player, playerIndex) => (
                                      <Avatar
                                        key={`bench-${playerIndex}`}
                                        size="sm"
                                        src={player.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png` : undefined}
                                        sx={{ 
                                          width: 32, 
                                          height: 32,
                                          border: '1px solid #333333',
                                        }}
                                        title={player.player_name}
                                      >
                                        {player.player_name?.charAt(0) || '?'}
                                      </Avatar>
                                    ))}
                                  </Stack>
                                )}
                              </Stack>
                            );
                          })()}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <IconButton 
                            size="sm" 
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (pool.status === 'scheduled' && !entry.is_submitted) {
                                handleEditEntry(entry.id);
                              } else {
                                handleViewEntry(entry.id);
                              }
                            }}
                            sx={{
                              color: '#FFC72C',
                              '&:hover': {
                                bgcolor: 'rgba(255, 199, 44, 0.1)',
                              },
                            }}
                          >
                            <Edit />
                          </IconButton>
                        </Box>
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

        </Box>
      )}
    </Box>
  );
}

