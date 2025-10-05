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
} from '@mui/joy';
import {
  Pause,
  PlayArrow,
  Stop,
  PersonAdd,
  SwapHoriz,
  Settings,
  Warning,
} from '@mui/icons-material';

interface DraftCommishProps {
  leagueId: string;
}

export default function DraftCommish({ leagueId }: DraftCommishProps) {
  const [draftStatus, setDraftStatus] = useState<'running' | 'paused' | 'stopped'>('running');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [allowTrades, setAllowTrades] = useState(true);
  const [allowTimeExtensions, setAllowTimeExtensions] = useState(true);

  const handlePauseDraft = () => {
    setDraftStatus('paused');
  };

  const handleResumeDraft = () => {
    setDraftStatus('running');
  };

  const handleStopDraft = () => {
    setDraftStatus('stopped');
  };

  const handleMakePick = () => {
    if (selectedTeam && selectedPlayer) {
      // TODO: Make manual pick
      alert(`Made pick: ${selectedPlayer} to ${selectedTeam}`);
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

  return (
    <Box>
      {/* Draft Status */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography level="h6" sx={{ fontWeight: 'bold' }}>
              🎛️ Draft Control
            </Typography>
            <Chip 
              color={getStatusColor(draftStatus)}
              variant="soft"
              size="sm"
            >
              {draftStatus.charAt(0).toUpperCase() + draftStatus.slice(1)}
            </Chip>
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startDecorator={<Pause />}
              onClick={handlePauseDraft}
              disabled={draftStatus === 'paused'}
              size="sm"
            >
              Pause
            </Button>
            <Button
              variant="outlined"
              startDecorator={<PlayArrow />}
              onClick={handleResumeDraft}
              disabled={draftStatus === 'running'}
              size="sm"
            >
              Resume
            </Button>
            <Button
              variant="outlined"
              color="danger"
              startDecorator={<Stop />}
              onClick={handleStopDraft}
              disabled={draftStatus === 'stopped'}
              size="sm"
            >
              Stop
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Manual Pick */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography level="h6" sx={{ mb: 2 }}>
            👤 Manual Pick
          </Typography>
          <Stack spacing={2}>
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
              variant="outlined"
              startDecorator={<PersonAdd />}
              onClick={handleMakePick}
              disabled={!selectedTeam || !selectedPlayer}
              fullWidth
            >
              Make Pick
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Draft Settings */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography level="h6" sx={{ mb: 2 }}>
            ⚙️ Draft Settings
          </Typography>
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Allow Trades</FormLabel>
              <Switch
                checked={allowTrades}
                onChange={(e) => setAllowTrades(e.target.checked)}
                color="success"
              />
              <FormHelperText>
                Enable/disable trading during draft
              </FormHelperText>
            </FormControl>
            
            <FormControl>
              <FormLabel>Allow Time Extensions</FormLabel>
              <Switch
                checked={allowTimeExtensions}
                onChange={(e) => setAllowTimeExtensions(e.target.checked)}
                color="success"
              />
              <FormHelperText>
                Allow teams to request time extensions
              </FormHelperText>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Commissioner Tools */}
      <Card variant="outlined">
        <CardContent>
          <Typography level="h6" sx={{ mb: 2 }}>
            🛠️ Commissioner Tools
          </Typography>
          <Stack spacing={1}>
            <Button
              variant="outlined"
              startDecorator={<SwapHoriz />}
              size="sm"
              fullWidth
            >
              Override Trade
            </Button>
            <Button
              variant="outlined"
              startDecorator={<Settings />}
              size="sm"
              fullWidth
            >
              Draft Settings
            </Button>
            <Button
              variant="outlined"
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

      {/* Warning */}
      <Alert color="warning" sx={{ mt: 2 }}>
        <Typography level="body-sm">
          ⚠️ Commissioner actions are logged and cannot be undone. Use with caution.
        </Typography>
      </Alert>
    </Box>
  );
}
