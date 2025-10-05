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
} from '@mui/joy';
import { SportsBasketball, Person, Timer, NavigateBefore, NavigateNext } from '@mui/icons-material';
import { useDraftOrder } from '../../hooks/useDraftOrder';
import './DraftPicks.css';

interface DraftPicksProps {
  leagueId: string;
}

export default function DraftPicks({ leagueId }: DraftPicksProps) {
  const { data: draftOrder, isLoading, error } = useDraftOrder(leagueId);
  const [currentRound, setCurrentRound] = useState(1);
  const picksPerPage = 12; // Show 12 picks per page (typical league size)

  // Calculate total rounds
  const totalRounds = useMemo(() => {
    if (!draftOrder || draftOrder.length === 0) return 1;
    return Math.max(...draftOrder.map(pick => pick.round));
  }, [draftOrder]);

  // Filter picks for current round
  const currentRoundPicks = useMemo(() => {
    if (!draftOrder) return [];
    return draftOrder.filter(pick => pick.round === currentRound);
  }, [draftOrder, currentRound]);

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
          </Stack>
          
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
      </Box>

      {/* Draft Board */}
      <Box sx={{ flex: 1, p: 2 }}>
        <Card variant="outlined">
          <Table hoverRow className="draft-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Pick</th>
                <th style={{ width: '150px' }}>Team</th>
                <th style={{ width: '200px' }}>Player</th>
                <th style={{ width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentRoundPicks.map((pick) => (
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
                      <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                        {pick.team_name?.charAt(0) || '?'}
                      </Avatar>
                      <Box>
                        <Typography level="body-sm" fontWeight="bold">
                          {pick.team_name || 'Empty Team'}
                        </Typography>
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
                        <Avatar size="sm" sx={{ bgcolor: 'success.500' }}>
                          <Person />
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
              ))}
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