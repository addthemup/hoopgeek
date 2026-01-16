import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Input,
  Sheet,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Divider,
  Grid,
  Stack,
  IconButton,
  LinearProgress,
} from '@mui/joy';
import {
  TrendingUp,
  CheckCircle,
  Search,
  CheckCircleOutline,
  CancelOutlined,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useDFSPool } from '../../hooks/useDFSPool';
import { useDFSPlayers, DFSPlayer } from '../../hooks/useDFSPlayers';
import { useDFSLineup, useSetDFSLineupPosition, useRemoveDFSLineupPosition } from '../../hooks/useDFSLineup';
import { useDFSLineupSalary, formatSalary } from '../../hooks/useDFSLineupSalary';
import { useSubmitDFSLineup } from '../../hooks/useSubmitDFSLineup';
import DFSBasketballCourt from '../DFSBasketballCourt';

interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  jerseyNumber?: number | string;
  nbaPlayerId?: number;
  avatar: string;
  injuryStatus?: string;
  injuryType?: string;
}

interface LineupPosition {
  lineup_unit: 'starters' | 'rotation' | 'bench';
  unit_position: number;
  position_label: string;
  multiplier: number;
}

interface DFSLineupBuilderProps {
  poolId: string | undefined;
  entryId?: string | undefined;
  onSuccess?: () => void;
  onPlayerClick?: (nbaPlayerId: number) => void;
}

