import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Tabs,
  TabList,
  Tab,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Modal,
  ModalDialog,
  ModalClose,
  Input,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Sheet,
} from '@mui/joy';
import { Close, Search } from '@mui/icons-material';
import { formatSalary } from '../hooks/useDFSLineupSalary';

interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  jerseyNumber?: number | string;
  nbaPlayerId?: number;
  avatar: string;
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
}: DFSBasketballCourtProps) {
  const [activeTab, setActiveTab] = useState<'starters' | 'rotation' | 'bench'>('starters');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ unit: 'starters' | 'rotation' | 'bench'; index: number; position: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState<string | null>(null);
  const [salaryFilter, setSalaryFilter] = useState<string | null>(null);

  const handleSlotClick = (unit: 'starters' | 'rotation' | 'bench', index: number, position: string, player: Player | null) => {
    if (player) {
      // If slot has a player, navigate to player page
      onPlayerClick?.(player);
    } else {
      // If slot is empty, open modal to select a player
      setSelectedSlot({ unit, index, position });
      setModalOpen(true);
    }
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
      setModalOpen(false);
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
          bgcolor: isEmpty ? 'background.level1' : 'background.surface',
          border: '2px dashed',
          borderColor: isEmpty ? 'divider' : 'primary.outlinedBorder',
          minWidth: { xs: 80, sm: 120 },
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 'md',
            borderColor: 'primary.solidBg',
          },
        }}
        onClick={() => handleSlotClick(unit, index, position, player)}
      >
        {/* Position Label */}
        <Chip
          size="sm"
          variant="soft"
          color={
            unit === 'starters' ? 'success' : unit === 'rotation' ? 'warning' : 'neutral'
          }
        >
          {position}
        </Chip>

        {isEmpty ? (
          <>
            <Avatar
              sx={{
                '--Avatar-size': { xs: '48px', sm: '64px' },
                bgcolor: 'background.level2',
                color: 'text.tertiary',
              }}
            >
              ?
            </Avatar>
            <Typography level="body-sm" color="neutral" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
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
                  whiteSpace: 'nowrap'
                }}
              >
                {player.name.split(' ').pop()}
              </Typography>
              <Typography 
                level="body-xs" 
                color="neutral"
                sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
              >
                {player.team}
              </Typography>
            </Box>

            {/* Salary */}
            {salary !== undefined && (
              <Chip size="sm" variant="outlined" sx={{ fontSize: { xs: '0.6rem', sm: '0.75rem' } }}>
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
        {players.map((player, index) =>
          renderPlayerSlot(player, positions[index], unit, index, salaries[index])
        )}
      </Box>
    );
  };

  return (
    <>
      <Card>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2 }}>
            Your Lineup
          </Typography>

          <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as any)}>
            <TabList>
              <Tab value="starters" color="success">
                Starters (5) • 1.0×
              </Tab>
              <Tab value="rotation" color="warning">
                Rotation (3) • 0.75×
              </Tab>
              <Tab value="bench" color="neutral">
                Bench (2) • 0.5×
              </Tab>
            </TabList>

            <Box sx={{ mt: 2 }}>
              {activeTab === 'starters' && renderLineupTab('starters')}
              {activeTab === 'rotation' && renderLineupTab('rotation')}
              {activeTab === 'bench' && renderLineupTab('bench')}
            </Box>
          </Tabs>
        </CardContent>
      </Card>

      {/* Player Selection Modal */}
      <Modal open={modalOpen} onClose={() => {
        setModalOpen(false);
        setSearchQuery('');
        setGameFilter(null);
        setSalaryFilter(null);
      }}>
        <ModalDialog sx={{ 
          width: { xs: '100vw', sm: 500 },
          maxWidth: { xs: '100vw', sm: 600 },
          height: { xs: '100vh', sm: 'auto' },
          maxHeight: { xs: '100vh', sm: '85vh' },
          p: { xs: 1.25, sm: 3 },
          m: { xs: 0, sm: 2 },
          borderRadius: { xs: 0, sm: 'md' },
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ModalClose />
          <Box sx={{ 
            width: '100%', 
            maxWidth: '100%', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0
          }}>
            <Typography level="h4" sx={{ mb: 1, fontSize: { xs: '1.1rem', sm: '1.5rem' }, pr: 4, flexShrink: 0 }}>
              {selectedSlot ? `${selectedSlot.position}` : 'Select Player'}
            </Typography>

            {/* Search */}
            <Input
              placeholder="Search..."
              startDecorator={<Search />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
              sx={{ mb: 1, width: '100%', maxWidth: '100%', flexShrink: 0 }}
            />

            {/* Game/Matchup Filter */}
            <Box sx={{ mb: 1, width: '100%', maxWidth: '100%', overflow: 'hidden', flexShrink: 0 }}>
              <Typography level="body-sm" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                Game
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 0.5, 
                overflowX: 'auto',
                pb: 0.5,
                width: '100%',
                maxWidth: '100%',
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'neutral.300', borderRadius: 2 }
              }}>
                <Chip
                  size="sm"
                  variant={gameFilter === null ? 'solid' : 'outlined'}
                  onClick={() => setGameFilter(null)}
                  sx={{ cursor: 'pointer', fontSize: { xs: '0.65rem', sm: '0.75rem' }, flexShrink: 0 }}
                >
                  All
                </Chip>
                {matchups.map((matchup) => (
                  <Chip
                    key={matchup.id}
                    size="sm"
                    variant={gameFilter === matchup.id ? 'solid' : 'outlined'}
                    onClick={() => setGameFilter(matchup.id)}
                    sx={{ cursor: 'pointer', fontSize: { xs: '0.65rem', sm: '0.75rem' }, flexShrink: 0 }}
                  >
                    {matchup.label}
                  </Chip>
                ))}
              </Box>
            </Box>

            {/* Salary Filter */}
            <Box sx={{ mb: 1, width: '100%', maxWidth: '100%', overflow: 'hidden', flexShrink: 0 }}>
              <Typography level="body-sm" sx={{ mb: 0.5, fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                Salary
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 0.5, 
                overflowX: 'auto',
                pb: 0.5,
                width: '100%',
                maxWidth: '100%',
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'neutral.300', borderRadius: 2 }
              }}>
                <Chip
                  size="sm"
                  variant={salaryFilter === null ? 'solid' : 'outlined'}
                  onClick={() => setSalaryFilter(null)}
                  sx={{ cursor: 'pointer', fontSize: { xs: '0.65rem', sm: '0.75rem' }, flexShrink: 0 }}
                >
                  All
                </Chip>
                <Chip
                  size="sm"
                  variant={salaryFilter === '<10M' ? 'solid' : 'outlined'}
                  onClick={() => setSalaryFilter('<10M')}
                  sx={{ cursor: 'pointer', fontSize: { xs: '0.65rem', sm: '0.75rem' }, flexShrink: 0 }}
                >
                  &lt; 10M
                </Chip>
                <Chip
                  size="sm"
                  variant={salaryFilter === '10-20M' ? 'solid' : 'outlined'}
                  onClick={() => setSalaryFilter('10-20M')}
                  sx={{ cursor: 'pointer', fontSize: { xs: '0.65rem', sm: '0.75rem' }, flexShrink: 0 }}
                >
                  10-20M
                </Chip>
                <Chip
                  size="sm"
                  variant={salaryFilter === '20-30M' ? 'solid' : 'outlined'}
                  onClick={() => setSalaryFilter('20-30M')}
                  sx={{ cursor: 'pointer', fontSize: { xs: '0.65rem', sm: '0.75rem' }, flexShrink: 0 }}
                >
                  20-30M
                </Chip>
                <Chip
                  size="sm"
                  variant={salaryFilter === '30-40M' ? 'solid' : 'outlined'}
                  onClick={() => setSalaryFilter('30-40M')}
                  sx={{ cursor: 'pointer', fontSize: { xs: '0.65rem', sm: '0.75rem' }, flexShrink: 0 }}
                >
                  30-40M
                </Chip>
                <Chip
                  size="sm"
                  variant={salaryFilter === '>40M' ? 'solid' : 'outlined'}
                  onClick={() => setSalaryFilter('>40M')}
                  sx={{ cursor: 'pointer', fontSize: { xs: '0.65rem', sm: '0.75rem' }, flexShrink: 0 }}
                >
                  &gt; 40M
                </Chip>
              </Box>
            </Box>

            {/* Player List */}
            <Sheet sx={{ 
              flex: 1, 
              overflow: 'auto', 
              borderRadius: 'sm',
              minHeight: 0,
              width: '100%'
            }}>
              <List size="sm" sx={{ width: '100%', maxWidth: '100%' }}>
                {filteredAvailablePlayers.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography level="body-sm" color="neutral">
                      No available players found
                    </Typography>
                  </Box>
                ) : (
                  filteredAvailablePlayers.map((player) => {
                    const playerSalary = availablePlayersSalaries?.[player.id] || 0;
                    const salaryFormatted = formatSalary(playerSalary);
                    return (
                      <ListItem key={player.id} sx={{ px: 0, width: '100%', maxWidth: '100%' }}>
                        <ListItemButton 
                          onClick={() => handlePlayerSelect(player)} 
                          sx={{ 
                            py: { xs: 0.75, sm: 1.5 },
                            px: { xs: 1, sm: 2 },
                            gap: { xs: 1, sm: 1.5 },
                            width: '100%',
                            maxWidth: '100%',
                            overflow: 'hidden'
                          }}
                        >
                          <ListItemDecorator sx={{ minWidth: 'auto' }}>
                            <Avatar 
                              src={player.avatar} 
                              size="sm" 
                              sx={{ width: { xs: 30, sm: 40 }, height: { xs: 30, sm: 40 } }}
                            >
                              {player.name.charAt(0)}
                            </Avatar>
                          </ListItemDecorator>
                          <ListItemContent sx={{ minWidth: 0, overflow: 'hidden' }}>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                fontWeight: 'bold', 
                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {player.name}
                            </Typography>
                            <Typography 
                              level="body-xs" 
                              color="neutral" 
                              sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                            >
                              {player.position} • {player.team}
                            </Typography>
                          </ListItemContent>
                          <Typography 
                            level="body-sm" 
                            sx={{ 
                              fontWeight: 'bold', 
                              fontSize: { xs: '0.7rem', sm: '0.875rem' }, 
                              flexShrink: 0,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {salaryFormatted}
                          </Typography>
                        </ListItemButton>
                      </ListItem>
                    );
                  })
                )}
              </List>
            </Sheet>
          </Box>
        </ModalDialog>
      </Modal>
    </>
  );
}

