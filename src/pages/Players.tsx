import { useState, useEffect, useMemo, memo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Select,
  Option,
  Stack,
  Button,
  Alert,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Switch,
  Input,
  IconButton,
  Snackbar,
  FormControl,
  FormLabel,
  Table,
  Divider,
  LinearProgress,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeagues';
import { usePlayersPaginated } from '../hooks/useNBAData';
// import { useTeams } from '../hooks/useTeams';
import { useAddPlayerToRoster } from '../hooks/useRosterManagement';
import { usePlayerComprehensive } from '../hooks/usePlayerComprehensive';
import { usePlayerUpcomingGames } from '../hooks/usePlayerUpcomingGames';
import { Player as DatabasePlayer } from '../types';
import PlayerActionButtons from '../components/PlayerActionButtons';
import { Add, Flag, Search, FilterList, NavigateBefore, NavigateNext, Clear, ArrowBack, CalendarToday } from '@mui/icons-material';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  avatar: string;
  status: string;
  opponent: string;
  gameStatus: string;
  projection: number;
  score: number | string;
  opponentRank: string;
  startPercent: number;
  rosterPercent: number;
  rosterChange: number;
  positionRank: number;
  seasonPoints: number;
  average: number;
  lastGame: number;
  isRostered: boolean;
  isWatched: boolean;
  nba_player_id: number;
}

interface PlayersProps {
  leagueId: string;
}

// Memoized PlayersTable component to prevent unnecessary re-renders
const PlayersTable = memo(({ 
  players, 
  playersLoading, 
  playersError, 
  onPlayerClick, 
  onAddToRoster,
  paginatedData,
  addPlayerMutation
}: {
  players: Player[];
  playersLoading: boolean;
  playersError: Error | null;
  onPlayerClick: (player: Player) => void;
  onAddToRoster: (playerId: string, playerName: string) => void;
  paginatedData: any;
  addPlayerMutation: any;
}) => {
  if (playersLoading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <LinearProgress sx={{ width: '100%' }} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (playersError) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Alert color="danger">
            <Typography>Error loading players: {playersError.message}</Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ overflowX: 'auto' }}>
          <Table hoverRow>
            <thead>
              <tr>
                <th>Player</th>
                <th>Position</th>
                <th>Team</th>
                <th>Status</th>
                <th>Current PTS</th>
                <th>Current REB</th>
                <th>Current AST</th>
                <th>Salary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} style={{ cursor: 'pointer' }} onClick={() => onPlayerClick(player)}>
                  <td>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar 
                        size="sm" 
                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                        sx={{ 
                          bgcolor: 'primary.500',
                          '& img': {
                            objectFit: 'cover'
                          }
                        }}
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.textContent = player.name.split(' ').map((n: string) => n[0]).join('');
                          }
                        }}
                      >
                        {player.name.split(' ').map((n: string) => n[0]).join('')}
                      </Avatar>
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {player.name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          #{paginatedData?.players.find((p: any) => p.id.toString() === player.id)?.jersey_number || 'N/A'}
                        </Typography>
                      </Box>
                    </Stack>
                  </td>
                  <td>
                    <Chip size="sm" color="primary" variant="soft">
                      {player.position}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm">{player.team}</Typography>
                  </td>
                  <td>
                    <Chip 
                      size="sm" 
                      color={player.status === 'Active' ? 'success' : 'neutral'} 
                      variant="soft"
                    >
                      {player.status}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                      {player.score}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                      N/A
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                      N/A
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {paginatedData?.players.find((p: any) => p.id.toString() === player.id)?.salary 
                        ? `$${((paginatedData.players.find((p: any) => p.id.toString() === player.id)?.salary || 0) / 1000000).toFixed(1)}M`
                        : 'N/A'
                      }
                    </Typography>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outlined"
                      startDecorator={<Add />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToRoster(player.id, player.name);
                      }}
                      loading={addPlayerMutation.isPending}
                    >
                      Add
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
});


