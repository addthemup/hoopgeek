import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Input,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Sheet,
  Button,
  Table,
  Stack,
  Select,
  Option,
  Divider,
} from '@mui/joy';
import { Close, Search, ArrowBack, ChevronLeft, ChevronRight, Add as AddIcon } from '@mui/icons-material';
import { formatSalary } from '../hooks/useDFSLineupSalary';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { FANDUEL_SCORING } from '../utils/fantasyScoring';

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

interface PoolGame {
  game_id: string;
  home_team: string;
  away_team: string;
}

interface DFSBasketballCourtProps {
  startersPlayers: (Player | null)[];
  rotationPlayers: (Player | null)[];
  benchPlayers: (Player | null)[];
  availablePlayers: Player[];
  availablePlayersSalaries?: Record<string, number>; // Map of player ID to salary
  poolGames?: PoolGame[]; // Games in this pool for matchup filters
  onAddPlayer?: (player: Player, unit: 'starters' | 'rotation' | 'bench', index: number) => void;
  onRemovePlayer?: (player: Player, unit: 'starters' | 'rotation' | 'bench', index: number) => void;
  onPlayerClick?: (player: Player) => void;
  salaryData?: {
    starters: number[];
    rotation: number[];
    bench: number[];
  };
  poolSalaryCap?: number; // Pool's salary cap limit
  currentLineupTotal?: number; // Current total salary of all players in lineup
  poolId?: string; // Pool ID for fetching live stats
  poolStatus?: 'scheduled' | 'live' | 'completed'; // Pool status for live scoring
}

