import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Select,
  Option,
  Avatar,
  Grid,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  IconButton,
  Divider,
  Chip,
} from '@mui/joy';
import {
  SwapHoriz,
  Add,
  Remove,
  SportsBasketball,
  Close,
  CheckCircle,
  Cancel,
  AccessTime,
  Gavel,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTeams } from '../../hooks/useTeams';
import { useTeamDraftedPlayers } from '../../hooks/useTeamDraftData';
import { useAvailableDraftPicks } from '../../hooks/useAvailableDraftPicks';
import { useNextPick } from '../../hooks/useNextPick';
import { usePendingTrades } from '../../hooks/usePendingTrades';
import { useAcceptTrade, useRejectTrade } from '../../hooks/useTradeActions';
import { supabase } from '../../utils/supabase';

interface TradeAsset {
  type: 'player' | 'pick';
  playerId?: number;
  playerName?: string;
  position?: string;
  nbaPlayerId?: number;
  pickNumber?: number;
  round?: number;
}

interface TradeContext {
  teamId: string;
  teamName: string;
  asset: TradeAsset;
}

interface DraftTradeProps {
  leagueId: string;
  tradeContext?: TradeContext | null;
  onClearContext: () => void;
  isCommissioner?: boolean;
}

interface Player {
  id: number;
  name: string;
  position: string;
  team_abbreviation: string;
  nba_player_id: number;
}

interface DraftPick {
  pick_number: number;
  round: number;
  team_position: number;
}

interface TradeItem {
  type: 'player' | 'pick';
  item: Player | DraftPick;
}