export default function Players({ leagueId }: PlayersProps) {
  const { user } = useAuth();
  const { data: league, isLoading: leagueLoading, error: leagueError } = useLeague(leagueId);
  // const { data: teams } = useTeams(leagueId || '');
  const addPlayerMutation = useAddPlayerToRoster();
  
  const [activeTab, setActiveTab] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [statsFilter, setStatsFilter] = useState('currSeason');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarColor, setSnackbarColor] = useState<'success' | 'danger'>('success');
  const [pageSize] = useState(25);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      // Reset to first page when search changes
      if (searchTerm !== debouncedSearchTerm) {
        setCurrentPage(1);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearchTerm]);

  const { 
    data: paginatedData, 
    isLoading: playersLoading, 
    error: playersError 
  } = usePlayersPaginated(currentPage, pageSize, {
    search: debouncedSearchTerm,
    position: positionFilter,
    team: teamFilter,
    showInactive: showInactive,
    leagueId
  });

  // Transform database players to display format (memoized)
  const players: Player[] = useMemo(() => {
    if (!paginatedData?.players) return [];
    
    return paginatedData.players.map((player: DatabasePlayer) => ({
      id: player.id.toString(),
      name: player.name,
      position: player.position || 'N/A',
      team: player.team_abbreviation || player.team_name || 'N/A',
      avatar: player.name.split(' ').map(n => n[0]).join(''),
      status: player.is_active ? 'Active' : 'Inactive',
      opponent: 'TBD',
      gameStatus: 'Scheduled',
      projection: 0,
      score: 0, // Current points not available in this view
      opponentRank: 'N/A',
      startPercent: 0,
      rosterPercent: 0,
      rosterChange: 0,
      positionRank: 0,
      seasonPoints: 0, // Season points not available in this view
      average: 0,
      lastGame: 0,
      isRostered: false,
      isWatched: false,
      nba_player_id: player.nba_player_id, // Add this for avatar images
    }));
  }, [paginatedData?.players]);

  const handleAddPlayer = async (playerId: string, playerName: string) => {
    if (!user) {
      setSnackbarMessage('Please sign in to add players');
      setSnackbarColor('danger');
      setSnackbarOpen(true);
      return;
    }

    try {
      await addPlayerMutation.mutateAsync({
        playerId: parseInt(playerId),
        fantasyTeamId: 'temp-team-id', // This should be the user's team ID
      });
      setSnackbarMessage(`Added ${playerName} to your roster!`);
      setSnackbarColor('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error adding player:', error);
      setSnackbarMessage(`Failed to add ${playerName}. Please try again.`);
      setSnackbarColor('danger');
      setSnackbarOpen(true);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setPositionFilter('');
    setTeamFilter('');
    setShowInactive(false);
    setCurrentPage(1);
  };

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer({ id: player.id, name: player.name });
  };

  const handleBackToPlayers = () => {
    setSelectedPlayer(null);
  };

  if (leagueLoading || playersLoading) return <Typography>Loading players...</Typography>;
  if (leagueError) return <Alert color="danger">Failed to load league data: {leagueError.message}</Alert>;
  if (playersError) return <Alert color="danger">Failed to load players data: {playersError.message}</Alert>;
  if (!league) return <Alert color="warning">League not found.</Alert>;

  // Show player detail if a player is selected
  if (selectedPlayer) {
    return (
      <EnhancedPlayerDetail
        playerId={selectedPlayer.id}
        playerName={selectedPlayer.name}
        onBack={handleBackToPlayers}
        leagueId={leagueId}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography level="h2" component="h1" sx={{ fontWeight: 'bold' }}>
          Players
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startDecorator={<FilterList />}
            onClick={() => setActiveTab(1)}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startDecorator={<Flag />}
            onClick={() => setCompareMode(!compareMode)}
            color={compareMode ? 'primary' : 'neutral'}
          >
            Compare Mode
          </Button>
        </Stack>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue as number)} sx={{ mb: 3 }}>
        <TabList>
          <Tab>All Players</Tab>
          <Tab>Filters & Search</Tab>
          <Tab>Career Stats</Tab>
          <Tab>2024-25 Game Logs</Tab>
          <Tab>Contract Data</Tab>
        </TabList>

        {/* All Players Tab */}
        <TabPanel value={0}>
          {/* Search and Quick Filters */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid xs={12} md={4}>
                  <FormControl>
                    <FormLabel>Search Players</FormLabel>
                    <Input
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      startDecorator={<Search />}
                      endDecorator={
                        searchTerm && (
                          <IconButton
                            size="sm"
                            variant="plain"
                            onClick={() => setSearchTerm('')}
                          >
                            <Clear />
                          </IconButton>
                        )
                      }
                    />
                  </FormControl>
                </Grid>
                <Grid xs={12} md={2}>
                  <FormControl>
                    <FormLabel>Position</FormLabel>
                    <Select
                      value={positionFilter}
                      onChange={(_, value) => setPositionFilter(value || '')}
                      placeholder="All"
                    >
                      <Option value="">All Positions</Option>
                      <Option value="PG">Point Guard</Option>
                      <Option value="SG">Shooting Guard</Option>
                      <Option value="SF">Small Forward</Option>
                      <Option value="PF">Power Forward</Option>
                      <Option value="C">Center</Option>
                      <Option value="G">Guard</Option>
                      <Option value="F">Forward</Option>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={12} md={2}>
                  <FormControl>
                    <FormLabel>Team</FormLabel>
                    <Select
                      value={teamFilter}
                      onChange={(_, value) => setTeamFilter(value || '')}
                      placeholder="All"
                    >
                      <Option value="">All Teams</Option>
                      <Option value="ATL">Atlanta Hawks</Option>
                      <Option value="BOS">Boston Celtics</Option>
                      <Option value="BKN">Brooklyn Nets</Option>
                      <Option value="CHA">Charlotte Hornets</Option>
                      <Option value="CHI">Chicago Bulls</Option>
                      <Option value="CLE">Cleveland Cavaliers</Option>
                      <Option value="DAL">Dallas Mavericks</Option>
                      <Option value="DEN">Denver Nuggets</Option>
                      <Option value="DET">Detroit Pistons</Option>
                      <Option value="GSW">Golden State Warriors</Option>
                      <Option value="HOU">Houston Rockets</Option>
                      <Option value="IND">Indiana Pacers</Option>
                      <Option value="LAC">LA Clippers</Option>
                      <Option value="LAL">Los Angeles Lakers</Option>
                      <Option value="MEM">Memphis Grizzlies</Option>
                      <Option value="MIA">Miami Heat</Option>
                      <Option value="MIL">Milwaukee Bucks</Option>
                      <Option value="MIN">Minnesota Timberwolves</Option>
                      <Option value="NOP">New Orleans Pelicans</Option>
                      <Option value="NYK">New York Knicks</Option>
                      <Option value="OKC">Oklahoma City Thunder</Option>
                      <Option value="ORL">Orlando Magic</Option>
                      <Option value="PHI">Philadelphia 76ers</Option>
                      <Option value="PHX">Phoenix Suns</Option>
                      <Option value="POR">Portland Trail Blazers</Option>
                      <Option value="SAC">Sacramento Kings</Option>
                      <Option value="SAS">San Antonio Spurs</Option>
                      <Option value="TOR">Toronto Raptors</Option>
                      <Option value="UTA">Utah Jazz</Option>
                      <Option value="WAS">Washington Wizards</Option>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={12} md={2}>
                  <FormControl>
                    <FormLabel>Status</FormLabel>
                    <FormControl orientation="horizontal" sx={{ gap: 1 }}>
                      <Switch
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                      />
                      <FormLabel>Show Inactive</FormLabel>
                    </FormControl>
                  </FormControl>
                </Grid>
                <Grid xs={12} md={2}>
                  <Button
                    variant="outlined"
                    onClick={clearFilters}
                    startDecorator={<Clear />}
                    sx={{ mt: 2 }}
                  >
                    Clear
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Players Table */}
          <PlayersTable
            players={players}
            playersLoading={playersLoading}
            playersError={playersError}
            onPlayerClick={handlePlayerClick}
            onAddToRoster={handleAddPlayer}
            paginatedData={paginatedData}
            addPlayerMutation={addPlayerMutation}
          />

          {/* Pagination */}
          {paginatedData && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
              <Typography level="body-sm" color="neutral">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, paginatedData.totalCount)} of {paginatedData.totalCount} players
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="sm"
                  startDecorator={<NavigateBefore />}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outlined"
                  size="sm"
                  endDecorator={<NavigateNext />}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(paginatedData.totalCount / pageSize)}
                >
                  Next
                </Button>
              </Stack>
            </Box>
          )}
        </TabPanel>

        {/* Filters Tab */}
        <TabPanel value={1}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h4" sx={{ mb: 3 }}>
                Advanced Filters
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <FormControl>
                    <FormLabel>Stats Timeframe</FormLabel>
                    <Select
                      value={statsFilter}
                      onChange={(_, value) => setStatsFilter(value || 'currSeason')}
                    >
                      <Option value="currSeason">Current Season</Option>
                      <Option value="last7">Last 7 Games</Option>
                      <Option value="last15">Last 15 Games</Option>
                      <Option value="last30">Last 30 Games</Option>
                      <Option value="career">Career</Option>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={12} md={6}>
                  <FormControl>
                    <FormLabel>Sort By</FormLabel>
                    <Select defaultValue="name">
                      <Option value="name">Name</Option>
                      <Option value="points">Points</Option>
                      <Option value="rebounds">Rebounds</Option>
                      <Option value="assists">Assists</Option>
                      <Option value="fantasy">Fantasy Points</Option>
                      <Option value="salary">Salary</Option>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Career Stats Tab */}
        <TabPanel value={2}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h4" sx={{ mb: 3 }}>
                Career Statistics Overview
              </Typography>
              <Alert color="primary">
                <Typography>
                  Click on any player in the "All Players" tab to view their comprehensive career statistics, 
                  season breakdown, and recent game logs.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </TabPanel>

        {/* 2024-25 Game Logs Tab */}
        <TabPanel value={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h4" sx={{ mb: 3 }}>
                2024-25 Game Logs
              </Typography>
              <Alert color="primary">
                <Typography>
                  Click on any player in the "All Players" tab to view their detailed 2024-25 game logs 
                  with comprehensive statistics including rankings and advanced metrics.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Contract Data Tab */}
        <TabPanel value={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h4" sx={{ mb: 3 }}>
                Contract Data
              </Typography>
              <Alert color="primary">
                <Typography>
                  Click on any player in the "All Players" tab to view their contract information including 
                  years remaining and future salary breakdown.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </TabPanel>
      </Tabs>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        color={snackbarColor}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        {snackbarMessage}
      </Snackbar>
    </Box>
  );
}

