import React, { useState } from 'react';
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
  Input,
  Switch,
  FormControl,
  FormLabel,
  FormHelperText,
  Chip,
  Slider,
} from '@mui/joy';
import {
  Pause,
  PlayArrow,
  Stop,
  PersonAdd,
  SwapHoriz,
  Settings,
  Warning,
  Timer,
  SkipNext,
  Undo,
} from '@mui/icons-material';
import { useDraftCommissioner } from '../../hooks/useDraftCommissioner';

interface DraftCommishProps {
  leagueId: string;
}

export default function DraftCommish({ leagueId }: DraftCommishProps) {
  const {
    commissionerState,
    draftState,
    currentPick,
    pauseDraft,
    resumeDraft,
    updateTimePerPick,
    extendPickTimer,
    skipCurrentPick,
    reversePick,
    isCommissioner
  } = useDraftCommissioner(leagueId);

  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');

  const handlePauseDraft = () => {
    pauseDraft.mutate();
  };

  const handleResumeDraft = () => {
    resumeDraft.mutate();
  };

  const handleStopDraft = () => {
    // TODO: Implement stop draft functionality
    alert('Stop draft functionality not yet implemented');
  };

  const handleMakePick = () => {
    if (selectedTeam && selectedPlayer) {
      // TODO: Make manual pick
      alert(`Made pick: ${selectedPlayer} to ${selectedTeam}`);
    }
  };

  const handleExtendTimer = (seconds: number) => {
    extendPickTimer.mutate(seconds);
  };

  const handleSkipPick = () => {
    skipCurrentPick.mutate();
  };

  const handleReversePick = () => {
    if (window.confirm('Are you sure you want to reverse the last pick? This cannot be undone.')) {
      reversePick.mutate();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'paused':
        return 'warning';
      case 'stopped':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
      {/* Draft Status & Controls */}
      <Card variant="outlined" sx={{ height: 'fit-content' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
              🎛️ Control
            </Typography>
            <Chip 
              color={getStatusColor(commissionerState.isPaused ? 'paused' : 'running')}
              variant="soft"
              size="sm"
            >
              {commissionerState.isPaused ? 'Paused' : 'Live'}
            </Chip>
          </Box>

          {currentPick && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'primary.softBg', borderRadius: 'sm' }}>
              <Typography level="body-xs" sx={{ mb: 0.5, opacity: 0.8 }}>Current Pick</Typography>
              <Typography level="h4" sx={{ fontWeight: 'bold' }}>#{currentPick.pick_number}</Typography>
              {commissionerState.currentPickTimer !== null && (
                <Typography level="body-sm" sx={{ mt: 0.5, color: commissionerState.currentPickTimer <= 10 ? 'danger.500' : 'inherit' }}>
                  {formatTime(commissionerState.currentPickTimer)} remaining
                </Typography>
              )}
            </Box>
          )}
          
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="soft"
                startDecorator={<Pause />}
                onClick={handlePauseDraft}
                disabled={commissionerState.isPaused || pauseDraft.isPending}
                loading={pauseDraft.isPending}
                size="sm"
                fullWidth
              >
                Pause
              </Button>
              <Button
                variant="soft"
                color="success"
                startDecorator={<PlayArrow />}
                onClick={handleResumeDraft}
                disabled={!commissionerState.isPaused || resumeDraft.isPending}
                loading={resumeDraft.isPending}
                size="sm"
                fullWidth
              >
                Resume
              </Button>
            </Stack>
            
            <Stack direction="row" spacing={1}>
              <Button
                variant="soft"
                color="warning"
                startDecorator={<Undo />}
                onClick={handleReversePick}
                disabled={reversePick.isPending}
                loading={reversePick.isPending}
                size="sm"
                fullWidth
              >
                Reverse
              </Button>
              <Button
                variant="soft"
                color="danger"
                startDecorator={<Stop />}
                onClick={handleStopDraft}
                size="sm"
                fullWidth
              >
                Stop
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Pick Timer Controls */}
      {currentPick && commissionerState.currentPickTimer !== null && (
        <Card variant="outlined" sx={{ height: 'fit-content' }}>
          <CardContent>
            <Typography level="title-md" sx={{ fontWeight: 'bold', mb: 2 }}>
              ⏱️ Timer
            </Typography>
            
            <Stack spacing={1}>
              <Button
                variant="soft"
                onClick={() => handleExtendTimer(30)}
                disabled={extendPickTimer.isPending}
                size="sm"
                fullWidth
              >
                +30 seconds
              </Button>
              <Button
                variant="soft"
                onClick={() => handleExtendTimer(60)}
                disabled={extendPickTimer.isPending}
                size="sm"
                fullWidth
              >
                +1 minute
              </Button>
              <Button
                variant="soft"
                color="warning"
                startDecorator={<SkipNext />}
                onClick={handleSkipPick}
                disabled={skipCurrentPick.isPending}
                loading={skipCurrentPick.isPending}
                size="sm"
                fullWidth
              >
                Skip Pick
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Manual Pick */}
      <Card variant="outlined" sx={{ height: 'fit-content' }}>
        <CardContent>
          <Typography level="title-md" sx={{ fontWeight: 'bold', mb: 2 }}>
            👤 Manual Pick
          </Typography>
          <Stack spacing={1.5}>
            <Select
              placeholder="Select team..."
              value={selectedTeam}
              onChange={(_, value) => setSelectedTeam(value as string)}
              size="sm"
            >
              <Option value="team1">Team 1</Option>
              <Option value="team2">Team 2</Option>
              <Option value="team3">Team 3</Option>
              <Option value="team4">Team 4</Option>
            </Select>
            
            <Select
              placeholder="Select player..."
              value={selectedPlayer}
              onChange={(_, value) => setSelectedPlayer(value as string)}
              size="sm"
            >
              <Option value="player1">LeBron James</Option>
              <Option value="player2">Stephen Curry</Option>
              <Option value="player3">Kevin Durant</Option>
              <Option value="player4">Giannis Antetokounmpo</Option>
            </Select>
            
            <Button
              variant="solid"
              startDecorator={<PersonAdd />}
              onClick={handleMakePick}
              disabled={!selectedTeam || !selectedPlayer}
              size="sm"
              fullWidth
            >
              Make Pick
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Draft Settings */}
      <Card variant="outlined" sx={{ height: 'fit-content' }}>
        <CardContent>
          <Typography level="title-md" sx={{ fontWeight: 'bold', mb: 2 }}>
            ⚙️ Settings
          </Typography>
          
          <Stack spacing={2}>
            <Box>
              <Typography level="body-sm" sx={{ mb: 1 }}>
                Time Per Pick: {commissionerState.timePerPick}s
              </Typography>
              <Slider
                value={commissionerState.timePerPick}
                onChange={(_, value) => updateTimePerPick.mutate(value as number)}
                min={10}
                max={300}
                step={10}
                size="sm"
                disabled={updateTimePerPick.isPending}
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level="body-sm">Allow Trades</Typography>
              <Switch
                checked={commissionerState.allowTrades}
                onChange={(e) => setCommissionerState(prev => ({ ...prev, allowTrades: e.target.checked }))}
                size="sm"
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level="body-sm">Time Extensions</Typography>
              <Switch
                checked={commissionerState.allowTimeExtensions}
                onChange={(e) => setCommissionerState(prev => ({ ...prev, allowTimeExtensions: e.target.checked }))}
                size="sm"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card variant="outlined" sx={{ height: 'fit-content' }}>
        <CardContent>
          <Typography level="title-md" sx={{ fontWeight: 'bold', mb: 2 }}>
            🛠️ Tools
          </Typography>
          <Stack spacing={1}>
            <Button
              variant="soft"
              startDecorator={<SwapHoriz />}
              size="sm"
              fullWidth
            >
              Override Trade
            </Button>
            <Button
              variant="soft"
              startDecorator={<Settings />}
              size="sm"
              fullWidth
            >
              Draft Settings
            </Button>
            <Button
              variant="soft"
              color="warning"
              startDecorator={<Warning />}
              size="sm"
              fullWidth
            >
              Reset Pick
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Warning - Spans full width on larger screens */}
      <Box sx={{ gridColumn: { xs: '1', lg: '1 / -1' } }}>
        <Alert color="warning" variant="soft">
          <Typography level="body-sm">
            ⚠️ Commissioner actions are logged. Use with caution.
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
}