export default function DFSLineupBuilder({ poolId, entryId, onSuccess, onPlayerClick }: DFSLineupBuilderProps) {
  const { user } = useAuth();

  // Fetch data
  const { data: pool, isLoading: poolLoading } = useDFSPool(poolId);
  const { data: availablePlayers, isLoading: playersLoading } = useDFSPlayers(poolId);
  const { data: lineupPositions, isLoading: lineupLoading } = useDFSLineup(poolId, user?.id, entryId);
  const { data: salaryData, isLoading: salaryLoading } = useDFSLineupSalary(poolId, user?.id, entryId);

  // Fetch pool games for matchup filters
  const { data: poolGames } = useQuery({
    queryKey: ['dfs-pool-games', poolId],
    queryFn: async () => {
      if (!poolId) return [];
      const { data, error } = await supabase
        .from('dfs_pool_games')
        .select('game_id, home_team, away_team')
        .eq('pool_id', poolId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!poolId,
  });

  // Mutations
  const setLineupPosition = useSetDFSLineupPosition();
  const removeLineupPosition = useRemoveDFSLineupPosition();
  const submitLineup = useSubmitDFSLineup();

  // Define lineup structure (10 players total)
  const lineupStructure: LineupPosition[] = [
    { lineup_unit: 'starters', unit_position: 0, position_label: 'PG', multiplier: 1.0 },
    { lineup_unit: 'starters', unit_position: 1, position_label: 'SG', multiplier: 1.0 },
    { lineup_unit: 'starters', unit_position: 2, position_label: 'SF', multiplier: 1.0 },
    { lineup_unit: 'starters', unit_position: 3, position_label: 'PF', multiplier: 1.0 },
    { lineup_unit: 'starters', unit_position: 4, position_label: 'C', multiplier: 1.0 },
    { lineup_unit: 'rotation', unit_position: 0, position_label: 'UTIL', multiplier: 0.75 },
    { lineup_unit: 'rotation', unit_position: 1, position_label: 'UTIL', multiplier: 0.75 },
    { lineup_unit: 'rotation', unit_position: 2, position_label: 'UTIL', multiplier: 0.75 },
    { lineup_unit: 'bench', unit_position: 0, position_label: 'BN', multiplier: 0.5 },
    { lineup_unit: 'bench', unit_position: 1, position_label: 'BN', multiplier: 0.5 },
  ];

  // Create a map of players in lineup
  const playersInLineup = useMemo(() => {
    const map = new Map<string, LineupPosition>();
    if (!lineupPositions || !availablePlayers) return map;

    lineupPositions.forEach((lp) => {
      map.set(lp.player_id, {
        lineup_unit: lp.unit,
        unit_position: lp.unit_position,
        position_label: '',
        multiplier: lp.unit_multiplier,
      });
    });

    return map;
  }, [lineupPositions, availablePlayers]);

  // Filter out players already in lineup
  const availablePlayersForSelection = useMemo(() => {
    if (!availablePlayers) return [];
    return availablePlayers.filter((player) => !playersInLineup.has(player.player_id));
  }, [availablePlayers, playersInLineup]);

  // Create salary map for modal
  const playerSalaries = useMemo(() => {
    const salaryMap: Record<string, number> = {};
    availablePlayers?.forEach((player) => {
      salaryMap[player.player_id] = player.salary;
    });
    return salaryMap;
  }, [availablePlayers]);

  // Convert DFS players to lineup Player format
  const convertToPlayer = (dfsPlayer: DFSPlayer): Player => ({
    id: dfsPlayer.player_id,
    name: dfsPlayer.player_name,
    team: dfsPlayer.player_team,
    position: dfsPlayer.player_position,
    nbaPlayerId: dfsPlayer.nba_player_id,
    avatar: `https://cdn.nba.com/headshots/nba/latest/1040x760/${dfsPlayer.nba_player_id}.png`,
    // Pass injury data through
    injuryStatus: dfsPlayer.injury_status || undefined,
    injuryType: dfsPlayer.injury_type || undefined,
  });

  // Get players for basketball court
  const courtPlayers: { [key: string]: Player | null } = useMemo(() => {
    const result: { [key: string]: Player | null } = {};

    lineupStructure.forEach((pos) => {
      const key = `${pos.lineup_unit}-${pos.unit_position}`;
      const lineupPos = lineupPositions?.find(
        (lp) => lp.unit === pos.lineup_unit && lp.unit_position === pos.unit_position
      );

      if (lineupPos && availablePlayers) {
        const player = availablePlayers.find((p) => p.player_id === lineupPos.player_id);
        result[key] = player ? convertToPlayer(player) : null;
      } else {
        result[key] = null;
      }
    });

    return result;
  }, [lineupPositions, availablePlayers]);

  // Use percentUsed from salaryData hook, or calculate it
  const percentUsed = useMemo(() => {
    if (!salaryData) {
      console.log('📊 percentUsed: No salaryData, returning 0');
      return 0;
    }
    
    // Use percentUsed from hook if available, otherwise calculate it
    let calculatedPercent = 0;
    if (salaryData.percentUsed !== undefined && !isNaN(salaryData.percentUsed)) {
      calculatedPercent = salaryData.percentUsed;
    } else {
      // Fallback calculation
      if (!salaryData.salaryCap || salaryData.salaryCap === 0) {
        console.log('📊 percentUsed: No salaryCap, returning 0');
        return 0;
      }
      calculatedPercent = (salaryData.totalSalary || 0) / salaryData.salaryCap * 100;
    }
    
    const result = Math.min(Math.max(Number(calculatedPercent), 0), 100);
    console.log('📊 percentUsed calculated:', {
      percentUsed: salaryData.percentUsed,
      totalSalary: salaryData.totalSalary,
      salaryCap: salaryData.salaryCap,
      calculatedPercent,
      result,
    });
    return result;
  }, [salaryData?.totalSalary, salaryData?.salaryCap, salaryData?.percentUsed]);

  // Get current lineup players for requirement checking
  const currentLineupPlayers = useMemo(() => {
    if (!lineupPositions || !availablePlayers) return [];
    return lineupPositions
      .map(lp => availablePlayers.find(p => p.player_id === lp.player_id))
      .filter((p): p is DFSPlayer => p !== undefined);
  }, [lineupPositions, availablePlayers]);

  // Check if lineup requirements are fulfilled
  const requirementChecks = useMemo(() => {
    if (!pool?.lineup_requirements || !currentLineupPlayers.length) return [];
    
    const reqs = pool.lineup_requirements;
    const checks: Array<{ label: string; fulfilled: boolean }> = [];
    
    // Team-specific requirements
    if (reqs.min_players_from_teams && Array.isArray(reqs.min_players_from_teams)) {
      reqs.min_players_from_teams.forEach((teamReq: { team: string; min: number }) => {
        const count = currentLineupPlayers.filter(p => p.player_team === teamReq.team).length;
        checks.push({
          label: `Min ${teamReq.min} ${teamReq.team} player${teamReq.min > 1 ? 's' : ''}`,
          fulfilled: count >= teamReq.min
        });
      });
    }
    
    if (reqs.max_players_from_teams && Array.isArray(reqs.max_players_from_teams)) {
      reqs.max_players_from_teams.forEach((teamReq: { team: string; max: number }) => {
        const count = currentLineupPlayers.filter(p => p.player_team === teamReq.team).length;
        checks.push({
          label: `Max ${teamReq.max} ${teamReq.team} player${teamReq.max > 1 ? 's' : ''}`,
          fulfilled: count <= teamReq.max
        });
      });
    }
    
    // Required players
    if (reqs.required_player_ids && Array.isArray(reqs.required_player_ids)) {
      const requiredIds = reqs.required_player_ids.map((id: number) => id.toString());
      const foundIds = currentLineupPlayers
        .map(p => p.nba_player_id?.toString())
        .filter((id): id is string => id !== undefined);
      const missing = requiredIds.filter(id => !foundIds.includes(id));
      
      if (requiredIds.length > 0) {
        checks.push({
          label: `Required player${requiredIds.length > 1 ? 's' : ''} (${requiredIds.length})`,
          fulfilled: missing.length === 0
        });
      }
    }
    
    // Excluded players
    if (reqs.excluded_player_ids && Array.isArray(reqs.excluded_player_ids)) {
      const excludedIds = reqs.excluded_player_ids.map((id: number) => id.toString());
      const foundIds = currentLineupPlayers
        .map(p => p.nba_player_id?.toString())
        .filter((id): id is string => id !== undefined);
      const hasExcluded = excludedIds.some(id => foundIds.includes(id));
      
      if (excludedIds.length > 0) {
        checks.push({
          label: `No excluded player${excludedIds.length > 1 ? 's' : ''} (${excludedIds.length})`,
          fulfilled: !hasExcluded
        });
      }
    }
    
    // Min different teams
    if (reqs.min_different_teams) {
      const uniqueTeams = new Set(currentLineupPlayers.map(p => p.player_team).filter(Boolean));
      checks.push({
        label: `Min ${reqs.min_different_teams} different team${reqs.min_different_teams > 1 ? 's' : ''}`,
        fulfilled: uniqueTeams.size >= reqs.min_different_teams
      });
    }
    
    // Max players same team
    if (reqs.max_players_same_team) {
      const teamCounts = new Map<string, number>();
      currentLineupPlayers.forEach(p => {
        if (p.player_team) {
          teamCounts.set(p.player_team, (teamCounts.get(p.player_team) || 0) + 1);
        }
      });
      const maxCount = Math.max(...Array.from(teamCounts.values()), 0);
      checks.push({
        label: `Max ${reqs.max_players_same_team} from same team`,
        fulfilled: maxCount <= reqs.max_players_same_team
      });
    }
    
    // Max rookies
    if (reqs.max_rookies) {
      // Note: We'd need to check if players are rookies - for now, assume we don't have that data
      // This would require joining with nba_players table to check years_pro or similar
      // checks.push({
      //   label: `Max ${reqs.max_rookies} rookie${reqs.max_rookies > 1 ? 's' : ''}`,
      //   fulfilled: true // Placeholder
      // });
    }
    
    return checks;
  }, [pool?.lineup_requirements, currentLineupPlayers]);

  // Handle adding player to lineup
  const handleAddPlayer = async (player: DFSPlayer, slot: LineupPosition) => {
    if (!poolId || !user?.id) return;

    const playerSalary = player.salary;
    const currentTotal = salaryData?.totalSalary || 0;
    const cap = salaryData?.salaryCap || 0;

    if (currentTotal + playerSalary > cap) {
      alert(`Cannot add player - would exceed salary cap by ${formatSalary((currentTotal + playerSalary) - cap)}`);
      return;
    }

    await setLineupPosition.mutateAsync({
      poolId,
      userId: user.id,
      playerId: player.player_id,
      lineupUnit: slot.lineup_unit,
      unitPosition: slot.unit_position,
      multiplier: slot.multiplier,
    });
  };

  // Handle removing player from lineup
  const handleRemovePlayer = async (slot: LineupPosition) => {
    if (!poolId || !user?.id) return;

    await removeLineupPosition.mutateAsync({
      poolId,
      userId: user.id,
      lineupUnit: slot.lineup_unit,
      unitPosition: slot.unit_position,
    });
  };

  // Handle submitting lineup
  const handleSubmitLineup = async () => {
    if (!poolId || !user?.id) return;

    if (salaryData?.playerCount !== 10) {
      alert('You must fill all 10 lineup spots before submitting.');
      return;
    }

    if (salaryData?.isOverCap) {
      alert('Your lineup exceeds the salary cap. Please adjust before submitting.');
      return;
    }

    try {
      const result = await submitLineup.mutateAsync({
        poolId,
        userId: user.id,
      });

      alert(result.message);
      onSuccess?.();
    } catch (error: any) {
      alert(error.message || 'Failed to submit lineup');
    }
  };

  console.log('📊 DFSLineupBuilder render state:', {
    poolLoading,
    playersLoading,
    lineupLoading,
    salaryLoading,
    hasPool: !!pool,
    poolId,
    entryId,
    hasUser: !!user?.id,
  });

  if (poolLoading || playersLoading || lineupLoading || salaryLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress />
        <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
          {poolLoading ? 'Loading pool...' : 
           playersLoading ? 'Loading players...' : 
           lineupLoading ? 'Loading lineup...' : 
           'Loading salary data...'}
        </Typography>
      </Box>
    );
  }

  if (!pool) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Alert color="danger">Pool not found</Alert>
      </Box>
    );
  }

  // Format lock time
  const formatLockTime = (lockTime: string | null | undefined) => {
    if (!lockTime) return 'N/A';
    try {
      const date = new Date(lockTime);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <Box sx={{ bgcolor: '#000000', color: '#FFFFFF' }}>
      {/* Pool Details Header */}
      <Box sx={{ 
        mb: 1, 
        p: 1.5, 
        bgcolor: '#1a1a1a', 
        borderRadius: 'sm',
        border: '1px solid #333333',
      }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography 
            level="title-md" 
            sx={{ 
              fontSize: '1rem',
              color: '#FFFFFF',
              fontWeight: 'bold',
            }}
          >
            {pool.name}
          </Typography>
          <Chip 
            size="sm" 
            variant="soft" 
            color={
              pool.difficulty_tier === 'elite' ? 'danger' :
              pool.difficulty_tier === 'pro' ? 'warning' : 'success'
            }
            sx={{
              fontSize: '0.7rem',
            }}
          >
            {pool.difficulty_tier === 'elite' ? 'Elite' :
             pool.difficulty_tier === 'pro' ? 'Pro' : 'Standard'}
          </Chip>
          <Typography level="body-sm" sx={{ color: '#999', fontSize: '0.75rem' }}>
            {pool.slate_name}
          </Typography>
          <Typography level="body-sm" sx={{ color: '#999', fontSize: '0.75rem' }}>
            • {pool.slate_date ? new Date(pool.slate_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
          </Typography>
          <Typography level="body-sm" sx={{ color: '#999', fontSize: '0.75rem' }}>
            • Locks: {formatLockTime(pool.lock_time)}
          </Typography>
          {pool.entry_fee > 0 && (
            <Typography level="body-sm" sx={{ color: '#999', fontSize: '0.75rem' }}>
              • Entry: ${parseFloat(pool.entry_fee.toString()).toFixed(2)}
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Lineup Requirements Display */}
      {pool?.lineup_requirements && requirementChecks.length > 0 && (
        <Box sx={{ 
          mb: 1, 
          p: 1.5, 
          bgcolor: '#1a1a1a', 
          borderRadius: 'sm',
          border: '1px solid #333333',
        }}>
          <Typography 
            level="body-xs" 
            sx={{ 
              fontSize: '0.7rem',
              color: '#999',
              mb: 1,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Lineup Requirements
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {requirementChecks.map((check, index) => (
              <Chip
                key={index}
                size="sm"
                variant="soft"
                color={check.fulfilled ? 'success' : 'neutral'}
                startDecorator={
                  check.fulfilled ? (
                    <CheckCircleOutline sx={{ fontSize: 14 }} />
                  ) : (
                    <CancelOutlined sx={{ fontSize: 14 }} />
                  )
                }
                sx={{
                  fontSize: '0.7rem',
                  bgcolor: check.fulfilled ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  color: check.fulfilled ? '#4CAF50' : '#999',
                  border: `1px solid ${check.fulfilled ? '#4CAF50' : '#333'}`,
                }}
              >
                {check.label}
              </Chip>
            ))}
          </Stack>
        </Box>
      )}
      
      {/* Main Content: Full Width Lineup */}
      <DFSBasketballCourt
          startersPlayers={[
            courtPlayers['starters-0'],
            courtPlayers['starters-1'],
            courtPlayers['starters-2'],
            courtPlayers['starters-3'],
            courtPlayers['starters-4'],
          ]}
          rotationPlayers={[
            courtPlayers['rotation-0'],
            courtPlayers['rotation-1'],
            courtPlayers['rotation-2'],
          ]}
          benchPlayers={[
            courtPlayers['bench-0'],
            courtPlayers['bench-1'],
          ]}
          availablePlayers={availablePlayersForSelection.map(convertToPlayer)}
          availablePlayersSalaries={playerSalaries}
          poolSalaryCap={salaryData?.salaryCap}
          currentLineupTotal={salaryData?.totalSalary}
          poolGames={poolGames || []}
          onAddPlayer={(player, unit, index) => {
            const slot = lineupStructure.find(
              (s) => s.lineup_unit === unit && s.unit_position === index
            );
            if (slot) {
              const dfsPlayer = availablePlayers?.find((p) => p.player_id === player.id);
              if (dfsPlayer) {
                handleAddPlayer(dfsPlayer, slot);
              }
            }
          }}
          onRemovePlayer={(player, unit, index) => {
            const slot = lineupStructure.find(
              (s) => s.lineup_unit === unit && s.unit_position === index
            );
            if (slot) handleRemovePlayer(slot);
          }}
          onPlayerClick={(player) => {
            if (player?.nbaPlayerId) {
              onPlayerClick?.(player.nbaPlayerId);
            }
          }}
          salaryData={{
            starters: lineupStructure.slice(0, 5).map((slot) => {
              const lp = lineupPositions?.find(
                (p) => p.unit === slot.lineup_unit && p.unit_position === slot.unit_position
              );
              const player = lp && availablePlayers?.find((p) => p.player_id === lp.player_id);
              return player?.salary || 0;
            }),
            rotation: lineupStructure.slice(5, 8).map((slot) => {
              const lp = lineupPositions?.find(
                (p) => p.unit === slot.lineup_unit && p.unit_position === slot.unit_position
              );
              const player = lp && availablePlayers?.find((p) => p.player_id === lp.player_id);
              return player?.salary || 0;
            }),
            bench: lineupStructure.slice(8, 10).map((slot) => {
              const lp = lineupPositions?.find(
                (p) => p.unit === slot.lineup_unit && p.unit_position === slot.unit_position
              );
              const player = lp && availablePlayers?.find((p) => p.player_id === lp.player_id);
              return player?.salary || 0;
            }),
          }}
      />

      {/* Salary Cap Footer - Compact with Linear Progress */}
      <Box sx={{ 
        mt: 1, 
        p: 1, 
        bgcolor: '#1a1a1a', 
        borderRadius: 'sm',
        border: '1px solid #333333',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minHeight: '48px',
      }}>
        {/* Salary Info and Progress Bar */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography 
              level="body-sm" 
              sx={{ 
                fontSize: '0.75rem',
                color: '#FFFFFF',
                fontWeight: 'bold',
                minWidth: 'fit-content',
              }}
            >
              {formatSalary(salaryData?.totalSalary || 0)} / {formatSalary(salaryData?.salaryCap || 0)}
            </Typography>
            <Typography 
              level="body-xs" 
              sx={{ 
                fontSize: '0.65rem',
                color: salaryData?.isOverCap ? '#FF6B6B' : '#999',
              }}
            >
              ({salaryData?.playerCount || 0}/10)
            </Typography>
          </Box>
          <Box sx={{ width: '100%', position: 'relative' }}>
            {(() => {
              const progressValue = Math.min(Math.max(percentUsed, 0), 100);
              const trackColor = pool?.html_color_secondary || '#1a1a1a';
              const barColor = salaryData?.isOverCap 
                ? '#FF6B6B' 
                : (pool?.html_color_primary || '#FFC72C');
              
              console.log('📊 Progress bar render:', {
                progressValue,
                percentUsed,
                trackColor,
                barColor,
                poolPrimary: pool?.html_color_primary,
                poolSecondary: pool?.html_color_secondary,
                isOverCap: salaryData?.isOverCap,
                poolId: pool?.id,
                hasPool: !!pool,
              });
              
              return (
                <Box
                  sx={{
                    width: '100%',
                    height: 8,
                    borderRadius: 'sm',
                    bgcolor: trackColor,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: `${progressValue}%`,
                      bgcolor: barColor,
                      transition: 'width 0.4s linear',
                      borderRadius: 'sm',
                      zIndex: 1,
                    }}
                  />
                </Box>
              );
            })()}
          </Box>
        </Box>

        {/* Submit Button */}
        <IconButton
          size="md"
          color="success"
          onClick={handleSubmitLineup}
          disabled={salaryData?.playerCount !== 10 || salaryData?.isOverCap}
          loading={submitLineup.isPending}
          sx={{ 
            minWidth: '120px',
            height: 36,
            bgcolor: salaryData?.playerCount === 10 && !salaryData?.isOverCap ? '#FFC72C' : '#333333',
            color: salaryData?.playerCount === 10 && !salaryData?.isOverCap ? '#000000' : '#FFFFFF',
            '&:hover': {
              bgcolor: salaryData?.playerCount === 10 && !salaryData?.isOverCap ? '#FFD700' : '#444444',
            },
            '&:disabled': {
              bgcolor: '#333333',
              color: '#FFFFFF',
            },
          }}
        >
          <CheckCircle sx={{ fontSize: 20, mr: 0.5 }} />
          <Typography level="body-sm" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
            Submit
          </Typography>
        </IconButton>
      </Box>
    </Box>
  );
}

