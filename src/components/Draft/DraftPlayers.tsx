import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Input,
  Select,
  Option,
  Table,
  Avatar,
  Chip,
  Button,
  Stack,
  Alert,
  LinearProgress,
  Snackbar,
  Switch,
  FormControl,
  FormLabel,
} from '@mui/joy';
import { Search, Add, Clear, AutoAwesome } from '@mui/icons-material';
import { usePlayersPaginated } from '../../hooks/useNBAData';
import { useAuth } from '../../hooks/useAuth';
import { useTeams } from '../../hooks/useTeams';
import { useLeague } from '../../hooks/useLeagues';
import { useAutoDraft } from '../../hooks/useAutoDraft';
import { useNextPick } from '../../hooks/useNextPick';

interface DraftPlayersProps {
  leagueId: string;
}

export default function DraftPlayers({ leagueId }: DraftPlayersProps) {
  const { user } = useAuth();
  const { data: teams } = useTeams(leagueId);
  const { data: league } = useLeague(leagueId);
  const autoDraftMutation = useAutoDraft();
  const { data: nextPick } = useNextPick(leagueId);
  
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [cooldownTimer, setCooldownTimer] = useState(0);

  // Check if current user is commissioner
  const isCommissioner = league?.commissioner_id === user?.id;
  
  // Check if it's the current user's turn to pick
  const userTeam = teams?.find(team => team.user_id === user?.id);
  const isUserTurn = nextPick && userTeam && nextPick.teamId === userTeam.id;
  
  // Check if buttons should be enabled (user's turn and no cooldown)
  const buttonsEnabled = isUserTurn && cooldownTimer === 0;

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownTimer > 0) {
      const timer = setTimeout(() => {
        setCooldownTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTimer]);

  // Start cooldown when a pick is made
  useEffect(() => {
    if (nextPick && nextPick.pickNumber > 1) {
      // A pick was just made, start 2-second cooldown
      setCooldownTimer(2);
    }
  }, [nextPick?.pickNumber]);

  const { data: playersData, isLoading, error } = usePlayersPaginated(page, 25, {
    search: debouncedSearch,
    position: positionFilter,
    team: teamFilter,
    showInactive: showInactive,
    leagueId
  });


  const getPositionColor = (position: string) => {
    switch (position) {
      case 'PG':
      case 'SG':
      case 'G':
        return 'primary';
      case 'SF':
      case 'PF':
      case 'F':
        return 'success';
      case 'C':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const handleDraftPlayer = async (player: any) => {
    if (!nextPick) {
      setSnackbarMessage('No picks available for drafting');
      setSnackbarOpen(true);
      return;
    }

    if (!buttonsEnabled) {
      setSnackbarMessage('Please wait for your turn or cooldown to finish');
      setSnackbarOpen(true);
      return;
    }

    try {
      // Start cooldown immediately
      setCooldownTimer(2);
      
      // For now, just show a message - this would call a draft API
      setSnackbarMessage(`Drafted ${player.name}! (Feature coming soon)`);
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage(`Failed to draft player: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSnackbarOpen(true);
      // Reset cooldown on error
      setCooldownTimer(0);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setPositionFilter('');
    setTeamFilter('');
    setShowInactive(false);
    setPage(1);
  };

  const handleAutoDraft = async (playerId: number) => {
    if (!nextPick) {
      setSnackbarMessage('No picks available for auto-draft');
      setSnackbarOpen(true);
      return;
    }

    if (!buttonsEnabled) {
      setSnackbarMessage('Please wait for your turn or cooldown to finish');
      setSnackbarOpen(true);
      return;
    }

    try {
      // Start cooldown immediately
      setCooldownTimer(2);
      
      await autoDraftMutation.mutateAsync({
        leagueId,
        playerId,
        teamId: nextPick.teamId,
        pickNumber: nextPick.pickNumber
      });
      
      setSnackbarMessage(`Auto-drafted ${playersData?.players.find(p => p.id === playerId)?.name} to ${nextPick.teamName}`);
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage(`Failed to auto-draft player: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSnackbarOpen(true);
      // Reset cooldown on error
      setCooldownTimer(0);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <LinearProgress />
        <Typography sx={{ ml: 2 }}>Loading players...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <Typography>Error loading players: {error.message}</Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Draft Status */}
      {nextPick && (
        <Alert 
          color={isUserTurn ? "success" : "neutral"} 
          sx={{ mb: 2 }}
        >
          <Typography level="body-sm">
            {isUserTurn ? (
              `🎯 It's your turn! Pick ${nextPick.pickNumber} (Round ${nextPick.round})`
            ) : (
              `⏳ Waiting for ${nextPick.teamName} to pick (Pick ${nextPick.pickNumber}, Round ${nextPick.round})`
            )}
            {cooldownTimer > 0 && ` • Cooldown: ${cooldownTimer}s`}
          </Typography>
        </Alert>
      )}

      {/* Search and Filters */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Input
              placeholder="Search players..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              startDecorator={<Search />}
              size="sm"
            />
            
            <Stack direction="row" spacing={1}>
              <Select
                placeholder="Position"
                value={positionFilter}
                onChange={(_, value) => {
                  setPositionFilter(value as string);
                  setPage(1); // Reset to first page when filtering
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
                  setPage(1); // Reset to first page when filtering
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
                  setPage(1); // Reset to first page when toggling
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
            <Table hoverRow size="sm">
              <thead>
                <tr>
                  <th style={{ width: '200px' }}>Player</th>
                  <th style={{ width: '80px' }}>Pos</th>
                  <th style={{ width: '100px' }}>Team</th>
                  <th style={{ width: '100px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {playersData?.players.map((player) => (
                  <tr key={player.id}>
                    <td>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar 
                          size="sm" 
                          sx={{ 
                            bgcolor: 'primary.500',
                            width: 32,
                            height: 32
                          }}
                        >
                          {player.name?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {player.name}
                          </Typography>
                          {player.jersey_number && (
                            <Typography level="body-xs" color="neutral">
                              #{player.jersey_number}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </td>
                    <td>
                      <Chip 
                        size="sm" 
                        color={getPositionColor(player.position || '')} 
                        variant="soft"
                      >
                        {player.position}
                      </Chip>
                    </td>
                    <td>
                      <Typography level="body-sm">
                        {player.team_abbreviation || player.team_name}
                      </Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="sm"
                          variant="outlined"
                          startDecorator={<Add />}
                          onClick={() => handleDraftPlayer(player)}
                          disabled={!buttonsEnabled}
                          sx={{ fontSize: '0.7rem' }}
                        >
                          {cooldownTimer > 0 ? `${cooldownTimer}s` : 'Draft'}
                        </Button>
                        {isCommissioner && nextPick && (
                          <Button
                            size="sm"
                            variant="soft"
                            color="warning"
                            startDecorator={<AutoAwesome />}
                            onClick={() => handleAutoDraft(player.id)}
                            loading={autoDraftMutation.isPending}
                            disabled={!buttonsEnabled}
                            sx={{ fontSize: '0.7rem' }}
                          >
                            {cooldownTimer > 0 ? `${cooldownTimer}s` : 'Auto'}
                          </Button>
                        )}
                      </Stack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Box>
          
          {/* Pagination */}
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Typography level="body-sm" color="neutral">
                Showing {((page - 1) * 25) + 1}-{Math.min(page * 25, playersData?.totalCount || 0)} of {playersData?.totalCount || 0} players
              </Typography>
              
              <Stack direction="row" spacing={1}>
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Typography level="body-sm" sx={{ alignSelf: 'center', px: 2 }}>
                  Page {page} of {playersData?.totalPages || 1}
                </Typography>
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={() => setPage(page + 1)}
                  disabled={!playersData?.hasMore}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        color="success"
        autoHideDuration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </Box>
  );
}
