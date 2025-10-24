import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  Alert,
  LinearProgress,
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
} from '@mui/joy';
import {
  TrendingUp,
  CheckCircle,
  Search,
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

  if (poolLoading || playersLoading || lineupLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
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

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography level="h3" sx={{ mb: 0.5 }}>
              {pool.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="sm" variant="soft">
                {pool.slate_name}
              </Chip>
              <Typography level="body-sm" color="neutral">
                Entry: {pool.entry_fee === 0 ? 'FREE' : `$${pool.entry_fee}`}
              </Typography>
              <Typography level="body-sm" color="neutral">
                • Prize: ${pool.prize_pool.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          <Button
            size="lg"
            color="success"
            startDecorator={<CheckCircle />}
            onClick={handleSubmitLineup}
            disabled={salaryData?.playerCount !== 10 || salaryData?.isOverCap}
            loading={submitLineup.isPending}
          >
            Submit Lineup
          </Button>
        </Box>

        {/* Salary Cap Display */}
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography level="title-md">Salary Cap</Typography>
              <Typography
                level="h4"
                color={salaryData?.isOverCap ? 'danger' : 'success'}
              >
                {formatSalary(salaryData?.totalSalary || 0)} / {formatSalary(salaryData?.salaryCap || 0)}
              </Typography>
            </Box>
            <LinearProgress
              determinate
              value={Math.min(salaryData?.percentUsed || 0, 100)}
              color={salaryData?.isOverCap ? 'danger' : 'primary'}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography level="body-sm" color="neutral">
                {salaryData?.playerCount || 0} / 10 Players
              </Typography>
              <Typography level="body-sm" color={salaryData?.isOverCap ? 'danger' : 'neutral'}>
                {salaryData?.isOverCap ? 'Over Cap!' : `${formatSalary(salaryData?.remainingSalary || 0)} remaining`}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Main Content: Court Only */}
      <Box>
        {/* Basketball Court */}
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
      </Box>
    </Box>
  );
}