// Enhanced Player Detail Component
function EnhancedPlayerDetail({ playerId, playerName, onBack, leagueId }: { playerId: string; playerName: string; onBack: () => void; leagueId?: string }) {
  const [activeTab, setActiveTab] = useState(0);
  const [gameLogsPage, setGameLogsPage] = useState(1);
  const [gameLogsPageSize] = useState(20);
  
  const { 
    data: playerData, 
    isLoading: loading, 
    error 
  } = usePlayerComprehensive(playerId, gameLogsPage, gameLogsPageSize);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2 }}>
            Back to Players
          </Button>
          <LinearProgress sx={{ flex: 1 }} />
        </Box>
        <Typography>Loading player data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2 }}>
            Back to Players
          </Button>
        </Box>
        <Alert color="danger">
          <Typography>Error loading player data: {error.message}</Typography>
        </Alert>
      </Box>
    );
  }

  if (!playerData) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2 }}>
            Back to Players
          </Button>
        </Box>
        <Alert color="warning">
          <Typography>No player data found</Typography>
        </Alert>
      </Box>
    );
  }

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString();
  };

  const formatPercentage = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatSalary = (salary: number | undefined) => {
    if (salary === undefined || salary === null) return 'N/A';
    return `$${(salary / 1000000).toFixed(1)}M`;
  };

  const formatHeight = (height: string | undefined) => {
    if (!height || height === 'N/A') return 'N/A';
    
    // If height is already in feet-inches format, return as-is
    if (height.includes('-')) return height;
    
    // Convert inches to feet-inches format
    const totalInches = parseInt(height);
    if (isNaN(totalInches)) return height;
    
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    
    return `${feet}'${inches}"`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Player Info Card */}
        <Grid xs={12} md={4}>
          <Card variant="outlined" sx={{ height: 'fit-content', position: 'relative' }}>
            <CardContent>
              {/* Action Buttons positioned in top right corner of card */}
              <Box sx={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 2
              }}>
                <PlayerActionButtons
                  playerId={parseInt(playerId)}
                  playerName={playerName}
                  leagueId={leagueId}
                />
              </Box>
              
              <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
                {/* Back Button */}
                <Button 
                  variant="outlined" 
                  startDecorator={<ArrowBack />} 
                  onClick={onBack} 
                  size="sm"
                  sx={{ alignSelf: 'flex-start', mb: 1 }}
                >
                  Back
                </Button>
                
                <Avatar
                  size="lg"
                  src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerData.player.nba_player_id}.png`}
                  sx={{ 
                    width: 120, 
                    height: 120,
                    bgcolor: 'primary.500',
                    fontSize: '2rem',
                    '& img': {
                      objectFit: 'cover'
                    }
                  }}
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.textContent = playerData.player.name.split(' ').map((n: string) => n[0]).join('');
                    }
                  }}
                >
                  {playerData.player.name.split(' ').map((n: string) => n[0]).join('')}
                </Avatar>
                
                <Box>
                  <Typography level="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {playerData.player.name}
                  </Typography>
                  <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
                    #{playerData.player.jersey_number || 'N/A'} • {playerData.player.position || 'N/A'} • {playerData.player.team_name || 'N/A'}
                  </Typography>
                  
                  <Chip 
                    color="primary" 
                    variant="soft"
                    size="lg"
                    sx={{ mb: 2 }}
                  >
                    {playerData.player.position || 'N/A'}
                  </Chip>
                </Box>

                <Divider sx={{ width: '100%' }} />

                <Stack spacing={1} sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Height</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{formatHeight(playerData.player.height)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Weight</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.weight ? `${playerData.player.weight} lbs` : 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Age</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.age || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Experience</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.years_pro ? `${playerData.player.years_pro} years` : 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">College</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.college || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Draft</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {playerData.player.draft_year ? `${playerData.player.draft_year} • Round ${playerData.player.draft_round} • Pick ${playerData.player.draft_number}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Birth Place</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {playerData.player.birth_city && playerData.player.birth_state ? `${playerData.player.birth_city}, ${playerData.player.birth_state}` : playerData.player.birth_country || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Salary</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {formatSalary(playerData.player.salary_2025_26)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Status</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {playerData.player.is_active ? 'Active' : 'Inactive'}
                      {playerData.player.is_rookie && ' • Rookie'}
                    </Typography>
                  </Box>
                  {playerData.player.team_city && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Team City</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.team_city}</Typography>
                    </Box>
                  )}
                  {playerData.player.roster_status && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Roster Status</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.roster_status}</Typography>
                    </Box>
                  )}
                  {playerData.player.country && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Country</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.country}</Typography>
                    </Box>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Stats Cards */}
        <Grid xs={12} md={8}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue as number)}>
            <TabList>
              <Tab>Career Stats</Tab>
              <Tab>Season Breakdown</Tab>
              <Tab>2024-25 Game Logs</Tab>
              <Tab>Contract Data</Tab>
              <Tab>Upcoming Games</Tab>
            </TabList>

            <TabPanel value={0}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Career Statistics
                  </Typography>
                  
                  {playerData.careerStats ? (
                    <>
                      <Grid container spacing={2}>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                              {formatNumber(playerData.careerStats.pts)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Career Points</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                              {formatNumber(playerData.careerStats.reb)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Career Rebounds</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                              {formatNumber(playerData.careerStats.ast)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Career Assists</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                              {formatNumber(playerData.careerStats.fantasy_pts)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Career Fantasy Pts</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3 }} />

                      <Grid container spacing={2}>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatNumber(playerData.careerStats.gp)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Games Played</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatNumber(playerData.careerStats.stl)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Steals</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatNumber(playerData.careerStats.blk)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Blocks</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(playerData.careerStats.fg_pct)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">FG%</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(playerData.careerStats.fg3_pct)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">3P%</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(playerData.careerStats.ft_pct)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">FT%</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </>
                  ) : (
                    <Alert color="warning">
                      <Typography>No career statistics available</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={1}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Season Breakdown
                  </Typography>
                  
                  {playerData.seasonBreakdown && playerData.seasonBreakdown.length > 0 ? (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table hoverRow size="sm">
                        <thead>
                          <tr>
                            <th>Season</th>
                            <th>Team</th>
                            <th>Age</th>
                            <th>GP</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>FG%</th>
                            <th>3P%</th>
                            <th>FT%</th>
                            <th>Fantasy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerData.seasonBreakdown.map((season, index) => (
                            <tr key={index}>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                  {season.season_id}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {season.team_abbreviation}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {season.player_age}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {season.gp}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                                  {season.pts}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                                  {season.reb}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                  {season.ast}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {formatPercentage(season.fg_pct)}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {formatPercentage(season.fg3_pct)}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {formatPercentage(season.ft_pct)}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                                  {season.fantasy_pts}
                                </Typography>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Box>
                  ) : (
                    <Alert color="warning">
                      <Typography>No season breakdown available</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    2024-25 Game Logs
                  </Typography>
                  
                  {playerData.recentGameLogs && playerData.recentGameLogs.length > 0 ? (
                    <>
                      <Box sx={{ overflowX: 'auto' }}>
                        <Table hoverRow size="sm">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Matchup</th>
                              <th>Result</th>
                              <th>Min</th>
                              <th>PTS</th>
                              <th>REB</th>
                              <th>AST</th>
                              <th>STL</th>
                              <th>BLK</th>
                              <th>FG%</th>
                              <th>3P%</th>
                              <th>FT%</th>
                              <th>Fantasy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {playerData.recentGameLogs.map((game, index) => (
                              <tr key={index}>
                                <td>
                                  <Typography level="body-sm">
                                    {new Date(game.game_date).toLocaleDateString()}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {game.matchup}
                                  </Typography>
                                </td>
                                <td>
                                  <Chip size="sm" color={game.wl === 'W' ? 'success' : 'danger'} variant="soft">
                                    {game.wl}
                                  </Chip>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {game.min || 'N/A'}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                                    {game.pts || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                                    {game.reb || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                    {game.ast || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {game.stl || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {game.blk || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatPercentage(game.fg_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatPercentage(game.fg3_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatPercentage(game.ft_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                                    {game.nba_fantasy_pts || 0}
                                  </Typography>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </Box>

                      {/* Game Logs Pagination */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                        <Typography level="body-sm" color="neutral">
                          Showing {((gameLogsPage - 1) * gameLogsPageSize) + 1} to {Math.min(gameLogsPage * gameLogsPageSize, playerData.gameLogsPagination.total)} of {playerData.gameLogsPagination.total} games
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="outlined"
                            size="sm"
                            startDecorator={<NavigateBefore />}
                            onClick={() => setGameLogsPage(gameLogsPage - 1)}
                            disabled={gameLogsPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outlined"
                            size="sm"
                            endDecorator={<NavigateNext />}
                            onClick={() => setGameLogsPage(gameLogsPage + 1)}
                            disabled={gameLogsPage >= playerData.gameLogsPagination.totalPages}
                          >
                            Next
                          </Button>
                        </Stack>
                      </Box>
                    </>
                  ) : (
                    <Alert color="warning">
                      <Typography>No 2024-25 game logs available</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Contract Data
                  </Typography>
                  
                  {playerData.player ? (
                    <>
                      <Grid container spacing={2}>
                        <Grid xs={12} sm={6}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                              {playerData.player.contract_years_remaining || 0}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Years Remaining</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={12} sm={6}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                              ${playerData.player.salary_2025_26 ? (playerData.player.salary_2025_26 / 1000000).toFixed(1) + 'M' : 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Current Salary (2025-26)</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3 }} />

                      <Typography level="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Future Salary Breakdown
                      </Typography>
                      
                      <Grid container spacing={2}>
                        {playerData.player.salary_2026_27 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.salary_2026_27 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2026-27</Typography>
                            </Box>
                          </Grid>
                        )}
                        {playerData.player.salary_2027_28 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.salary_2027_28 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2027-28</Typography>
                            </Box>
                          </Grid>
                        )}
                        {playerData.player.salary_2028_29 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.salary_2028_29 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2028-29</Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>

                      {(!playerData.player.salary_2026_27 && 
                        !playerData.player.salary_2027_28 && !playerData.player.salary_2028_29) && (
                        <Alert color="warning" sx={{ mt: 2 }}>
                          <Typography>
                            No future contract data available for this player.
                          </Typography>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <Alert color="warning">
                      <Typography>No contract data available for this player.</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={4}>
              <UpcomingGamesTab playerId={playerId} />
            </TabPanel>
          </Tabs>
        </Grid>
      </Grid>
    </Box>
  );
}

// Upcoming Games Tab Component
function UpcomingGamesTab({ playerId }: { playerId: string }) {
  const { data: upcomingGames, isLoading, error } = usePlayerUpcomingGames(playerId);

  if (isLoading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CalendarToday color="primary" />
            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
              Upcoming Games
            </Typography>
          </Box>
          <LinearProgress />
          <Typography sx={{ mt: 2 }}>Loading upcoming games...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CalendarToday color="primary" />
            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
              Upcoming Games
            </Typography>
          </Box>
          <Alert color="danger">
            <Typography>Error loading upcoming games: {error.message}</Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!upcomingGames || upcomingGames.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CalendarToday color="primary" />
            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
              Upcoming Games
            </Typography>
          </Box>
          <Alert color="neutral">
            <Typography>No upcoming games found for this player's team.</Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const formatGameDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatGameTime = (timeString?: string) => {
    if (!timeString) return 'TBD';
    const time = new Date(`2000-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <CalendarToday color="primary" />
          <Typography level="h4" sx={{ fontWeight: 'bold' }}>
            Upcoming Games - 2025-26 Season
          </Typography>
        </Box>

        <Table hoverRow>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Matchup</th>
              <th>Location</th>
              <th>Fantasy Week</th>
            </tr>
          </thead>
          <tbody>
            {upcomingGames.map((game) => (
              <tr
                key={game.id}
                style={{
                  borderLeft: game.is_week_start ? '4px solid #000' : 'none',
                  borderRight: game.is_week_end ? '4px solid #000' : 'none',
                  backgroundColor: game.is_week_start || game.is_week_end ? '#f5f5f5' : 'transparent'
                }}
              >
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {formatGameDate(game.game_date)}
                  </Typography>
                  {(game.is_week_start || game.is_week_end) && (
                    <Chip
                      size="sm"
                      color="primary"
                      variant="solid"
                      sx={{ mt: 0.5, fontSize: '0.7rem' }}
                    >
                      {game.is_week_start ? 'Week Start' : 'Week End'}
                    </Chip>
                  )}
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatGameTime(game.game_time_est)}
                  </Typography>
                </td>
                <td>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {game.away_team_tricode}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      @
                    </Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {game.home_team_tricode}
                    </Typography>
                  </Box>
                </td>
                <td>
                  <Typography level="body-sm">
                    {game.arena_name && game.arena_city 
                      ? `${game.arena_city}` 
                      : 'TBD'
                    }
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {game.fantasy_week_name || 'TBD'}
                  </Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Alert color="neutral" sx={{ mt: 2 }}>
          <Typography level="body-sm">
            <strong>Note:</strong> Games with bold black borders mark the start and end of fantasy weeks. 
            This helps you plan your lineup changes for optimal scoring periods.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
}