export default function DraftTrade({ leagueId, tradeContext, onClearContext, isCommissioner = false }: DraftTradeProps) {
  const { user } = useAuth();
  const { data: teams } = useTeams(leagueId);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [myTradeItems, setMyTradeItems] = useState<TradeItem[]>([]);
  const [theirTradeItems, setTheirTradeItems] = useState<TradeItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Get current user's team
  const userTeam = teams?.find(team => team.user_id === user?.id);
  
  // Fetch pending trades
  const { data: pendingTrades = [] } = usePendingTrades(userTeam?.id, leagueId, isCommissioner);
  
  // Trade actions
  const acceptTradeMutation = useAcceptTrade();
  const rejectTradeMutation = useRejectTrade();

  // Check if draft is complete
  const { data: nextPick } = useNextPick(leagueId);
  const isDraftComplete = nextPick === null;
  
  // Get draft data for user's team
  const { data: userDraftedPlayers } = useTeamDraftedPlayers(leagueId, userTeam?.id || '');
  const { data: userAvailablePicks } = useAvailableDraftPicks(leagueId, userTeam?.id || '');
  
  // Get draft data for selected team
  const { data: selectedTeamDraftedPlayers } = useTeamDraftedPlayers(leagueId, selectedTeam);
  const { data: selectedTeamAvailablePicks } = useAvailableDraftPicks(leagueId, selectedTeam);

  // Pre-populate with trade context if provided
  useEffect(() => {
    if (tradeContext) {
      setSelectedTeam(tradeContext.teamId);
      
      // Add the asset to their trade items
      if (tradeContext.asset.type === 'player') {
        const player: Player = {
          id: tradeContext.asset.playerId!,
          name: tradeContext.asset.playerName!,
          position: tradeContext.asset.position!,
          team_abbreviation: '',
          nba_player_id: tradeContext.asset.nbaPlayerId!,
        };
        setTheirTradeItems([{ type: 'player', item: player }]);
      } else {
        const pick: DraftPick = {
          pick_number: tradeContext.asset.pickNumber!,
          round: tradeContext.asset.round!,
          team_position: 0,
        };
        setTheirTradeItems([{ type: 'pick', item: pick }]);
      }
    }
  }, [tradeContext]);

  // Get available teams for trading
  const availableTeams = teams?.filter(team => team.id !== userTeam?.id) || [];

  // Get players for team
  const myPlayers: Player[] = userDraftedPlayers || [];
  const theirPlayers: Player[] = selectedTeamDraftedPlayers || [];

  // Get picks for team
  const myPicks: DraftPick[] = userAvailablePicks || [];
  const theirPicks: DraftPick[] = selectedTeamAvailablePicks || [];

  // Debug logging
  useEffect(() => {
    console.log('🏀 DraftTrade - My Team Players:', myPlayers.length, myPlayers);
    console.log('🏀 DraftTrade - Their Team Players:', theirPlayers.length, theirPlayers);
    console.log('🏀 DraftTrade - My Picks:', myPicks.length, myPicks);
    console.log('🏀 DraftTrade - Their Picks:', theirPicks.length, theirPicks);
    console.log('🏀 DraftTrade - Pending Trades:', pendingTrades.length, pendingTrades);
    if (pendingTrades.length > 0) {
      console.log('🏀 DraftTrade - First Trade Data:', pendingTrades[0]);
      console.log('🏀 DraftTrade - Offered Players Type:', typeof pendingTrades[0].offered_players);
      console.log('🏀 DraftTrade - Offered Players Value:', pendingTrades[0].offered_players);
    }
  }, [myPlayers, theirPlayers, myPicks, theirPicks, pendingTrades]);

  // Add item to trade
  const addToTrade = (item: Player | DraftPick, type: 'player' | 'pick', isMyTeam: boolean) => {
    const tradeItem: TradeItem = { type, item };
    
    if (isMyTeam) {
      // Check if already in trade
      const exists = myTradeItems.some(ti => {
        if (type === 'player') {
          return ti.type === 'player' && (ti.item as Player).id === (item as Player).id;
        } else {
          return ti.type === 'pick' && (ti.item as DraftPick).pick_number === (item as DraftPick).pick_number;
        }
      });
      if (!exists) {
        setMyTradeItems(prev => [...prev, tradeItem]);
      }
    } else {
      const exists = theirTradeItems.some(ti => {
        if (type === 'player') {
          return ti.type === 'player' && (ti.item as Player).id === (item as Player).id;
        } else {
          return ti.type === 'pick' && (ti.item as DraftPick).pick_number === (item as DraftPick).pick_number;
        }
      });
      if (!exists) {
        setTheirTradeItems(prev => [...prev, tradeItem]);
      }
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

  // Format draft pick for display
  const formatDraftPick = (pick: DraftPick) => {
    return `Round ${pick.round} Pick #${pick.pick_number}`;
  };

  // Validate trade
  const isTradeValid = myTradeItems.length > 0 && theirTradeItems.length > 0 && selectedTeam;

  // Handle accepting a trade
  const handleAcceptTrade = async (tradeId: string) => {
    if (!userTeam) return;
    
    try {
      await acceptTradeMutation.mutateAsync({
        tradeId,
        acceptingTeamId: userTeam.id,
        isCommissioner,
      });
    } catch (error: any) {
      console.error('Error accepting trade:', error);
    }
  };

  // Handle rejecting a trade
  const handleRejectTrade = async (tradeId: string) => {
    if (!userTeam) return;
    
    try {
      await rejectTradeMutation.mutateAsync({
        tradeId,
        rejectingTeamId: userTeam.id,
        isCommissioner,
      });
    } catch (error: any) {
      console.error('Error rejecting trade:', error);
    }
  };

  // Submit trade offer
  const handleSubmitTrade = async () => {
    if (!isTradeValid || !userTeam) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Extract player IDs and pick numbers
      const offeredPlayerIds = myTradeItems
        .filter(item => item.type === 'player')
        .map(item => (item.item as Player).id);
      
      const offeredPickNumbers = myTradeItems
        .filter(item => item.type === 'pick')
        .map(item => (item.item as DraftPick).pick_number);
      
      const requestedPlayerIds = theirTradeItems
        .filter(item => item.type === 'player')
        .map(item => (item.item as Player).id);
      
      const requestedPickNumbers = theirTradeItems
        .filter(item => item.type === 'pick')
        .map(item => (item.item as DraftPick).pick_number);
      
      // Get the season ID for this league
      const { data: seasonData, error: seasonError } = await supabase
        .from('fantasy_league_seasons')
        .select('id')
        .eq('league_id', leagueId)
        .eq('season_year', 2025)
        .single();

      if (seasonError || !seasonData) {
        console.error('Error fetching season data:', seasonError);
        setSubmitError('Failed to find league season data');
        return;
      }

      // Call the create_draft_trade_offer function
      const { data, error } = await supabase.rpc('create_draft_trade_offer', {
        p_league_id: leagueId,
        p_season_id: seasonData.id,
        p_from_team_id: userTeam.id,
        p_to_team_id: selectedTeam,
        p_offered_players: JSON.stringify(offeredPlayerIds),
        p_offered_picks: JSON.stringify(offeredPickNumbers),
        p_requested_players: JSON.stringify(requestedPlayerIds),
        p_requested_picks: JSON.stringify(requestedPickNumbers),
      });
      
      if (error) {
        console.error('Error creating trade offer:', error);
        setSubmitError(error.message || 'Failed to submit trade offer');
        return;
      }
      
      // Success!
      console.log('✅ Trade offer created:', data);
      setSubmitSuccess(true);
      
      // Clear the trade after 2 seconds
      setTimeout(() => {
        setMyTradeItems([]);
        setTheirTradeItems([]);
        setSelectedTeam('');
        setSubmitSuccess(false);
        onClearContext();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error submitting trade:', error);
      setSubmitError(error.message || 'Failed to submit trade offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show draft complete message if draft is finished
  if (isDraftComplete) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Typography level="h2" sx={{ mb: 2, textAlign: 'center' }}>
          🎉 Draft Complete!
        </Typography>
        <Typography level="h4" sx={{ mb: 4, textAlign: 'center', color: 'neutral.500' }}>
          Your Draft is Complete
        </Typography>
        <Alert color="success" sx={{ maxWidth: 400, textAlign: 'center' }}>
          <Typography>
            All picks have been made! Trading is now closed. Check out your final roster and get ready for the season.
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (!userTeam) {
    return (
      <Alert color="warning">
        <Typography>You are not a member of this league.</Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Trade Context Alert */}
      {tradeContext && (
        <Alert 
          color="primary" 
          sx={{ mb: 2 }}
          endDecorator={
            <IconButton size="sm" variant="soft" color="neutral" onClick={onClearContext}>
              <Close />
            </IconButton>
          }
        >
          <Box>
            <Typography level="title-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              Initiating Trade
          </Typography>
              <Typography level="body-sm">
              {tradeContext.asset.type === 'player' ? (
                <>Trading for <strong>{tradeContext.asset.playerName}</strong> ({tradeContext.asset.position}) from {tradeContext.teamName}</>
              ) : (
                <>Trading for <strong>Round {tradeContext.asset.round} Pick #{tradeContext.asset.pickNumber}</strong> from {tradeContext.teamName}</>
              )}
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Pending Trades Section */}
      {pendingTrades.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'background.level1' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTime color="primary" />
                <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
                  {isCommissioner ? 'All Pending Trades' : 'Your Pending Trades'}
                </Typography>
                <Chip size="sm" color="primary">
                  {pendingTrades.length}
                </Chip>
              </Box>
              {isCommissioner && (
                <Chip size="sm" startDecorator={<Gavel />} color="warning" variant="soft">
                  Commissioner Mode
                </Chip>
              )}
            </Box>

            <Stack spacing={2}>
              {pendingTrades.map((trade) => {
                const isRecipient = trade.to_team_id === userTeam?.id;
                const isSender = trade.from_team_id === userTeam?.id;
                const isExpired = new Date(trade.expires_at) < new Date();
                
                return (
                  <Card 
                    key={trade.id} 
                    variant="outlined" 
                    sx={{ 
                      bgcolor: 'background.surface',
                      opacity: isExpired ? 0.6 : 1,
                    }}
                  >
                    <CardContent>
                      {/* Trade Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            <Box component="span" sx={{ color: 'primary.500' }}>{trade.from_team_name}</Box>
                            {' ↔️ '}
                            <Box component="span" sx={{ color: 'warning.500' }}>{trade.to_team_name}</Box>
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            {new Date(trade.created_at).toLocaleString()}
                          </Typography>
                          {isExpired && (
                            <Chip size="sm" color="danger" variant="soft" sx={{ mt: 0.5 }}>
                              Expired
                            </Chip>
                          )}
                        </Box>
                        
                        {/* Action Buttons */}
                        {!isExpired && (
                          <Stack direction="row" spacing={1}>
                            {(isRecipient || isCommissioner) && (
                              <Button
                                size="sm"
                                color="success"
                                variant="solid"
                                startDecorator={<CheckCircle />}
                                onClick={() => handleAcceptTrade(trade.id)}
                                loading={acceptTradeMutation.isPending}
                              >
                                {isCommissioner && !isRecipient ? 'Force Accept' : 'Accept'}
                              </Button>
                            )}
                            {(isRecipient || isSender || isCommissioner) && (
                              <Button
                                size="sm"
                                color="danger"
                                variant="outlined"
                                startDecorator={<Cancel />}
                                onClick={() => handleRejectTrade(trade.id)}
                                loading={rejectTradeMutation.isPending}
                              >
                                {isSender ? 'Cancel' : 'Reject'}
                              </Button>
                            )}
                          </Stack>
                        )}
                      </Box>

                      {/* Trade Details */}
                      <Grid container spacing={2}>
                        {/* From Team (Offering) */}
                        <Grid xs={12} md={5}>
                          <Box sx={{ 
                            p: 1.5, 
                            bgcolor: 'primary.50', 
                            borderRadius: 'sm', 
                            border: '1px solid', 
                            borderColor: 'primary.200' 
                          }}>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.700' }}>
                              {trade.from_team_name} Offers
                            </Typography>
                            
                            {/* Offered Players */}
                            {trade.offered_players && Array.isArray(trade.offered_players) && trade.offered_players.length > 0 && (
                              <Box sx={{ mb: 1 }}>
                                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                  Players ({trade.offered_players.length})
                                </Typography>
                                <Stack spacing={0.5}>
                                  {trade.offered_players.map((player) => (
                                    <Box 
                                      key={player.id} 
                                      sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        p: 0.5,
                                        bgcolor: 'background.surface',
                                        borderRadius: 'sm'
                                      }}
                                    >
                                      <Avatar 
                                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                                        size="sm"
                                      >
                                        {player.name.charAt(0)}
                                      </Avatar>
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography level="body-xs" sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {player.name}
                                        </Typography>
                                        <Typography level="body-xs" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                          {player.position} • ${player.salary_2025_26 ? (player.salary_2025_26 / 1000000).toFixed(1) + 'M' : 'N/A'}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            {/* Offered Picks */}
                            {trade.offered_picks && Array.isArray(trade.offered_picks) && trade.offered_picks.length > 0 && (
                              <Box>
                                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                  Draft Picks ({trade.offered_picks.length})
                                </Typography>
                                <Stack spacing={0.5}>
                                  {trade.offered_picks.map((pick) => (
                                    <Box 
                                      key={pick.pick_number}
                                      sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        p: 0.5,
                                        bgcolor: 'background.surface',
                                        borderRadius: 'sm'
                                      }}
                                    >
                                      <SportsBasketball sx={{ fontSize: '1rem' }} />
                                      <Typography level="body-xs">
                                        Round {pick.round}, Pick #{pick.pick_number}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                          </Box>
                        </Grid>

                        {/* Swap Arrow */}
                        <Grid xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <SwapHoriz sx={{ fontSize: '2rem', color: 'text.tertiary' }} />
                        </Grid>

                        {/* To Team (Requesting) */}
                        <Grid xs={12} md={5}>
                          <Box sx={{ 
                            p: 1.5, 
                            bgcolor: 'warning.50', 
                            borderRadius: 'sm', 
                            border: '1px solid', 
                            borderColor: 'warning.200' 
                          }}>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1, color: 'warning.700' }}>
                              {trade.to_team_name} Receives
                            </Typography>
                            
                            {/* Requested Players */}
                            {trade.requested_players && Array.isArray(trade.requested_players) && trade.requested_players.length > 0 && (
                              <Box sx={{ mb: 1 }}>
                                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                  Players ({trade.requested_players.length})
                                </Typography>
                                <Stack spacing={0.5}>
                                  {trade.requested_players.map((player) => (
                                    <Box 
                                      key={player.id} 
                                      sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        p: 0.5,
                                        bgcolor: 'background.surface',
                                        borderRadius: 'sm'
                                      }}
                                    >
                                      <Avatar 
                                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                                        size="sm"
                                      >
                                        {player.name.charAt(0)}
                                      </Avatar>
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography level="body-xs" sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {player.name}
                                        </Typography>
                                        <Typography level="body-xs" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                          {player.position} • ${player.salary_2025_26 ? (player.salary_2025_26 / 1000000).toFixed(1) + 'M' : 'N/A'}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            {/* Requested Picks */}
                            {trade.requested_picks && Array.isArray(trade.requested_picks) && trade.requested_picks.length > 0 && (
                              <Box>
                                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                  Draft Picks ({trade.requested_picks.length})
                                </Typography>
                                <Stack spacing={0.5}>
                                  {trade.requested_picks.map((pick) => (
                                    <Box 
                                      key={pick.pick_number}
                                      sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        p: 0.5,
                                        bgcolor: 'background.surface',
                                        borderRadius: 'sm'
                                      }}
                                    >
                                      <SportsBasketball sx={{ fontSize: '1rem' }} />
                                      <Typography level="body-xs">
                                        Round {pick.round}, Pick #{pick.pick_number}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
          Draft Trade Machine
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Build and propose trades during the draft
              </Typography>
            </Box>
            
      {/* Trade Interface */}
      <Grid container spacing={3}>
        {/* My Team */}
        <Grid xs={12} md={5}>
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
                  <Typography level="body-xs" sx={{ color: 'text.secondary', fontStyle: 'italic', p: 1 }}>
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
                              <Avatar 
                                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${(item.item as Player).nba_player_id}.png`}
                                size="sm" 
                              >
                                {(item.item as Player).name?.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                  {(item.item as Player).name}
                                </Typography>
                                <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                  {(item.item as Player).position} • {(item.item as Player).team_abbreviation}
                                </Typography>
                              </Box>
                            </>
                          ) : (
                            <>
                              <SportsBasketball sx={{ fontSize: '20px', color: 'primary.500' }} />
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
                          <Remove />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Available Players */}
              <Box>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Available Players ({myPlayers.length})
                </Typography>
                {myPlayers.length === 0 ? (
                  <Typography level="body-xs" color="neutral" sx={{ p: 1, fontStyle: 'italic' }}>
                    No drafted players yet
                  </Typography>
                ) : (
                  <List size="sm" sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {myPlayers.map((player) => (
                      <ListItem
                        key={player.id}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { background: 'background.level1' }
                        }}
                        onClick={() => addToTrade(player, 'player', true)}
                      >
                        <ListItemDecorator>
                          <Avatar 
                            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                            size="sm" 
                          >
                            {player.name?.charAt(0)}
                        </Avatar>
                        </ListItemDecorator>
                        <ListItemContent>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {player.name}
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            {player.position} • {player.team_abbreviation}
                        </Typography>
                        </ListItemContent>
                        <IconButton size="sm" color="primary">
                          <Add />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                )}
                      </Box>

              {/* Available Draft Picks */}
              <Box sx={{ mt: 2 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Available Future Picks ({myPicks.length})
                </Typography>
                {myPicks.length === 0 ? (
                  <Typography level="body-xs" color="neutral" sx={{ p: 1, fontStyle: 'italic' }}>
                    No available future picks
                  </Typography>
                ) : (
                  <List size="sm" sx={{ maxHeight: 150, overflow: 'auto' }}>
                    {myPicks.map((pick) => (
                      <ListItem
                        key={pick.pick_number}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { background: 'background.level1' }
                        }}
                        onClick={() => addToTrade(pick, 'pick', true)}
                      >
                        <ListItemDecorator>
                          <SportsBasketball />
                        </ListItemDecorator>
                        <ListItemContent>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {formatDraftPick(pick)}
                          </Typography>
                        </ListItemContent>
                        <IconButton size="sm" color="primary">
                          <Add />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Trade Arrow & Submit */}
        <Grid xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <SwapHoriz sx={{ fontSize: '40px', color: submitSuccess ? 'success.500' : 'primary.500' }} />
            <Button
              variant="solid"
              color={submitSuccess ? 'success' : 'primary'}
              disabled={!isTradeValid || isSubmitting}
              loading={isSubmitting}
              onClick={handleSubmitTrade}
              sx={{ minWidth: '120px' }}
            >
              {submitSuccess ? '✓ Sent!' : 'Submit Trade'}
            </Button>
            {!selectedTeam && (
              <Typography level="body-xs" color="neutral" sx={{ textAlign: 'center', maxWidth: 100 }}>
                Select a team
                      </Typography>
                    )}
                </Box>
              </Grid>

        {/* Their Team */}
        <Grid xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              {selectedTeam ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    {/* Team Info */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar size="sm" sx={{ bgcolor: 'warning.500' }}>
                        {teams?.find(t => t.id === selectedTeam)?.team_name?.charAt(0)}
                      </Avatar>
                      <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
                    {teams?.find(t => t.id === selectedTeam)?.team_name}
                  </Typography>
                    </Box>
                    
                    {/* Team Selector Dropdown */}
                    <Select
                      placeholder="Switch team..."
                      value={selectedTeam}
                      onChange={(_, value) => {
                        // Clear their trade items when switching teams
                        if (theirTradeItems.length > 0) {
                          console.log('🔄 Clearing trade items from previous team:', theirTradeItems.length);
                        }
                        setTheirTradeItems([]);
                        setSelectedTeam(value || '');
                        onClearContext();
                      }}
                      size="sm"
                      sx={{ minWidth: 180 }}
                    >
                      {availableTeams.map((team) => (
                        <Option key={team.id} value={team.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                              {team.team_name?.charAt(0)}
                            </Avatar>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {team.team_name}
                            </Typography>
                          </Box>
                        </Option>
                      ))}
                    </Select>
                  </Box>
                  
                  {/* Their Trade Items */}
                  <Box sx={{ mb: 3 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Trading Away ({theirTradeItems.length})
                  </Typography>
                    {theirTradeItems.length === 0 ? (
                      <Typography level="body-xs" sx={{ color: 'text.secondary', fontStyle: 'italic', p: 1 }}>
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
                                  <Avatar 
                                    src={`https://cdn.nba.com/headshots/nba/latest/260x190/${(item.item as Player).nba_player_id}.png`}
                                    size="sm" 
                                  >
                                    {(item.item as Player).name?.charAt(0)}
                                  </Avatar>
                                  <Box>
                                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                      {(item.item as Player).name}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                      {(item.item as Player).position} • {(item.item as Player).team_abbreviation}
                                    </Typography>
                                  </Box>
                                </>
                              ) : (
                                <>
                                  <SportsBasketball sx={{ fontSize: '20px', color: 'warning.500' }} />
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
                              <Remove />
                            </IconButton>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>

                  {/* Available Players */}
                  <Box>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Available Players ({theirPlayers.length})
                    </Typography>
                    {theirPlayers.length === 0 ? (
                      <Typography level="body-xs" color="neutral" sx={{ p: 1, fontStyle: 'italic' }}>
                        No drafted players yet
                  </Typography>
                    ) : (
                      <List size="sm" sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {theirPlayers.map((player) => (
                          <ListItem
                            key={player.id}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { background: 'background.level1' }
                            }}
                            onClick={() => addToTrade(player, 'player', false)}
                          >
                            <ListItemDecorator>
                              <Avatar 
                                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                                size="sm" 
                              >
                                {player.name?.charAt(0)}
                        </Avatar>
                            </ListItemDecorator>
                            <ListItemContent>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {player.name}
                              </Typography>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                {player.position} • {player.team_abbreviation}
                        </Typography>
                            </ListItemContent>
                            <IconButton size="sm" color="primary">
                              <Add />
                            </IconButton>
                          </ListItem>
                        ))}
                      </List>
                    )}
                      </Box>

                  {/* Available Draft Picks */}
                  <Box sx={{ mt: 2 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Available Future Picks ({theirPicks.length})
                    </Typography>
                    {theirPicks.length === 0 ? (
                      <Typography level="body-xs" color="neutral" sx={{ p: 1, fontStyle: 'italic' }}>
                        No available future picks
                      </Typography>
                    ) : (
                      <List size="sm" sx={{ maxHeight: 150, overflow: 'auto' }}>
                        {theirPicks.map((pick) => (
                          <ListItem
                            key={pick.pick_number}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { background: 'background.level1' }
                            }}
                            onClick={() => addToTrade(pick, 'pick', false)}
                          >
                            <ListItemDecorator>
                              <SportsBasketball />
                            </ListItemDecorator>
                            <ListItemContent>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {formatDraftPick(pick)}
                              </Typography>
                            </ListItemContent>
                            <IconButton size="sm" color="primary">
                              <Add />
                            </IconButton>
                          </ListItem>
                        ))}
                      </List>
                    )}
                </Box>
                </>
              ) : (
                <Box sx={{ py: 4 }}>
                  <Typography level="title-md" sx={{ mb: 2, fontWeight: 'bold', textAlign: 'center' }}>
                    Select Team to Trade With
          </Typography>
            <Select
                    placeholder="Choose a team..."
              value={selectedTeam}
                    onChange={(_, value) => {
                      // Clear their trade items when switching teams
                      if (theirTradeItems.length > 0) {
                        console.log('🔄 Clearing trade items from previous team:', theirTradeItems.length);
                      }
                      setTheirTradeItems([]);
                      setSelectedTeam(value || '');
                      onClearContext();
                    }}
                    sx={{ width: '100%' }}
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
                  <Typography level="body-sm" sx={{ color: 'text.secondary', textAlign: 'center', mt: 2 }}>
                    Choose a team to view their available players and picks
                  </Typography>
                </Box>
              )}
        </CardContent>
      </Card>
        </Grid>
      </Grid>

      {/* Success/Error Messages */}
      {submitSuccess && (
        <Alert color="success" sx={{ mt: 3 }}>
          <Typography>Trade offer submitted successfully! The other team has been notified.</Typography>
        </Alert>
      )}
      
      {submitError && (
        <Alert color="danger" sx={{ mt: 3 }} onClose={() => setSubmitError(null)}>
          <Typography>{submitError}</Typography>
        </Alert>
      )}

      {/* Trade Summary */}
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Typography level="title-md" sx={{ mb: 2, fontWeight: 'bold' }}>
            Trade Summary
          </Typography>
          
          <Grid container spacing={2}>
            <Grid xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {userTeam.team_name} Receives:
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography level="body-xs">Players:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    {theirTradeItems.filter(i => i.type === 'player').length}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-xs">Draft Picks:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    {theirTradeItems.filter(i => i.type === 'pick').length}
            </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {teams?.find(t => t.id === selectedTeam)?.team_name || 'Other Team'} Receives:
            </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography level="body-xs">Players:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    {myTradeItems.filter(i => i.type === 'player').length}
            </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-xs">Draft Picks:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                    {myTradeItems.filter(i => i.type === 'pick').length}
            </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Button
            variant="solid"
            color={submitSuccess ? 'success' : 'primary'}
            fullWidth
            disabled={!isTradeValid || isSubmitting}
            loading={isSubmitting}
            onClick={handleSubmitTrade}
            sx={{ mt: 1 }}
          >
            {submitSuccess ? '✓ Trade Submitted!' : 'Submit Trade Proposal'}
          </Button>

          {!isTradeValid && !submitSuccess && (
            <Typography level="body-xs" color="neutral" sx={{ textAlign: 'center', mt: 1 }}>
              {!selectedTeam ? 'Select a team to trade with' : 'Add items to both sides of the trade'}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
