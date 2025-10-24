import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  Avatar,
  Chip,
  Button,
  Modal,
  ModalDialog,
  ModalClose,
  Stack,
  IconButton,
  Grid,
  Snackbar,
} from '@mui/joy';
import { LocalOffer, Add, Remove, SwapHoriz } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTeamTradingBlock, useAddToTradingBlock, useRemoveFromTradingBlock } from '../../hooks/useTradingBlock';
import { useUserTeamRoster } from '../../hooks/useUserTeamRoster';
import { useTeams } from '../../hooks/useTeams';
import { useLeague } from '../../hooks/useLeagues';

interface TradingBlockProps {
  teamId: string;
  leagueId?: string;
  onInitiateTrade?: (player: any, teamId: string, teamName: string) => void;
}

export default function TradingBlock({ teamId, leagueId, onInitiateTrade }: TradingBlockProps) {
  const { user } = useAuth();
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarColor, setSnackbarColor] = useState<'success' | 'danger'>('success');

  // Get team and league data
  const { data: teams } = useTeams(leagueId || '');
  const { data: league } = useLeague(leagueId || '');
  const currentTeam = teams?.find(t => t.id === teamId);
  const isOwnTeam = currentTeam?.user_id === user?.id;
  const seasonId = currentTeam?.season_id || (league as any)?.season_id;

  // Get trading block players
  const { data: tradingBlockPlayers = [], isLoading } = useTeamTradingBlock(leagueId || '', teamId);
  
  // Get roster for player selection
  const { data: rosterPlayers = [] } = useUserTeamRoster(leagueId || '', {
    enabled: isOwnTeam && manageModalOpen,
  });

  // Mutations
  const addToTradingBlockMutation = useAddToTradingBlock();
  const removeFromTradingBlockMutation = useRemoveFromTradingBlock();

  // Filter out players already on trading block
  const availablePlayers = rosterPlayers.filter(
    player => !tradingBlockPlayers.some(tbPlayer => tbPlayer.player_id === player.id)
  );

  // Max 3 players on trading block
  const maxTradingBlockPlayers = 3;
  const canAddMore = tradingBlockPlayers.length < maxTradingBlockPlayers;

  const handleAddPlayer = async (playerId: string) => {
    if (!leagueId || !seasonId) {
      setSnackbarMessage('Missing league or season data');
      setSnackbarColor('danger');
      setSnackbarOpen(true);
      return;
    }

    try {
      await addToTradingBlockMutation.mutateAsync({
        leagueId,
        seasonId,
        fantasyTeamId: teamId,
        playerId,
        status: 'available',
      });

      setSnackbarMessage('Player added to trading block!');
      setSnackbarColor('success');
      setSnackbarOpen(true);
    } catch (error: any) {
      console.error('Error adding player to trading block:', error);
      setSnackbarMessage(error.message || 'Failed to add player');
      setSnackbarColor('danger');
      setSnackbarOpen(true);
    }
  };

  const handleRemovePlayer = async (tradingBlockId: string) => {
    if (!leagueId) return;

    try {
      await removeFromTradingBlockMutation.mutateAsync({
        tradingBlockId,
        leagueId,
        fantasyTeamId: teamId,
      });

      setSnackbarMessage('Player removed from trading block');
      setSnackbarColor('success');
      setSnackbarOpen(true);
    } catch (error: any) {
      console.error('Error removing player from trading block:', error);
      setSnackbarMessage(error.message || 'Failed to remove player');
      setSnackbarColor('danger');
      setSnackbarOpen(true);
    }
  };

  const handlePlayerClick = (player: any) => {
    if (!isOwnTeam && onInitiateTrade && currentTeam) {
      // Initiate trade with this player
      onInitiateTrade(player, teamId, currentTeam.team_name);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'listening':
        return 'warning';
      case 'untouchable':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
              🏷️ Trading Block
            </Typography>
            {isOwnTeam && (
              <Button
                size="sm"
                variant="soft"
                color="primary"
                onClick={() => setManageModalOpen(true)}
                startDecorator={<LocalOffer />}
              >
                Manage
              </Button>
            )}
          </Box>

          {isLoading ? (
            <Typography level="body-sm" color="neutral" sx={{ textAlign: 'center', py: 3 }}>
              Loading...
            </Typography>
          ) : tradingBlockPlayers.length === 0 ? (
            <Typography level="body-sm" color="neutral" sx={{ textAlign: 'center', py: 3 }}>
              No players on trading block
            </Typography>
          ) : (
            <List size="sm">
              {tradingBlockPlayers.map((player) => (
                <ListItem
                  key={player.id}
                  sx={{
                    cursor: !isOwnTeam ? 'pointer' : 'default',
                    '&:hover': !isOwnTeam ? { bgcolor: 'background.level1' } : {},
                  }}
                  onClick={() => !isOwnTeam && handlePlayerClick(player)}
                  endAction={
                    !isOwnTeam ? (
                      <IconButton size="sm" color="primary" variant="soft">
                        <SwapHoriz />
                      </IconButton>
                    ) : null
                  }
                >
                  <Avatar
                    src={player.player_avatar}
                    sx={{ mr: 1 }}
                  >
                    {player.player_name?.charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.player_name}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {player.player_position} • {player.player_team}
                    </Typography>
                  </Box>
                  <Chip size="sm" color={getStatusColor(player.status)} variant="soft">
                    {player.status}
                  </Chip>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Manage Trading Block Modal */}
      <Modal open={manageModalOpen} onClose={() => setManageModalOpen(false)}>
        <ModalDialog sx={{ minWidth: 600, maxWidth: 800 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
            Manage Trading Block
          </Typography>
          <Typography level="body-sm" sx={{ mb: 3, color: 'text.secondary' }}>
            Add up to {maxTradingBlockPlayers} players from your roster to the trading block. Other teams can initiate trades for these players.
          </Typography>

          <Grid container spacing={3}>
            {/* Current Trading Block */}
            <Grid xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography level="title-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  On Trading Block ({tradingBlockPlayers.length}/{maxTradingBlockPlayers})
                </Typography>
              </Box>

              <Stack spacing={1}>
                {Array.from({ length: maxTradingBlockPlayers }).map((_, index) => {
                  const player = tradingBlockPlayers[index];

                  if (player) {
                    return (
                      <Box
                        key={player.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.5,
                          border: '1px solid',
                          borderColor: 'success.300',
                          borderRadius: 'sm',
                          bgcolor: 'success.50',
                        }}
                      >
                        <Avatar src={player.player_avatar} size="sm">
                          {player.player_name?.charAt(0)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {player.player_name}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {player.player_position} • {player.player_team}
                          </Typography>
                        </Box>
                        <IconButton
                          size="sm"
                          color="danger"
                          variant="soft"
                          onClick={() => handleRemovePlayer(player.id)}
                          loading={removeFromTradingBlockMutation.isPending}
                        >
                          <Remove />
                        </IconButton>
                      </Box>
                    );
                  }

                  return (
                    <Box
                      key={`empty-${index}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2,
                        border: '2px dashed',
                        borderColor: 'neutral.300',
                        borderRadius: 'sm',
                        bgcolor: 'background.level1',
                      }}
                    >
                      <Typography level="body-sm" color="neutral">
                        Empty Slot
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Grid>

            {/* Available Players */}
            <Grid xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography level="title-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Your Roster ({availablePlayers.length} available)
                </Typography>
              </Box>

              {!canAddMore && (
                <Typography level="body-sm" color="warning" sx={{ mb: 2, fontStyle: 'italic' }}>
                  Trading block is full. Remove a player to add another.
                </Typography>
              )}

              <List size="sm" sx={{ maxHeight: 400, overflow: 'auto' }}>
                {availablePlayers.length === 0 ? (
                  <Typography level="body-sm" color="neutral" sx={{ p: 2, textAlign: 'center' }}>
                    {tradingBlockPlayers.length >= maxTradingBlockPlayers
                      ? 'All eligible players are on trading block'
                      : 'No players available on your roster'}
                  </Typography>
                ) : (
                  availablePlayers.map((player) => (
                    <ListItem
                      key={player.id}
                      sx={{
                        cursor: canAddMore ? 'pointer' : 'default',
                        opacity: canAddMore ? 1 : 0.5,
                        '&:hover': canAddMore ? { bgcolor: 'background.level1' } : {},
                      }}
                      onClick={() => canAddMore && handleAddPlayer(player.id)}
                      endAction={
                        canAddMore ? (
                          <IconButton size="sm" color="primary">
                            <Add />
                          </IconButton>
                        ) : null
                      }
                    >
                      <Avatar
                        src={
                          player.nba_player_id
                            ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`
                            : undefined
                        }
                        size="sm"
                      >
                        {player.name?.charAt(0)}
                      </Avatar>
                      <Box sx={{ ml: 1, flex: 1, minWidth: 0 }}>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {player.name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {player.position} • {player.team_abbreviation}
                        </Typography>
                      </Box>
                    </ListItem>
                  ))
                )}
              </List>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="solid"
              color="primary"
              onClick={() => setManageModalOpen(false)}
            >
              Done
            </Button>
          </Box>
        </ModalDialog>
      </Modal>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        color={snackbarColor}
        autoHideDuration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
}

