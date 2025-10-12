import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Avatar,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Table,
  Switch,
} from '@mui/joy';
import { SportsBasketball, Timer, NavigateBefore, NavigateNext, SwapHoriz, FilterList } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useDraftOrder } from '../../hooks/useDraftOrder';
import './DraftPicks.css';

interface DraftPicksProps {
  leagueId: string;
  userTeamId?: string;
}

export default function DraftPicks({ leagueId, userTeamId }: DraftPicksProps) {
  const { data: draftOrder, isLoading, error } = useDraftOrder(leagueId);
  const [currentRound, setCurrentRound] = useState(1);
  const [showTrades, setShowTrades] = useState(true);
  const picksPerPage = 12; // Show 12 picks per page (typical league size)
  
  // Fetch accepted trades directly
  const { data: allTrades = [] } = useQuery({
    queryKey: ['accepted-trades', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      const { data, error } = await supabase
        .from('draft_trade_offers')
        .select(`
          id,
          league_id,
          from_team_id,
          to_team_id,
          offered_players,
          offered_picks,
          requested_players,
          requested_picks,
          status,
          created_at,
          responded_at,
          from_team:fantasy_teams!from_team_id(team_name),
          to_team:fantasy_teams!to_team_id(team_name)
        `)
        .eq('league_id', leagueId)
        .eq('status', 'accepted')
        .order('responded_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching accepted trades:', error);
        return [];
      }
      
      console.log('✅ Fetched accepted trades:', data?.length || 0, data);
      
      // Transform the data to match expected format
      const transformedTrades = (data || []).map((trade: any) => ({
        ...trade,
        from_team_name: trade.from_team?.team_name,
        to_team_name: trade.to_team?.team_name,
        offered_players: [],
        offered_picks: trade.offered_picks?.map((pn: number) => ({ pick_number: pn })) || [],
        requested_players: [],
        requested_picks: trade.requested_picks?.map((pn: number) => ({ pick_number: pn })) || [],
      }));
      
      console.log('🔄 Transformed trades:', transformedTrades);
      return transformedTrades;
    },
    enabled: !!leagueId,
    refetchInterval: 5000,
  });

  // Calculate total rounds
  const totalRounds = useMemo(() => {
    if (!draftOrder || draftOrder.length === 0) return 1;
    return Math.max(...draftOrder.map(pick => pick.round));
  }, [draftOrder]);

  // Filter accepted trades only
  const acceptedTrades = useMemo(() => {
    const filtered = allTrades.filter(trade => trade.status === 'accepted');
    console.log('🎯 Accepted trades for display:', filtered.length, filtered);
    return filtered;
  }, [allTrades]);

  // Merge picks and trades, sorted chronologically
  const currentRoundItems = useMemo(() => {
    if (!draftOrder) return [];
    
    const roundPicks = draftOrder.filter(pick => pick.round === currentRound);
    
    if (!showTrades || acceptedTrades.length === 0) {
      return roundPicks.map(pick => ({ type: 'pick' as const, data: pick }));
    }

    // Create combined array of picks and trades
    const items: Array<{ type: 'pick' | 'trade'; data: any; timestamp: Date }> = [];
    
    // Add all picks with their timestamps (completed picks have pick_made_at)
    roundPicks.forEach(pick => {
      items.push({
        type: 'pick',
        data: pick,
        // Use pick_made_at (when pick was actually made) for completed picks
        // Use epoch (0) for pending picks so they sort first
        timestamp: pick.pick_made_at ? new Date(pick.pick_made_at) : new Date(0)
      });
    });
    
    // Add accepted trades with their responded_at timestamp (when trade was accepted)
    acceptedTrades.forEach(trade => {
      // Use responded_at (when trade was accepted), fallback to created_at
      const tradeTimestamp = trade.responded_at ? new Date(trade.responded_at) : new Date(trade.created_at);
      
      // Find which picks this trade falls between
      const tradedPickNumbers = [
        ...(trade.offered_picks?.map(p => p.pick_number) || []),
        ...(trade.requested_picks?.map(p => p.pick_number) || [])
      ];
      
      // Only include trade if any of the traded picks are in this round
      const hasPicksInRound = tradedPickNumbers.some(pickNum => {
        const pick = draftOrder.find(p => p.pick_number === pickNum);
        return pick && pick.round === currentRound;
      });
      
      if (hasPicksInRound) {
        items.push({
          type: 'trade',
          data: trade,
          timestamp: tradeTimestamp
        });
      }
    });
    
    // Sort by timestamp (picks first if same time)
    items.sort((a, b) => {
      const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
      if (timeDiff !== 0) return timeDiff;
      // If same time, picks come before trades
      return a.type === 'pick' ? -1 : 1;
    });
    
    console.log(`📊 Round ${currentRound} items:`, {
      total: items.length,
      picks: items.filter(i => i.type === 'pick').length,
      trades: items.filter(i => i.type === 'trade').length,
      showTrades,
      items
    });
    
    return items;
  }, [draftOrder, currentRound, acceptedTrades, showTrades]);

  // Calculate current pick number
  const currentPick = useMemo(() => {
    if (!draftOrder) return 1;
    const nextPick = draftOrder.find(pick => !pick.is_completed);
    return nextPick?.pick_number || draftOrder.length + 1;
  }, [draftOrder]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'PG':
        return 'primary';
      case 'SG':
        return 'success';
      case 'SF':
        return 'warning';
      case 'PF':
        return 'danger';
      case 'C':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  const getRowClassName = (pick: any) => {
    if (pick.is_completed) return 'completed-pick';
    if (pick.pick_number === currentPick) return 'current-pick';
    return 'pending-pick';
  };

  if (isLoading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger" variant="soft">
        Error loading draft picks: {error.message}
      </Alert>
    );
  }

  if (!draftOrder || draftOrder.length === 0) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <SportsBasketball sx={{ fontSize: 64, color: 'neutral.400', mb: 2 }} />
        <Typography level="h4" color="neutral">
          No Draft Order Found
        </Typography>
        <Typography level="body-md" color="neutral">
          Draft order will be generated when teams are filled
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <SportsBasketball />
            <Typography level="h4">Draft Board</Typography>
            <Chip size="sm" color="primary" variant="soft">
              Round {currentRound} of {totalRounds}
            </Chip>
            <Chip size="sm" color="warning" variant="soft">
              Pick #{currentPick}
            </Chip>
            {acceptedTrades.length > 0 && (
              <Chip size="sm" color="success" variant="soft">
                {acceptedTrades.length} Trade{acceptedTrades.length !== 1 ? 's' : ''}
              </Chip>
            )}
          </Stack>
          
          {/* Round Pagination & Trade Filter */}
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Trade Toggle */}
            {acceptedTrades.length > 0 && (
              <Card 
                variant="outlined" 
                sx={{ 
                  px: 1.5, 
                  py: 0.5,
                  bgcolor: showTrades ? 'primary.50' : 'neutral.50',
                  borderColor: showTrades ? 'primary.300' : 'neutral.300'
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <SwapHoriz sx={{ fontSize: '1.2rem', color: showTrades ? 'primary.500' : 'neutral.500' }} />
                  <Typography level="body-sm" fontWeight="md">Show Trades</Typography>
                  <Switch
                    checked={showTrades}
                    onChange={(e) => setShowTrades(e.target.checked)}
                    size="sm"
                    color={showTrades ? 'primary' : 'neutral'}
                  />
                </Stack>
              </Card>
            )}
            
            {/* Round Pagination */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                size="sm"
                startDecorator={<NavigateBefore />}
                onClick={() => setCurrentRound(Math.max(1, currentRound - 1))}
                disabled={currentRound === 1}
              >
                Prev
              </Button>
              <Typography level="body-sm">
                Round {currentRound} of {totalRounds}
              </Typography>
              <Button
                variant="outlined"
                size="sm"
                endDecorator={<NavigateNext />}
                onClick={() => setCurrentRound(Math.min(totalRounds, currentRound + 1))}
                disabled={currentRound === totalRounds}
              >
                Next
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      {/* Draft Board */}
      <Box sx={{ flex: 1, p: 2 }}>
        <Card variant="outlined">
          <Table hoverRow className="draft-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Time</th>
                <th style={{ width: '80px' }}>Pick</th>
                <th style={{ width: '150px' }}>Team</th>
                <th style={{ width: '200px' }}>Player</th>
                <th style={{ width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentRoundItems.map((item, index) => {
                if (item.type === 'trade') {
                  // Render trade row
                  const trade = item.data;
                  const tradeTime = new Date(trade.responded_at || trade.created_at);
                  return (
                    <tr 
                      key={`trade-${trade.id}`}
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        borderLeft: '6px solid rgba(59, 130, 246, 1)',
                        borderRight: '6px solid rgba(59, 130, 246, 1)',
                      }}
                    >
                      <td colSpan={5}>
                        <Box sx={{ py: 1.5, px: 2 }}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            {/* Time Column */}
                            <Box sx={{ minWidth: '100px', textAlign: 'center' }}>
                              <Typography level="body-sm" fontWeight="bold" color="primary">
                                {tradeTime.toLocaleTimeString()}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                Trade
                              </Typography>
                            </Box>
                            
                            <Avatar size="md" sx={{ bgcolor: 'primary.600' }}>
                              <SwapHoriz />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                <Chip size="sm" color="primary" variant="solid" startDecorator={<SwapHoriz />}>
                                  TRADE COMPLETED
                                </Chip>
                                <Typography level="body-md" fontWeight="bold">
                                  {trade.from_team_name} ↔ {trade.to_team_name}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={3} sx={{ ml: 1 }}>
                                {/* Offered Assets */}
                                {(trade.offered_players?.length > 0 || trade.offered_picks?.length > 0) && (
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Typography level="body-xs" color="neutral">Sent:</Typography>
                                    {trade.offered_players?.map((p: any) => (
                                      <Chip key={p.id} size="sm" variant="outlined" color="neutral">
                                        {p.name}
                                      </Chip>
                                    ))}
                                    {trade.offered_picks?.map((p: any) => (
                                      <Chip key={p.pick_number} size="sm" variant="outlined" color="primary">
                                        Pick #{p.pick_number}
                                      </Chip>
                                    ))}
                                  </Stack>
                                )}
                                {/* Requested Assets */}
                                {(trade.requested_players?.length > 0 || trade.requested_picks?.length > 0) && (
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Typography level="body-xs" color="neutral">Received:</Typography>
                                    {trade.requested_players?.map((p: any) => (
                                      <Chip key={p.id} size="sm" variant="outlined" color="neutral">
                                        {p.name}
                                      </Chip>
                                    ))}
                                    {trade.requested_picks?.map((p: any) => (
                                      <Chip key={p.pick_number} size="sm" variant="outlined" color="primary">
                                        Pick #{p.pick_number}
                                      </Chip>
                                    ))}
                                  </Stack>
                                )}
                              </Stack>
                            </Box>
                          </Stack>
                        </Box>
                      </td>
                    </tr>
                  );
                }
                
                // Render pick row
                const pick = item.data;
                const pickTime = pick.pick_made_at ? new Date(pick.pick_made_at) : null;
                return (
                  <tr 
                    key={pick.pick_number}
                    className={getRowClassName(pick)}
                    style={{
                      backgroundColor: pick.is_completed 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : pick.pick_number === currentPick 
                          ? 'rgba(251, 191, 36, 0.2)' 
                          : 'rgba(156, 163, 175, 0.1)',
                      animation: pick.pick_number === currentPick && !pick.is_completed 
                        ? 'pulse-warning 2s infinite' 
                        : 'none'
                    }}
                  >
                  {/* Time Column */}
                  <td>
                    <Box sx={{ textAlign: 'center' }}>
                      {pickTime ? (
                        <>
                          <Typography level="body-sm" fontWeight="bold">
                            {pickTime.toLocaleTimeString()}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {pickTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </Typography>
                        </>
                      ) : (
                        <Typography level="body-xs" color="neutral">
                          {pick.pick_number === currentPick ? 'On Clock' : 'Pending'}
                        </Typography>
                      )}
                    </Box>
                  </td>
                  <td>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="h4" color={pick.is_completed ? 'primary' : 'neutral'}>
                        #{pick.pick_number}
                      </Typography>
                      {pick.pick_number === currentPick && !pick.is_completed && (
                        <Chip size="sm" color="warning" variant="soft">
                          <Timer />
                        </Chip>
                      )}
                    </Box>
                  </td>
                  <td>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar size="sm" sx={{ bgcolor: pick.is_traded ? 'warning.500' : 'primary.500' }}>
                        {(pick.is_traded ? pick.current_owner_name : pick.team_name)?.charAt(0) || '?'}
                      </Avatar>
                      <Box>
                        <Typography level="body-sm" fontWeight="bold">
                          {pick.original_team_name || pick.team_name || 'Empty Team'}
                        </Typography>
                        {pick.is_traded && pick.current_owner_name && (
                          <Chip
                            size="sm"
                            color="primary"
                            variant="soft"
                            sx={{ fontSize: '0.65rem', height: '18px', mt: 0.5 }}
                          >
                            → {pick.current_owner_name}
                          </Chip>
                        )}
                      </Box>
                    </Stack>
                  </td>
                  <td>
                    {!pick.player_name ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar size="sm" sx={{ bgcolor: 'neutral.300' }}>
                          ?
                        </Avatar>
                        <Typography level="body-sm" color="neutral">
                          Not selected
                        </Typography>
                      </Box>
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar 
                          size="sm" 
                          src={pick.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${pick.nba_player_id}.png` : undefined}
                          sx={{ 
                            bgcolor: 'success.500',
                            '& img': {
                              objectFit: 'cover'
                            }
                          }}
                          onError={(e) => {
                            // Fallback to initials if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && pick.player_name) {
                              parent.textContent = pick.player_name.split(' ').map(n => n[0]).join('');
                            }
                          }}
                        >
                          {pick.player_name?.split(' ').map(n => n[0]).join('') || '?'}
                        </Avatar>
                        <Box>
                          <Typography level="body-sm" fontWeight="bold">
                            {pick.player_name}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              size="sm"
                              color={getPositionColor(pick.position)}
                              variant="soft"
                            >
                              {pick.position}
                            </Chip>
                            <Typography level="body-xs" color="neutral">
                              {pick.team_abbreviation}
                            </Typography>
                            {pick.salary_2025_26 && (
                              <Typography level="body-xs" fontWeight="bold" color="primary">
                                ${(pick.salary_2025_26 / 1000000).toFixed(1)}M
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    )}
                  </td>
                  <td>
                    {pick.is_completed ? (
                      <Chip size="sm" color="success" variant="soft">Completed</Chip>
                    ) : pick.pick_number === currentPick ? (
                      <Chip size="sm" color="warning" variant="soft">On the Clock</Chip>
                    ) : (
                      <Chip size="sm" color="neutral" variant="soft">Pending</Chip>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </Box>

      {/* Round Navigation */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
          <Button
            variant="outlined"
            size="sm"
            startDecorator={<NavigateBefore />}
            onClick={() => setCurrentRound(Math.max(1, currentRound - 1))}
            disabled={currentRound === 1}
          >
            Previous Round
          </Button>
          <Typography level="body-sm" color="neutral">
            Round {currentRound} of {totalRounds}
          </Typography>
          <Button
            variant="outlined"
            size="sm"
            endDecorator={<NavigateNext />}
            onClick={() => setCurrentRound(Math.min(totalRounds, currentRound + 1))}
            disabled={currentRound === totalRounds}
          >
            Next Round
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}