export default function DFSBasketballCourt({
  startersPlayers,
  rotationPlayers,
  benchPlayers,
  availablePlayers,
  availablePlayersSalaries,
  poolGames,
  onAddPlayer,
  onRemovePlayer,
  onPlayerClick,
  salaryData,
  poolSalaryCap,
  currentLineupTotal,
  poolId,
  poolStatus,
}: DFSBasketballCourtProps) {
  const [selectedSlot, setSelectedSlot] = useState<{ unit: 'starters' | 'rotation' | 'bench'; index: number; position: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState<string | null>(null);
  const [salaryFilter, setSalaryFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  // Track previous points for animations
  const [previousPoints, setPreviousPoints] = useState<Record<string, number>>({});
  const [pointAnimations, setPointAnimations] = useState<Record<string, { value: number; key: number }>>({});
  
  // Get all players in lineup for live stats
  const allLineupPlayers = useMemo(() => {
    const players: Player[] = [];
    [...startersPlayers, ...rotationPlayers, ...benchPlayers].forEach(p => {
      if (p && p.nbaPlayerId) players.push(p);
    });
    return players;
  }, [startersPlayers, rotationPlayers, benchPlayers]);
  
  // Fetch live stats for players in lineup (only if pool is live)
  const { data: liveStats } = useQuery({
    queryKey: ['dfs-lineup-live-stats', poolId, allLineupPlayers.map(p => p.nbaPlayerId)],
    queryFn: async () => {
      if (!poolId || !poolGames || poolGames.length === 0 || poolStatus !== 'live') return {};
      
      const gameIds = poolGames.map(g => g.game_id);
      const nbaPlayerIds = allLineupPlayers.map(p => p.nbaPlayerId).filter((id): id is number => id !== undefined);
      
      if (nbaPlayerIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('live_player_stats')
        .select('nba_player_id, stats')
        .in('game_id', gameIds)
        .in('nba_player_id', nbaPlayerIds);
      
      if (error) {
        console.error('Error fetching live stats:', error);
        return {};
      }
      
      // Calculate fantasy points for each player
      const statsMap: Record<number, number> = {};
      (data || []).forEach((player: any) => {
        const stats = player.stats || {};
        const fantasyPoints = FANDUEL_SCORING.calculatePoints({
          pts: stats.pts || 0,
          reb: stats.reb || 0,
          ast: stats.ast || 0,
          stl: stats.stl || 0,
          blk: stats.blk || 0,
          tov: stats.tov || 0,
        } as any);
        statsMap[player.nba_player_id] = fantasyPoints;
      });
      
      return statsMap;
    },
    enabled: !!poolId && poolStatus === 'live' && allLineupPlayers.length > 0,
    refetchInterval: poolStatus === 'live' ? 30000 : false, // Refetch every 30 seconds if live
  });
  
  // Track point changes and trigger animations
  useEffect(() => {
    if (!liveStats || Object.keys(liveStats).length === 0) return;
    
    const newAnimations: Record<string, { value: number; key: number }> = {};
    
    Object.entries(liveStats).forEach(([playerId, currentPoints]) => {
      const key = `player-${playerId}`;
      const prevPoints = previousPoints[key] || 0;
      
      if (currentPoints > prevPoints && prevPoints > 0) {
        const diff = currentPoints - prevPoints;
        newAnimations[key] = { value: diff, key: Date.now() };
        
        // Auto-remove animation after 2 seconds
        setTimeout(() => {
          setPointAnimations(prev => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
          });
        }, 2000);
      }
    });
    
    if (Object.keys(newAnimations).length > 0) {
      setPointAnimations(prev => ({ ...prev, ...newAnimations }));
    }
    
    // Update previous points
    const newPrevious: Record<string, number> = {};
    Object.entries(liveStats).forEach(([playerId, points]) => {
      newPrevious[`player-${playerId}`] = points;
    });
    setPreviousPoints(prev => ({ ...prev, ...newPrevious }));
  }, [liveStats]);

  // Fetch average fantasy points per game for all available players
  const { data: playerFantasyPoints } = useQuery<Record<number, number>>({
    queryKey: ['player-fantasy-points-avg', availablePlayers.map(p => p.nbaPlayerId)],
    queryFn: async () => {
      if (!availablePlayers || availablePlayers.length === 0) return {};

      const nbaPlayerIds = availablePlayers
        .map(p => p.nbaPlayerId)
        .filter((id): id is number => id !== undefined);

      if (nbaPlayerIds.length === 0) return {};

      // Get current season year (NBA season runs Oct-June, e.g., 2025-26 season starts Oct 2025)
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth(); // 0-11, where 0 is January
      // If we're in Oct-Dec, it's the start of the season (e.g., Oct 2025 = 2025-26 season)
      // If we're in Jan-June, it's the same season year (e.g., Jan 2026 = 2025-26 season)
      const seasonYear = currentMonth >= 9 ? currentYear : currentYear - 1;

      // Fetch box scores for this season
      const { data: boxscores, error } = await supabase
        .from('nba_boxscores')
        .select('nba_player_id, pts, reb, ast, stl, blk, tov')
        .in('nba_player_id', nbaPlayerIds)
        .gte('game_date', `${seasonYear}-10-01`)
        .lte('game_date', `${seasonYear + 1}-06-30`)
        .gt('min', 0); // Only games where player played

      if (error) {
        console.error('Error fetching fantasy points:', error);
        return {};
      }

      // Calculate average fantasy points per game for each player
      const fantasyPointsMap: Record<number, { total: number; games: number }> = {};

      boxscores?.forEach((boxscore) => {
        const fp = FANDUEL_SCORING.calculatePoints({
          pts: boxscore.pts || 0,
          reb: boxscore.reb || 0,
          ast: boxscore.ast || 0,
          stl: boxscore.stl || 0,
          blk: boxscore.blk || 0,
          tov: boxscore.tov || 0,
        } as any);

        if (!fantasyPointsMap[boxscore.nba_player_id]) {
          fantasyPointsMap[boxscore.nba_player_id] = { total: 0, games: 0 };
        }
        fantasyPointsMap[boxscore.nba_player_id].total += fp;
        fantasyPointsMap[boxscore.nba_player_id].games += 1;
      });

      // Calculate averages
      const avgMap: Record<number, number> = {};
      Object.entries(fantasyPointsMap).forEach(([playerId, data]) => {
        avgMap[parseInt(playerId)] = data.games > 0 ? data.total / data.games : 0;
      });

      return avgMap;
    },
    enabled: availablePlayers.length > 0,
  });

  const handleSlotClick = (unit: 'starters' | 'rotation' | 'bench', index: number, position: string, player: Player | null) => {
    if (player) {
      // If slot has a player, do nothing (removed navigation to player page)
      return;
    } else {
      // If slot is empty, show player selector in the same card
      setSelectedSlot({ unit, index, position });
    }
  };

  const handleBack = () => {
    setSelectedSlot(null);
    setSearchQuery('');
    setGameFilter(null);
    setSalaryFilter(null);
    setCurrentPage(1);
  };

  const handlePlayerSelect = (player: Player) => {
    if (selectedSlot && onAddPlayer) {
      // Validate salary cap before adding
      if (poolSalaryCap && currentLineupTotal !== undefined && availablePlayersSalaries) {
        const playerSalary = availablePlayersSalaries[player.id] || 0;
        const newTotal = currentLineupTotal + playerSalary;
        
        if (newTotal > poolSalaryCap) {
          const overAmount = newTotal - poolSalaryCap;
          alert(
            `⚠️ SALARY CAP EXCEEDED\n\n` +
            `Cannot add ${player.name} (${formatSalary(playerSalary)}).\n\n` +
            `Current lineup: ${formatSalary(currentLineupTotal)}\n` +
            `After adding: ${formatSalary(newTotal)}\n` +
            `Salary cap: ${formatSalary(poolSalaryCap)}\n` +
            `Over by: ${formatSalary(overAmount)}\n\n` +
            `Please remove a player or choose someone with a lower salary.`
          );
          return;
        }
      }
      
      onAddPlayer(player, selectedSlot.unit, selectedSlot.index);
      setSearchQuery('');
      setGameFilter(null);
      setSalaryFilter(null);
      setSelectedSlot(null);
    }
  };

  // Get unique matchups from poolGames
  const matchups = (poolGames || []).map(game => ({
    id: game.game_id,
    label: `${game.away_team} @ ${game.home_team}`,
    teams: [game.away_team, game.home_team],
  }));

  // Filter players by position and search
  const filteredAvailablePlayers = availablePlayers.filter((player) => {
    // Search filter
    if (searchQuery && !player.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Game filter (by matchup)
    if (gameFilter) {
      const matchup = matchups.find(m => m.id === gameFilter);
      if (matchup && !matchup.teams.includes(player.team)) {
        return false;
      }
    }

    // Salary filter
    if (salaryFilter && availablePlayersSalaries) {
      const salary = availablePlayersSalaries[player.id] || 0;
      switch (salaryFilter) {
        case '<10M':
          if (salary >= 10000000) return false;
          break;
        case '10-20M':
          if (salary < 10000000 || salary >= 20000000) return false;
          break;
        case '20-30M':
          if (salary < 20000000 || salary >= 30000000) return false;
          break;
        case '30-40M':
          if (salary < 30000000 || salary >= 40000000) return false;
          break;
        case '>40M':
          if (salary < 40000000) return false;
          break;
      }
    }

    // Position filter based on selected slot
    if (selectedSlot) {
      const slotPosition = selectedSlot.position;
      const playerPos = player.position?.toUpperCase() || '';

      // Map slot positions to player positions
      if (slotPosition === 'G' && !playerPos.includes('G')) return false;
      if (slotPosition === 'F' && !playerPos.includes('F')) return false;
      if (slotPosition === 'C' && !playerPos.includes('C')) return false;
      // UTIL and BN can be any position
    }

    return true;
  });

  // Sort by fantasy points per game (descending)
  const sortedFilteredPlayers = useMemo(() => {
    return [...filteredAvailablePlayers].sort((a, b) => {
      const aFp = playerFantasyPoints?.[a.nbaPlayerId || 0] || 0;
      const bFp = playerFantasyPoints?.[b.nbaPlayerId || 0] || 0;
      return bFp - aFp; // Descending order
    });
  }, [filteredAvailablePlayers, playerFantasyPoints]);

  // Pagination logic
  const totalPages = Math.ceil(sortedFilteredPlayers.length / rowsPerPage);
  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return sortedFilteredPlayers.slice(startIndex, endIndex);
  }, [sortedFilteredPlayers, currentPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, gameFilter, salaryFilter, playerFantasyPoints]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const renderPlayerSlot = (
    player: Player | null,
    position: string,
    unit: 'starters' | 'rotation' | 'bench',
    index: number,
    salary?: number
  ) => {
    const isEmpty = !player;

    return (
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: { xs: 0.5, sm: 1 },
          p: { xs: 1, sm: 2 },
          borderRadius: 'md',
          bgcolor: isEmpty ? '#1a1a1a' : '#000000',
          border: '2px dashed',
          borderColor: isEmpty ? '#333333' : '#555555',
          width: { xs: 80, sm: 120 },
          minWidth: { xs: 80, sm: 120 },
          maxWidth: { xs: 80, sm: 120 },
          minHeight: { xs: 140, sm: 180 },
          maxHeight: { xs: 140, sm: 180 },
          cursor: isEmpty ? 'pointer' : 'default',
          transition: 'border-color 0.2s, transform 0.2s',
          overflow: 'hidden',
          '&:hover': {
            transform: isEmpty ? 'translateY(-4px)' : 'none',
            boxShadow: isEmpty ? 'md' : 'none',
            borderColor: isEmpty ? 'primary.solidBg' : '#555555',
          },
        }}
        onClick={() => isEmpty && handleSlotClick(unit, index, position, player)}
      >
        {/* Position Label */}
        <Chip
          size="sm"
          variant="soft"
          color={
            unit === 'starters' ? 'success' : unit === 'rotation' ? 'warning' : 'primary'
          }
        >
          {position}
        </Chip>

        {isEmpty ? (
          <>
            <Avatar
              sx={{
                '--Avatar-size': { xs: '48px', sm: '64px' },
                bgcolor: '#333333',
                color: '#FFFFFF',
              }}
            >
              ?
            </Avatar>
            <Typography level="body-sm" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, color: '#FFFFFF' }}>
              Empty
            </Typography>
          </>
        ) : (
          <>
            {/* Remove Button */}
            {onRemovePlayer && (
              <IconButton
                size="sm"
                color="danger"
                variant="solid"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePlayer(player, unit, index);
                }}
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  zIndex: 10,
                  minWidth: { xs: 24, sm: 32 },
                  minHeight: { xs: 24, sm: 32 },
                }}
              >
                <Close sx={{ fontSize: { xs: 14, sm: 18 } }} />
              </IconButton>
            )}

            {/* Player Avatar */}
            <Avatar
              src={player.avatar}
              sx={{ '--Avatar-size': { xs: '48px', sm: '64px' } }}
            >
              {player.name.charAt(0)}
            </Avatar>

            {/* Player Info */}
            <Box sx={{ textAlign: 'center', width: '100%', overflow: 'hidden' }}>
              <Typography 
                level="body-sm" 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: { xs: '0.7rem', sm: '0.875rem' },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: '#FFFFFF',
                }}
              >
                {player.name.split(' ').pop()}
              </Typography>
              <Typography 
                level="body-xs" 
                sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, color: '#FFFFFF' }}
              >
                {player.team}
              </Typography>
            </Box>

            {/* Salary */}
            {salary !== undefined && (
              <Chip 
                size="sm" 
                variant="solid" 
                sx={{ 
                  fontSize: { xs: '0.6rem', sm: '0.75rem' },
                  bgcolor: '#FFFFFF',
                  color: '#000000',
                  fontWeight: 'bold',
                }}
              >
                {formatSalary(salary)}
              </Chip>
            )}
          </>
        )}
      </Box>
    );
  };

  const renderLineupTab = (unit: 'starters' | 'rotation' | 'bench') => {
    let players: (Player | null)[] = [];
    let positions: string[] = [];
    let salaries: number[] = [];

    if (unit === 'starters') {
      players = startersPlayers;
      positions = ['G', 'G', 'F', 'F', 'C']; // Guard, Guard, Forward, Forward, Center
      salaries = salaryData?.starters || [];
    } else if (unit === 'rotation') {
      players = rotationPlayers;
      positions = ['UTIL', 'UTIL', 'UTIL'];
      salaries = salaryData?.rotation || [];
    } else {
      players = benchPlayers;
      positions = ['BN', 'BN'];
      salaries = salaryData?.bench || [];
    }

    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: unit === 'starters' ? 'repeat(5, 1fr)' : 'repeat(3, 1fr)',
          },
          gap: { xs: 1, sm: 2 },
          p: { xs: 1, sm: 2, md: 3 },
        }}
      >
        {players.map((player, index) => (
          <React.Fragment key={`${unit}-${index}`}>
            {renderPlayerSlot(player, positions[index], unit, index, salaries[index])}
          </React.Fragment>
        ))}
      </Box>
    );
  };

  return (
    <Card sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
      <CardContent sx={{ bgcolor: '#000000' }}>
        {selectedSlot ? (
          // Player Selection View with Table
          <Box sx={{ 
            width: '100%', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography level="title-lg" sx={{ color: '#FFFFFF' }}>
                Select {selectedSlot.position}
              </Typography>
              <Button
                variant="plain"
                size="sm"
                startDecorator={<ArrowBack />}
                onClick={handleBack}
                sx={{
                  color: '#FFFFFF',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                Back
              </Button>
            </Box>

            {/* Filter Header - Seamlessly integrated */}
            <Box sx={{ 
              mb: 1, 
              p: 1.5, 
              bgcolor: '#1a1a1a', 
              borderRadius: 'sm',
              border: '1px solid #333333'
            }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {/* Search Bar */}
                <Input
                  placeholder="Search players..."
                  startDecorator={<Search />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="sm"
                  sx={{ 
                    flex: 1,
                    minWidth: 200,
                    bgcolor: '#000000',
                    border: '1px solid #333333',
                    '& input': {
                      color: '#FFFFFF',
                    },
                    '&::placeholder': {
                      color: '#999',
                    },
                  }}
                />

                {/* Game Filter */}
                <Select
                  size="sm"
                  value={gameFilter || 'all'}
                  onChange={(_, value) => setGameFilter(value === 'all' ? null : value as string)}
                  sx={{ 
                    minWidth: 150,
                    bgcolor: '#000000',
                    border: '1px solid #333333',
                    '& .MuiSelect-select': {
                      color: '#FFFFFF',
                    },
                  }}
                >
                  <Option value="all">All Games</Option>
                  {matchups.map((matchup) => (
                    <Option key={matchup.id} value={matchup.id}>
                      {matchup.label}
                    </Option>
                  ))}
                </Select>

                {/* Salary Filter */}
                <Select
                  size="sm"
                  value={salaryFilter || 'all'}
                  onChange={(_, value) => setSalaryFilter(value === 'all' ? null : value as string)}
                  sx={{ 
                    minWidth: 120,
                    bgcolor: '#000000',
                    border: '1px solid #333333',
                    '& .MuiSelect-select': {
                      color: '#FFFFFF',
                    },
                  }}
                >
                  <Option value="all">All Salaries</Option>
                  <Option value="<10M">&lt; 10M</Option>
                  <Option value="10-20M">10-20M</Option>
                  <Option value="20-30M">20-30M</Option>
                  <Option value="30-40M">30-40M</Option>
                  <Option value=">40M">&gt; 40M</Option>
                </Select>
              </Stack>
            </Box>

            {/* Player Table */}
            <Sheet sx={{ 
              flex: 1, 
              overflow: 'hidden', 
              borderRadius: 'sm',
              bgcolor: '#1a1a1a',
              border: '1px solid #333333'
            }}>
              <Table 
                stickyHeader
                sx={{
                  '& thead th': {
                    bgcolor: '#000000',
                    color: '#FFFFFF',
                    borderBottom: '2px solid #333333',
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    py: 1,
                    px: 1.5,
                  },
                  '& tbody td': {
                    borderBottom: '1px solid #333333',
                    py: 1.5,
                    px: 1.5,
                  },
                  '& tbody tr': {
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: '#333333',
                    },
                  },
                }}
              >
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>Avatar</th>
                    <th>Player</th>
                    <th style={{ width: '100px' }}>Team</th>
                    <th style={{ width: '100px' }}>Status</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>FP/G</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                          No available players found
                        </Typography>
                      </td>
                    </tr>
                  ) : (
                    paginatedPlayers.map((player) => {
                      const playerSalary = availablePlayersSalaries?.[player.id] || 0;
                      const salaryFormatted = formatSalary(playerSalary);
                      const avgFp = playerFantasyPoints?.[player.nbaPlayerId || 0] || 0;
                      const hasInjury = player.injuryStatus && ['Out', 'Questionable', 'Day-to-Day'].includes(player.injuryStatus);
                      return (
                        <tr 
                          key={player.id} 
                          onClick={() => handlePlayerSelect(player)}
                        >
                          <td>
                            <Avatar 
                              src={player.avatar} 
                              size="sm" 
                              sx={{ width: 36, height: 36 }}
                            >
                              {player.name.charAt(0)}
                            </Avatar>
                          </td>
                          <td>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: '#FFFFFF',
                              }}
                            >
                              {player.name}
                            </Typography>
                          </td>
                          <td>
                            <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                              {player.team}
                            </Typography>
                          </td>
                          <td>
                            {hasInjury ? (
                              <Chip
                                size="sm"
                                variant="solid"
                                color={
                                  player.injuryStatus === 'Out' ? 'danger' :
                                  player.injuryStatus === 'Questionable' ? 'warning' :
                                  'warning'
                                }
                                sx={{
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                }}
                              >
                                {player.injuryStatus}
                              </Chip>
                            ) : (
                              <Typography level="body-xs" sx={{ color: '#666', fontSize: '0.7rem' }}>
                                Healthy
                              </Typography>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: '#FFC72C',
                              }}
                            >
                              {avgFp > 0 ? avgFp.toFixed(1) : '-'}
                            </Typography>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: '#FFFFFF',
                              }}
                            >
                              {salaryFormatted}
                            </Typography>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  p: 1.5,
                  borderTop: '1px solid #333333',
                  bgcolor: '#000000'
                }}>
                  <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                    Showing {((currentPage - 1) * rowsPerPage) + 1} - {Math.min(currentPage * rowsPerPage, sortedFilteredPlayers.length)} of {sortedFilteredPlayers.length} players
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      sx={{
                        borderColor: '#333333',
                        color: '#FFFFFF',
                        '&:disabled': {
                          opacity: 0.5,
                        },
                        '&:hover:not(:disabled)': {
                          bgcolor: '#333333',
                        },
                      }}
                    >
                      <ChevronLeft />
                    </IconButton>
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', minWidth: '60px', textAlign: 'center' }}>
                      Page {currentPage} / {totalPages}
                    </Typography>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      sx={{
                        borderColor: '#333333',
                        color: '#FFFFFF',
                        '&:disabled': {
                          opacity: 0.5,
                        },
                        '&:hover:not(:disabled)': {
                          bgcolor: '#333333',
                        },
                      }}
                    >
                      <ChevronRight />
                    </IconButton>
                  </Stack>
                </Box>
              )}
            </Sheet>
          </Box>
        ) : (
          // Lineup Tabs View
          <Tabs 
            value={activeTab} 
            onChange={(_, value) => setActiveTab(value as any)}
            sx={{
              bgcolor: '#000000',
              '& .MuiTabList-root': {
                bgcolor: '#000000',
                borderBottom: '2px solid #333333',
              },
              '& .MuiTab-root': {
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: '#1a1a1a',
                },
                '&.Mui-selected': {
                  color: '#FFC72C',
                  bgcolor: '#000000',
                },
              },
            }}
          >
            <TabList>
              <Tab value="starters" color="success">
                Starters (5) • 1.0×
              </Tab>
              <Tab value="rotation" color="warning">
                Rotation (3) • 0.75×
              </Tab>
              <Tab value="bench" color="primary">
                Bench (2) • 0.5×
              </Tab>
            </TabList>

            <Box sx={{ mt: 2 }}>
              {activeTab === 'starters' && renderLineupTab('starters')}
              {activeTab === 'rotation' && renderLineupTab('rotation')}
              {activeTab === 'bench' && renderLineupTab('bench')}
            </Box>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

