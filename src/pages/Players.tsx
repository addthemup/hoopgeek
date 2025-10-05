import React, { useState, useEffect, useMemo } from 'react';
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
  Tooltip,
  Snackbar,
  FormControl,
  FormLabel,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeagues';
import { usePlayersPaginated } from '../hooks/useNBAData';
import { useTeams } from '../hooks/useTeams';
import { useAddPlayerToRoster } from '../hooks/useRosterManagement';
import { Player as DatabasePlayer } from '../types';
import PlayerDetail from '../components/PlayerDetail';
import { Add, Flag, Search, FilterList, NavigateBefore, NavigateNext, Clear } from '@mui/icons-material';

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
}

interface PlayersProps {
  leagueId: string;
}

export default function Players({ leagueId }: PlayersProps) {
  const { user } = useAuth();
  const { data: league, isLoading: leagueLoading, error: leagueError } = useLeague(leagueId);
  const { data: teams } = useTeams(leagueId || '');
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
  const transformPlayer = useMemo(() => (dbPlayer: DatabasePlayer): Player => {
    const stats = dbPlayer.stats || {
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      field_goal_percentage: 0,
      free_throw_percentage: 0,
      three_point_percentage: 0,
    };

    // Calculate fantasy points (simple formula: PTS + REB + AST + STL + BLK - TO)
    const fantasyPoints = stats.points + stats.rebounds + stats.assists + stats.steals + stats.blocks - stats.turnovers;
    
    return {
      id: dbPlayer.id?.toString() || 'unknown',
      name: dbPlayer.name || 'Unknown Player',
      position: dbPlayer.position || 'N/A',
      team: dbPlayer.team_abbreviation || dbPlayer.team_name || 'N/A',
      avatar: `https://cdn.nba.com/headshots/nba/latest/260x190/${dbPlayer.nba_player_id || 'unknown'}.png`,
      status: dbPlayer.is_active === true ? 'Active' : 'Inactive',
      opponent: 'TBD', // This would come from schedule data
      gameStatus: 'TBD', // This would come from schedule data
      projection: Math.round((fantasyPoints * 1.1) * 10) / 10, // Simple projection
      score: '--',
      opponentRank: 'TBD',
      startPercent: Math.random() * 100, // Mock data for now
      rosterPercent: Math.random() * 100, // Mock data for now
      rosterChange: (Math.random() - 0.5) * 10, // Mock data for now
      positionRank: Math.floor(Math.random() * 50) + 1, // Mock data for now
      seasonPoints: Math.round(fantasyPoints * 10) / 10,
      average: Math.round(fantasyPoints * 10) / 10,
      lastGame: Math.round(fantasyPoints * 10) / 10,
      isRostered: false,
      isWatched: false,
    };
  }, []); // Empty dependency array since this function doesn't depend on any props/state

  const players = useMemo(() => 
    paginatedData?.players ? paginatedData.players.map(transformPlayer) : [], 
    [paginatedData?.players, transformPlayer]
  );

  const tabs = useMemo(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'news', label: 'News' },
    { id: 'projections', label: 'Projections' },
    { id: 'ranks', label: 'Ranks' },
    { id: 'recommends', label: 'Recommends' },
  ], []);

  const positions = useMemo(() => ['', 'PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'], []);

  // Reset to page 1 when position filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [positionFilter]);

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'neutral';
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'questionable': return 'warning';
      case 'doubtful': return 'danger';
      case 'out': return 'danger';
      default: return 'neutral';
    }
  };

  const getRosterChangeColor = (change: number) => {
    if (change > 0) return 'success';
    if (change < 0) return 'danger';
    return 'neutral';
  };

  const handleAddPlayer = async (player: Player) => {
    // Find the user's team in this league
    const userTeam = teams?.find(team => team.user_id === user?.id);
    
    if (!userTeam) {
      setSnackbarMessage('You don\'t have a team in this league yet');
      setSnackbarColor('danger');
      setSnackbarOpen(true);
      return;
    }

    try {
      await addPlayerMutation.mutateAsync({
        playerId: parseInt(player.id),
        fantasyTeamId: userTeam.id,
      });
      
      setSnackbarMessage(`Successfully added ${player.name} to your roster!`);
      setSnackbarColor('success');
      setSnackbarOpen(true);
    } catch (error: any) {
      setSnackbarMessage(error.message || 'Failed to add player to roster');
      setSnackbarColor('danger');
      setSnackbarOpen(true);
    }
  };

  const handleWatchPlayer = (player: Player) => {
    console.log('Watching player:', player.name);
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
      <PlayerDetail
        playerId={selectedPlayer.id}
        playerName={selectedPlayer.name}
        onBack={handleBackToPlayers}
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
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Switch
            checked={compareMode}
            onChange={(event) => setCompareMode(event.target.checked)}
            startDecorator="Compare Players"
            size="sm"
          />
          <Select
            value={statsFilter}
            onChange={(event, newValue) => setStatsFilter(newValue || 'currSeason')}
            sx={{ minWidth: 150 }}
          >
            <Option value="currSeason">2025 season</Option>
            <Option value="lastSeason">2024 season</Option>
            <Option value="projections">2025 Projections</Option>
          </Select>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(event, newValue) => setActiveTab(newValue as number)}
        >
          <TabList>
            {tabs.map((tab, index) => (
              <Tab key={tab.id} value={index}>
                {tab.label}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </Box>

      {/* Filters */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              startDecorator={<Search />}
              size="sm"
            />
            
            <Stack direction="row" spacing={1}>
              <Select
                placeholder="Position"
                value={positionFilter}
                onChange={(_, value) => {
                  setPositionFilter(value as string);
                  setCurrentPage(1);
                }}
                size="sm"
                sx={{ flex: 1 }}
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
              
              <Select
                placeholder="Team"
                value={teamFilter}
                onChange={(_, value) => {
                  setTeamFilter(value as string);
                  setCurrentPage(1);
                }}
                size="sm"
                sx={{ flex: 1 }}
              >
                <Option value="">All Teams</Option>
                <Option value="ATL">Hawks</Option>
                <Option value="BKN">Nets</Option>
                <Option value="BOS">Celtics</Option>
                <Option value="CHA">Hornets</Option>
                <Option value="CHI">Bulls</Option>
                <Option value="CLE">Cavaliers</Option>
                <Option value="DAL">Mavericks</Option>
                <Option value="DEN">Nuggets</Option>
                <Option value="DET">Pistons</Option>
                <Option value="GSW">Warriors</Option>
                <Option value="HOU">Rockets</Option>
                <Option value="IND">Pacers</Option>
                <Option value="LAC">Clippers</Option>
                <Option value="LAL">Lakers</Option>
                <Option value="MEM">Grizzlies</Option>
                <Option value="MIA">Heat</Option>
                <Option value="MIL">Bucks</Option>
                <Option value="MIN">Timberwolves</Option>
                <Option value="NOP">Pelicans</Option>
                <Option value="NYK">Knicks</Option>
                <Option value="OKC">Thunder</Option>
                <Option value="ORL">Magic</Option>
                <Option value="PHI">76ers</Option>
                <Option value="PHX">Suns</Option>
                <Option value="POR">Trail Blazers</Option>
                <Option value="SAC">Kings</Option>
                <Option value="SAS">Spurs</Option>
                <Option value="TOR">Raptors</Option>
                <Option value="UTA">Jazz</Option>
                <Option value="WAS">Wizards</Option>
              </Select>
              
              <Button
                size="sm"
                variant="outlined"
                startDecorator={<Clear />}
                onClick={clearFilters}
                sx={{ minWidth: 'auto' }}
              >
                Clear
              </Button>
            </Stack>
            
            {/* Show Inactive Players Toggle */}
            <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
              <FormLabel>Show inactive players</FormLabel>
              <Switch
                checked={showInactive}
                onChange={(event) => {
                  setShowInactive(event.target.checked);
                  setCurrentPage(1);
                }}
                size="sm"
              />
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Players Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--joy-palette-divider)' }}>
                  <th colSpan={1} style={{ textAlign: 'center', padding: '12px', backgroundColor: 'var(--joy-palette-background-surface)', fontWeight: 'bold' }}>
                    Players
                  </th>
                  <th colSpan={1} style={{ textAlign: 'center', padding: '12px', backgroundColor: 'var(--joy-palette-background-surface)', fontWeight: 'bold' }}>
                    Actions
                  </th>
                  <th colSpan={8} style={{ textAlign: 'center', padding: '12px', backgroundColor: 'var(--joy-palette-background-surface)', fontWeight: 'bold' }}>
                    NBA Week 5
                  </th>
                  <th colSpan={4} style={{ textAlign: 'center', padding: '12px', backgroundColor: 'var(--joy-palette-background-surface)', fontWeight: 'bold' }}>
                    2025 season
                  </th>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--joy-palette-divider)' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Player</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Action</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Opp</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>STATUS</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Proj</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Score</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>OPRK</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>%ST</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>%ROST</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>+/-</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>PRK</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>FPTS</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Avg</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Last</th>
                </tr>
              </thead>
              <tbody>
                {players && players.length > 0 ? (
                  players.map((player, index) => (
                  <tr 
                    key={player.id}
                    style={{ 
                      borderBottom: '1px solid var(--joy-palette-divider)',
                      backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--joy-palette-background-surface)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--joy-palette-primary-50)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : 'var(--joy-palette-background-surface)';
                    }}
                  >
                    {/* Player Column */}
                    <td style={{ padding: '12px', width: '230px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar 
                          src={player.avatar} 
                          alt={player.name}
                          size="lg"
                          sx={{ width: 48, height: 48 }}
                        />
                        <Box>
                          <Typography 
                            level="body-sm" 
                            sx={{ 
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              '&:hover': {
                                color: 'primary.500',
                                textDecoration: 'underline'
                              }
                            }}
                            onClick={() => handlePlayerClick(player)}
                          >
                            {player.name}
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            {player.team} • {player.position}
                          </Typography>
                        </Box>
                      </Box>
                    </td>

                    {/* Action Column */}
                    <td style={{ padding: '8px', width: '100px', textAlign: 'center' }}>
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="Add Player">
                          <IconButton
                            size="sm"
                            color="primary"
                            variant="solid"
                            onClick={() => handleAddPlayer(player)}
                          >
                            <Add />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Watch Player">
                          <IconButton
                            size="sm"
                            variant="outlined"
                            color={player.isWatched ? 'primary' : 'neutral'}
                            onClick={() => handleWatchPlayer(player)}
                          >
                            <Flag />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </td>

                    {/* Opponent Column */}
                    <td style={{ padding: '8px', width: '60px', textAlign: 'center' }}>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                        {player.opponent}
                      </Typography>
                    </td>

                    {/* Game Status Column */}
                    <td style={{ padding: '8px', textAlign: 'left' }}>
                      <Typography level="body-sm">
                        {player.gameStatus}
                      </Typography>
                    </td>

                    {/* Projection Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                        {player.projection}
                      </Typography>
                    </td>

                    {/* Score Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm">
                        {player.score}
                      </Typography>
                    </td>

                    {/* Opponent Rank Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm">
                        {player.opponentRank}
                      </Typography>
                    </td>

                    {/* Start Percent Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm">
                        {player.startPercent}%
                      </Typography>
                    </td>

                    {/* Roster Percent Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm">
                        {player.rosterPercent}%
                      </Typography>
                    </td>

                    {/* Roster Change Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography 
                        level="body-sm" 
                        sx={{ 
                          color: getRosterChangeColor(player.rosterChange) === 'success' ? 'success.500' : 
                                getRosterChangeColor(player.rosterChange) === 'danger' ? 'danger.500' : 'text.primary',
                          fontWeight: 'bold'
                        }}
                      >
                        {player.rosterChange > 0 ? '+' : ''}{player.rosterChange}%
                      </Typography>
                    </td>

                    {/* Position Rank Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                        {player.positionRank}
                      </Typography>
                    </td>

                    {/* Season Points Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                        {player.seasonPoints}
                      </Typography>
                    </td>

                    {/* Average Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm">
                        {player.average}
                      </Typography>
                    </td>

                    {/* Last Game Column */}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Typography level="body-sm">
                        {player.lastGame}
                      </Typography>
                    </td>
                  </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '40px' }}>
                      <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                        No players found matching your criteria.
                      </Typography>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Box>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {paginatedData && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                Showing {((paginatedData.currentPage - 1) * pageSize) + 1} to {Math.min(paginatedData.currentPage * pageSize, paginatedData.totalCount)} of {paginatedData.totalCount} players
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="sm"
                  startDecorator={<NavigateBefore />}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!paginatedData.hasPreviousPage}
                >
                  Previous
                </Button>
                
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {/* Show page numbers */}
                  {Array.from({ length: Math.min(5, paginatedData.totalPages) }, (_, i) => {
                    let pageNum;
                    if (paginatedData.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= paginatedData.totalPages - 2) {
                      pageNum = paginatedData.totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "solid" : "outlined"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        sx={{ minWidth: '40px' }}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </Box>
                
                <Button
                  variant="outlined"
                  size="sm"
                  endDecorator={<NavigateNext />}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!paginatedData.hasNextPage}
                >
                  Next
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {tabs.map((tab, index) => (
          <TabPanel key={tab.id} value={index}>
            <Card variant="outlined">
              <CardContent>
                <Typography level="h4" sx={{ mb: 2 }}>
                  {tab.label}
                </Typography>
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                  {tab.label} content coming soon. This will show detailed {tab.label.toLowerCase()} information for players.
                </Typography>
              </CardContent>
            </Card>
          </TabPanel>
        ))}
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        color={snackbarColor}
        autoHideDuration={4000}
      >
        {snackbarMessage}
      </Snackbar>
    </Box>
  );
}
