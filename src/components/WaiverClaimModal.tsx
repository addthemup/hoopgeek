import { useState, useMemo } from 'react';
import {
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Stack,
  Avatar,
  Chip,
  FormControl,
  FormLabel,
  Input,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  IconButton,
  Card,
  CardContent,
} from '@mui/joy';
import {
  PersonAdd,
  SwapHoriz,
  AttachMoney,
  CheckCircle,
  Cancel,
  Warning,
  Delete,
} from '@mui/icons-material';
import { useSubmitWaiverClaim, usePendingWaiverClaims, useCancelWaiverClaim, useTeamWaiverBudget } from '../hooks/useWaiverClaims';
import { useTeamRoster } from '../hooks/useTeamRoster';

interface WaiverClaimModalProps {
  open: boolean;
  onClose: () => void;
  player: {
    id: string;
    name: string;
    position: string;
    team_abbreviation: string;
    nba_player_id: number;
  };
  leagueId: string;
  seasonId: string;
  fantasyTeamId: string;
  waiverType: 'none' | 'rolling' | 'faab' | 'continuous';
  waiverBudgetAmount?: number;
  waiverMinBid?: number;
  becomesFreAgent?: Date;
}

export default function WaiverClaimModal({
  open,
  onClose,
  player,
  leagueId,
  seasonId,
  fantasyTeamId,
  waiverType,
  waiverBudgetAmount = 100,
  waiverMinBid = 0,
  becomesFreAgent,
}: WaiverClaimModalProps) {
  const [bidAmount, setBidAmount] = useState(waiverMinBid || 0);
  const [playerToDropId, setPlayerToDropId] = useState<string | null>(null);
  const [showDropSelection, setShowDropSelection] = useState(false);

  const submitClaimMutation = useSubmitWaiverClaim();
  const cancelClaimMutation = useCancelWaiverClaim();
  const { data: roster = [] } = useTeamRoster(fantasyTeamId);
  const { data: pendingClaims = [] } = usePendingWaiverClaims(leagueId, fantasyTeamId);
  const { data: waiverBudget } = useTeamWaiverBudget(leagueId, fantasyTeamId, seasonId);

  // Check if roster is full
  const rosterFull = useMemo(() => {
    const filled = roster.filter((spot: any) => spot.player !== null).length;
    const total = roster.length;
    console.log('🔍 Roster check:', { filled, total, isFull: filled >= total });
    return filled >= total;
  }, [roster]);

  // Check if there's already a pending claim for this player
  const existingClaim = useMemo(() => {
    return pendingClaims.find((claim: any) => claim.player_id === player.id);
  }, [pendingClaims, player.id]);

  const handleSubmitClaim = async () => {
    if (rosterFull && !playerToDropId) {
      setShowDropSelection(true);
      return;
    }

    try {
      await submitClaimMutation.mutateAsync({
        leagueId,
        seasonId,
        fantasyTeamId,
        playerId: player.id,
        playerToDropId,
        bidAmount: waiverType === 'faab' ? bidAmount : undefined,
      });

      onClose();
    } catch (error) {
      console.error('Failed to submit waiver claim:', error);
    }
  };

  const handleCancelClaim = async (claimId: string) => {
    try {
      await cancelClaimMutation.mutateAsync({
        claimId,
        leagueId,
        fantasyTeamId,
      });
    } catch (error) {
      console.error('Failed to cancel waiver claim:', error);
    }
  };

  const timeUntilFA = useMemo(() => {
    if (!becomesFreAgent) return null;
    const now = new Date();
    const diff = becomesFreAgent.getTime() - now.getTime();
    const hours = Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
    return hours;
  }, [becomesFreAgent]);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 600, width: '100%' }}>
        <ModalClose />
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <PersonAdd />
            <Typography level="h4">Waiver Claim</Typography>
          </Stack>
        </DialogTitle>
        <Divider />
        
        <DialogContent>
          <Stack spacing={3}>
            {/* Player Info */}
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                    sx={{ width: 60, height: 60 }}
                  >
                    {player.name.charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {player.name}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {player.position} • {player.team_abbreviation}
                    </Typography>
                  </Box>
                  {timeUntilFA !== null && (
                    <Chip color="warning" variant="soft">
                      {timeUntilFA}h until FA
                    </Chip>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Waiver Info */}
            <Alert color="primary" variant="soft">
              <Stack spacing={1}>
                <Typography level="title-sm">
                  {waiverType === 'faab' && `FAAB Waiver System (Budget: $${waiverBudgetAmount})`}
                  {waiverType === 'rolling' && 'Rolling Waiver System'}
                  {waiverType === 'continuous' && 'Continuous Waiver System'}
                  {waiverType === 'none' && 'No Waivers (Free Agent)'}
                </Typography>
                {waiverBudget && (
                  <Typography level="body-sm">
                    Remaining Budget: ${waiverBudget.remaining_budget} 
                    {waiverType !== 'faab' && ` • Priority: #${waiverBudget.waiver_priority}`}
                  </Typography>
                )}
              </Stack>
            </Alert>

            {/* Existing Claim Warning */}
            {existingClaim && (
              <Alert color="warning" startDecorator={<Warning />}>
                <Typography level="body-sm">
                  You already have a pending claim for this player.
                  {waiverType === 'faab' && ` Current bid: $${existingClaim.bid_amount}`}
                </Typography>
              </Alert>
            )}

            {/* FAAB Bid Amount */}
            {waiverType === 'faab' && !existingClaim && (
              <FormControl>
                <FormLabel>
                  Bid Amount (${waiverMinBid} - ${waiverBudget?.remaining_budget || waiverBudgetAmount})
                </FormLabel>
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
                  startDecorator={<AttachMoney />}
                  slotProps={{
                    input: {
                      min: waiverMinBid,
                      max: waiverBudget?.remaining_budget || waiverBudgetAmount,
                    },
                  }}
                />
                {bidAmount > (waiverBudget?.remaining_budget || 0) && (
                  <Typography level="body-xs" color="danger">
                    Insufficient budget! You have ${waiverBudget?.remaining_budget || 0} remaining.
                  </Typography>
                )}
              </FormControl>
            )}

            {/* Roster Full Warning / Drop Selection */}
            {rosterFull && !showDropSelection && (
              <Alert color="warning" startDecorator={<SwapHoriz />}>
                <Typography level="body-sm">
                  Your roster is full. You'll need to select a player to drop.
                </Typography>
              </Alert>
            )}

            {/* Player to Drop Selection */}
            {(showDropSelection || playerToDropId) && (
              <FormControl>
                <FormLabel>Select Player to Drop</FormLabel>
                <List
                  variant="outlined"
                  sx={{ maxHeight: 200, overflow: 'auto', borderRadius: 'sm' }}
                >
                  {roster
                    .filter((spot: any) => spot.player !== null)
                    .map((spot: any) => {
                      const rosterPlayer = spot.player as any;
                      return (
                        <ListItem
                          key={spot.id}
                          onClick={() => setPlayerToDropId(rosterPlayer.id)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: playerToDropId === rosterPlayer.id ? 'primary.50' : 'transparent',
                            '&:hover': { bgcolor: 'background.level1' },
                          }}
                        >
                          <ListItemDecorator>
                            <Avatar
                              size="sm"
                              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${rosterPlayer.nba_player_id}.png`}
                            >
                              {rosterPlayer.name?.charAt(0)}
                            </Avatar>
                          </ListItemDecorator>
                          <ListItemContent>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {rosterPlayer.name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {rosterPlayer.position} • {rosterPlayer.team_abbreviation}
                            </Typography>
                          </ListItemContent>
                          {playerToDropId === rosterPlayer.id && (
                            <CheckCircle color="primary" />
                          )}
                        </ListItem>
                      );
                    })}
                </List>
              </FormControl>
            )}

            {/* Pending Claims List */}
            {pendingClaims.length > 0 && (
              <Box>
                <Typography level="title-md" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Your Pending Claims ({pendingClaims.length})
                </Typography>
                <List variant="outlined" sx={{ borderRadius: 'sm' }}>
                  {pendingClaims.map((claim: any) => {
                    const claimPlayer = claim.nba_players;
                    return (
                      <ListItem
                        key={claim.id}
                        endAction={
                          <IconButton
                            size="sm"
                            color="danger"
                            variant="plain"
                            onClick={() => handleCancelClaim(claim.id)}
                            loading={cancelClaimMutation.isPending}
                          >
                            <Delete />
                          </IconButton>
                        }
                      >
                        <ListItemDecorator>
                          <Avatar
                            size="sm"
                            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${claimPlayer.nba_player_id}.png`}
                          >
                            {claimPlayer.name?.charAt(0)}
                          </Avatar>
                        </ListItemDecorator>
                        <ListItemContent>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {claimPlayer.name}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {claimPlayer.position} • {claimPlayer.team_abbreviation}
                            {waiverType === 'faab' && ` • Bid: $${claim.bid_amount}`}
                            {waiverType !== 'faab' && ` • Priority: #${claim.priority}`}
                          </Typography>
                        </ListItemContent>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button variant="plain" color="neutral" onClick={onClose}>
            Cancel
          </Button>
          {!existingClaim && (
            <Button
              variant="solid"
              color="primary"
              onClick={handleSubmitClaim}
              loading={submitClaimMutation.isPending}
              startDecorator={<PersonAdd />}
              disabled={
                (waiverType === 'faab' && bidAmount > (waiverBudget?.remaining_budget || 0)) ||
                (waiverType === 'faab' && bidAmount < waiverMinBid) ||
                (rosterFull && !playerToDropId)
              }
            >
              {waiverType === 'faab' ? `Submit Bid ($${bidAmount})` : 'Submit Claim'}
            </Button>
          )}
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}

