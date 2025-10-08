import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Avatar,
  Stack,
  Select,
  Option,
  Divider,
  Alert,
  Modal,
  ModalDialog,
  ModalClose,
  Grid,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  IconButton,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeagues';
import { useTeams } from '../hooks/useTeams';
import { useUserTeamRoster } from '../hooks/useUserTeamRoster';
import { useTeamDraftedPlayers } from '../hooks/useTeamDraftData';
import { useAvailableDraftPicks } from '../hooks/useAvailableDraftPicks';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SportsBasketballIcon from '@mui/icons-material/SportsBasketball';

interface Player {
  id: string;
  name: string;
  team: string;
  pos: string;
  salary: number;
  contractYears: number;
  avatar: string;
  stats: {
    ppg: number;
    rpg: number;
    apg: number;
    fgPct: number;
  };
}

interface DraftPick {
  id: string;
  year: number;
  round: number;
  team: string;
  originalTeam: string;
}

interface TradeItem {
  type: 'player' | 'pick';
  item: Player | DraftPick;
}

interface TradesProps {
  leagueId: string;
}

export default function Trades({ leagueId }: TradesProps) {
  const { user } = useAuth();
  const { data: league, isLoading, error } = useLeague(leagueId);
  const { data: teams, isLoading: teamsLoading } = useTeams(leagueId);
  const { data: userTeamRoster, isLoading: rosterLoading } = useUserTeamRoster(leagueId);
  // State for trade management
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const { data: selectedTeamRoster } = useTeamDraftedPlayers(leagueId, selectedTeam);
  
  // Get available draft picks for both teams
  const userTeam = teams?.find(team => team.user_id === user?.id);
  const { data: userAvailablePicks } = useAvailableDraftPicks(leagueId, userTeam?.id || '');
  const { data: selectedTeamAvailablePicks } = useAvailableDraftPicks(leagueId, selectedTeam);
  const [myTradeItems, setMyTradeItems] = useState<TradeItem[]>([]);
  const [theirTradeItems, setTheirTradeItems] = useState<TradeItem[]>([]);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeValidation, setTradeValidation] = useState<{
    isValid: boolean;
    message: string;
    salaryDifference?: number;
  }>({ isValid: false, message: '' });

  // Get available teams for trading
  const availableTeams = teams?.filter(team => team.id !== userTeam?.id) || [];

  // Transform roster data to Player interface
  const transformRosterToPlayers = (rosterData: any[]): Player[] => {
    return rosterData.map(player => ({
      id: player.id.toString(),
      name: player.name,
      team: player.team_abbreviation,
      pos: player.position,
      salary: 0, // TODO: Get real salary data
      contractYears: 1, // TODO: Get real contract data
      avatar: `https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`,
      stats: { 
        ppg: 0, // TODO: Get real stats
        rpg: 0, 
        apg: 0, 
        fgPct: 0 
      }
    }));
  };

  // Get real player data
  const myPlayers = userTeamRoster ? transformRosterToPlayers(userTeamRoster) : [];
  const theirPlayers = selectedTeamRoster ? transformRosterToPlayers(selectedTeamRoster) : [];

  // Transform available picks to DraftPick interface
  const transformAvailablePicksToDraftPicks = (availablePicks: any[], teamName: string): DraftPick[] => {
    return availablePicks.map(pick => ({
      id: `pick-${pick.pick_number}`,
      year: 2025, // TODO: Get real year from season data
      round: pick.round,
      team: teamName,
      originalTeam: teamName
    }));
  };

  // Get players for selected team
  const getTeamPlayers = (teamId: string) => {
    if (teamId === userTeam?.id) {
      return myPlayers;
    }
    return theirPlayers;
  };

  const getTeamPicks = (teamId: string) => {
    if (teamId === userTeam?.id) {
      return userAvailablePicks ? transformAvailablePicksToDraftPicks(userAvailablePicks, userTeam.team_name) : [];
    }
    if (selectedTeam && teamId === selectedTeam) {
      const selectedTeamData = teams?.find(t => t.id === selectedTeam);
      return selectedTeamAvailablePicks ? transformAvailablePicksToDraftPicks(selectedTeamAvailablePicks, selectedTeamData?.team_name || 'Unknown Team') : [];
    }
    return [];
  };

  // Calculate total salary for trade items
  const calculateTotalSalary = (items: TradeItem[]) => {
    return items
      .filter(item => item.type === 'player')
      .reduce((total, item) => total + (item.item as Player).salary, 0);
  };

  // Validate trade
  const validateTrade = () => {
    if (myTradeItems.length === 0 && theirTradeItems.length === 0) {
      setTradeValidation({ isValid: false, message: 'Add players or picks to complete trade' });
      return;
    }

    if (!selectedTeam) {
      setTradeValidation({ isValid: false, message: 'Select a team to trade with' });
      return;
    }

    // Check salary matching (if league has salaries enabled)
    const mySalary = calculateTotalSalary(myTradeItems);
    const theirSalary = calculateTotalSalary(theirTradeItems);
    const salaryDifference = Math.abs(mySalary - theirSalary);
    const salaryTolerance = Math.max(mySalary, theirSalary) * 0.1; // 10% tolerance

    if (salaryDifference > salaryTolerance) {
      setTradeValidation({
        isValid: false,
        message: `Salary mismatch: $${(salaryDifference / 1000000).toFixed(1)}M difference exceeds 10% tolerance`,
        salaryDifference
      });
      return;
    }

    setTradeValidation({
      isValid: true,
      message: 'Trade is valid and ready to submit',
      salaryDifference
    });
  };

  // Add item to trade
  const addToTrade = (item: Player | DraftPick, type: 'player' | 'pick', isMyTeam: boolean) => {
    const tradeItem: TradeItem = { type, item };
    
    if (isMyTeam) {
      setMyTradeItems(prev => [...prev, tradeItem]);
    } else {
      setTheirTradeItems(prev => [...prev, tradeItem]);
    }
  };

  // Remove item from trade
  const removeFromTrade = (index: number, isMyTeam: boolean) => {
    if (isMyTeam) {
      setMyTradeItems(prev => prev.filter((_, i) => i !== index));
    } else {
      setTheirTradeItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Format salary for display
  const formatSalary = (salary: number) => {
    return `$${(salary / 1000000).toFixed(1)}M`;
  };

  // Format draft pick for display
  const formatDraftPick = (pick: DraftPick) => {
    return `${pick.year} ${pick.round === 1 ? '1st' : '2nd'} Round (${pick.team})`;
  };

  // Validate trade whenever items change
  useEffect(() => {
    validateTrade();
  }, [myTradeItems, theirTradeItems, selectedTeam]);

  if (isLoading || teamsLoading || rosterLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Typography>Loading trade data...</Typography>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert color="danger">
        <Typography>Error loading league: {error.message}</Typography>
      </Alert>
    );
  }

  if (!userTeam) {
    return (
      <Alert color="warning">
        <Typography>You are not a member of this league.</Typography>
      </Alert>
    );
  }

  if (!userTeamRoster || userTeamRoster.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          No Players to Trade
        </Typography>
        <Typography level="body-md" color="neutral" sx={{ mb: 3 }}>
          Your team roster is empty. Draft some players first to start making trades.
        </Typography>
        <Alert color="primary">
          <Typography>
            Go to the Draft tab to build your team!
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography level="h3" sx={{ mb: 1, fontWeight: 'bold' }}>
          Trade Machine
        </Typography>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          Build and validate trades with other teams in your league
        </Typography>
      </Box>

      {/* Team Selection */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography level="h4">Select Team to Trade With</Typography>
          </Box>
          <Select
            placeholder="Choose a team..."
            value={selectedTeam}
            onChange={(_, value) => setSelectedTeam(value || '')}
            sx={{ minWidth: 200 }}
          >
            {availableTeams.map((team) => (
              <Option key={team.id} value={team.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                    {team.team_name?.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {team.team_name}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      Team {team.draft_position || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {/* Trade Validation */}
      {tradeValidation.message && (
        <Alert 
          color={tradeValidation.isValid ? 'success' : 'danger'} 
          sx={{ mb: 3 }}
        >
          {tradeValidation.message}
          {tradeValidation.salaryDifference && (
            <Typography level="body-xs" sx={{ mt: 1 }}>
              Salary difference: ${(tradeValidation.salaryDifference / 1000000).toFixed(1)}M
            </Typography>
          )}
        </Alert>
      )}

      {/* Trade Interface */}
      <Grid container spacing={3}>
        {/* My Team */}
        <Grid xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                  {userTeam.team_name?.charAt(0)}
                </Avatar>
                <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
                  {userTeam.team_name}
                </Typography>
              </Box>
              
              {/* My Trade Items */}
              <Box sx={{ mb: 3 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Trading Away ({myTradeItems.length})
                </Typography>
                {myTradeItems.length === 0 ? (
                  <Typography level="body-xs" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    No items selected
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {myTradeItems.map((item, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1,
                          border: '1px solid',
                          borderColor: 'neutral.300',
                          borderRadius: 'sm',
                          background: 'background.level1'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {item.type === 'player' ? (
                            <>
                              <Avatar src={(item.item as Player).avatar} size="sm" />
                              <Box>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                  {(item.item as Player).name}
                                </Typography>
                                <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                  {(item.item as Player).pos} • {formatSalary((item.item as Player).salary)}
                                </Typography>
                              </Box>
                            </>
                          ) : (
                            <>
                              <SportsBasketballIcon sx={{ fontSize: '20px' }} />
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {formatDraftPick(item.item as DraftPick)}
                              </Typography>
                            </>
                          )}
                        </Box>
                        <IconButton
                          size="sm"
                          color="danger"
                          onClick={() => removeFromTrade(index, true)}
                        >
                          <RemoveIcon />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Available Players */}
              <Box>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Available Players
                </Typography>
                <List size="sm">
                  {getTeamPlayers(userTeam.id).map((player) => (
                    <ListItem
                      key={player.id}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { background: 'background.level1' }
                      }}
                      onClick={() => addToTrade(player, 'player', true)}
                    >
                      <ListItemDecorator>
                        <Avatar src={player.avatar} size="sm" />
                      </ListItemDecorator>
                      <ListItemContent>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {player.name}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                          {player.pos} • {formatSalary(player.salary)} • {player.contractYears}y
                        </Typography>
                      </ListItemContent>
                      <IconButton size="sm" color="primary">
                        <AddIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* Available Draft Picks */}
              {true && (
                <Box sx={{ mt: 2 }}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Available Draft Picks
                  </Typography>
                  {getTeamPicks(userTeam.id).length === 0 ? (
                    <Typography level="body-xs" color="neutral" sx={{ p: 1, fontStyle: 'italic' }}>
                      No available draft picks
                    </Typography>
                  ) : (
                    <List size="sm">
                      {getTeamPicks(userTeam.id).map((pick) => (
                      <ListItem
                        key={pick.id}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { background: 'background.level1' }
                        }}
                        onClick={() => addToTrade(pick, 'pick', true)}
                      >
                        <ListItemDecorator>
                          <SportsBasketballIcon />
                        </ListItemDecorator>
                        <ListItemContent>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {formatDraftPick(pick)}
                          </Typography>
                        </ListItemContent>
                        <IconButton size="sm" color="primary">
                          <AddIcon />
                        </IconButton>
                      </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Trade Arrow */}
        <Grid xs={12} md={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <SwapHorizIcon sx={{ fontSize: '40px', color: 'primary.500' }} />
            <Button
              variant="solid"
              color="primary"
              disabled={!tradeValidation.isValid}
              onClick={() => setShowTradeModal(true)}
              sx={{ minWidth: '120px' }}
            >
              Submit Trade
            </Button>
          </Box>
        </Grid>

        {/* Their Team */}
        <Grid xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              {selectedTeam ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Avatar size="sm" sx={{ bgcolor: 'warning.500' }}>
                      {teams?.find(t => t.id === selectedTeam)?.team_name?.charAt(0)}
                    </Avatar>
                    <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
                      {teams?.find(t => t.id === selectedTeam)?.team_name}
                    </Typography>
                  </Box>
                  
                  {/* Their Trade Items */}
                  <Box sx={{ mb: 3 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Trading Away ({theirTradeItems.length})
                    </Typography>
                    {theirTradeItems.length === 0 ? (
                      <Typography level="body-xs" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        No items selected
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {theirTradeItems.map((item, index) => (
                          <Box
                            key={index}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1,
                              border: '1px solid',
                              borderColor: 'neutral.300',
                              borderRadius: 'sm',
                              background: 'background.level1'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {item.type === 'player' ? (
                                <>
                                  <Avatar src={(item.item as Player).avatar} size="sm" />
                                  <Box>
                                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                      {(item.item as Player).name}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                      {(item.item as Player).pos} • {formatSalary((item.item as Player).salary)}
                                    </Typography>
                                  </Box>
                                </>
                              ) : (
                                <>
                                  <SportsBasketballIcon sx={{ fontSize: '20px' }} />
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {formatDraftPick(item.item as DraftPick)}
                                  </Typography>
                                </>
                              )}
                            </Box>
                            <IconButton
                              size="sm"
                              color="danger"
                              onClick={() => removeFromTrade(index, false)}
                            >
                              <RemoveIcon />
                            </IconButton>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>

                  {/* Available Players */}
                  <Box>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Available Players
                    </Typography>
                    <List size="sm">
                      {getTeamPlayers(selectedTeam).map((player) => (
                        <ListItem
                          key={player.id}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { background: 'background.level1' }
                          }}
                          onClick={() => addToTrade(player, 'player', false)}
                        >
                          <ListItemDecorator>
                            <Avatar src={player.avatar} size="sm" />
                          </ListItemDecorator>
                          <ListItemContent>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {player.name}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                              {player.pos} • {formatSalary(player.salary)} • {player.contractYears}y
                            </Typography>
                          </ListItemContent>
                          <IconButton size="sm" color="primary">
                            <AddIcon />
                          </IconButton>
                        </ListItem>
                      ))}
                    </List>
                  </Box>

                  {/* Available Draft Picks */}
                  {true && (
                    <Box sx={{ mt: 2 }}>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Available Draft Picks
                      </Typography>
                      {getTeamPicks(selectedTeam).length === 0 ? (
                        <Typography level="body-xs" color="neutral" sx={{ p: 1, fontStyle: 'italic' }}>
                          No available draft picks
                        </Typography>
                      ) : (
                        <List size="sm">
                          {getTeamPicks(selectedTeam).map((pick) => (
                          <ListItem
                            key={pick.id}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { background: 'background.level1' }
                            }}
                            onClick={() => addToTrade(pick, 'pick', false)}
                          >
                            <ListItemDecorator>
                              <SportsBasketballIcon />
                            </ListItemDecorator>
                            <ListItemContent>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {formatDraftPick(pick)}
                              </Typography>
                            </ListItemContent>
                            <IconButton size="sm" color="primary">
                              <AddIcon />
                            </IconButton>
                          </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                    Select a team to see their available players and picks
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Trade Summary */}
        <Grid xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2, fontWeight: 'bold' }}>
                Trade Summary
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Salary Breakdown
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography level="body-xs">My Team:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    {formatSalary(calculateTotalSalary(myTradeItems))}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography level="body-xs">Their Team:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    {formatSalary(calculateTotalSalary(theirTradeItems))}
                  </Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>Difference:</Typography>
                  <Typography 
                    level="body-sm" 
                    sx={{ 
                      fontWeight: 'bold',
                      color: tradeValidation.salaryDifference && tradeValidation.salaryDifference > 0 ? 'danger.500' : 'success.500'
                    }}
                  >
                    {tradeValidation.salaryDifference ? formatSalary(tradeValidation.salaryDifference) : '$0.0M'}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Trade Items
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography level="body-xs">Players:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    {myTradeItems.filter(i => i.type === 'player').length + theirTradeItems.filter(i => i.type === 'player').length}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-xs">Draft Picks:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    {myTradeItems.filter(i => i.type === 'pick').length + theirTradeItems.filter(i => i.type === 'pick').length}
                  </Typography>
                </Box>
              </Box>

              <Button
                variant="solid"
                color="primary"
                fullWidth
                disabled={!tradeValidation.isValid}
                onClick={() => setShowTradeModal(true)}
                sx={{ mt: 2 }}
              >
                Submit Trade Proposal
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Trade Confirmation Modal */}
      <Modal open={showTradeModal} onClose={() => setShowTradeModal(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Confirm Trade Proposal
          </Typography>
          <Typography level="body-md" sx={{ mb: 3 }}>
            Are you sure you want to submit this trade proposal? The other team owner will be notified and can accept or decline.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={() => setShowTradeModal(false)}>
              Cancel
            </Button>
            <Button variant="solid" color="primary">
              Submit Trade
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
