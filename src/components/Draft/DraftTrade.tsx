import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Chip,
  Select,
  Option,
  Input,
  Textarea,
  Avatar,
  Grid,
  Divider,
} from '@mui/joy';
import {
  SwapHoriz,
  Add,
  Remove,
  Timer,
  Person,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTeams } from '../../hooks/useTeams';
import { useTeamDraftPicks, useTeamDraftedPlayers } from '../../hooks/useTeamDraftData';
import { useNextPick } from '../../hooks/useNextPick';

interface DraftTradeProps {
  leagueId: string;
}

export default function DraftTrade({ leagueId }: DraftTradeProps) {
  const { user } = useAuth();
  const { data: teams } = useTeams(leagueId);
  const [timeExtensions, setTimeExtensions] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [tradeMessage, setTradeMessage] = useState('');

  // Check if draft is complete
  const { data: nextPick } = useNextPick(leagueId);
  const isDraftComplete = nextPick === null;

  // Get current user's team
  const userTeam = teams?.find(team => team.user_id === user?.id);
  
  // Get draft data for user's team
  const { data: userDraftPicks } = useTeamDraftPicks(leagueId, userTeam?.id || '');
  const { data: userDraftedPlayers } = useTeamDraftedPlayers(leagueId, userTeam?.id || '');
  
  // Get draft data for selected team
  const { data: selectedTeamDraftPicks } = useTeamDraftPicks(leagueId, selectedTeam);
  const { data: selectedTeamDraftedPlayers } = useTeamDraftedPlayers(leagueId, selectedTeam);

  const handleRequestTimeExtension = () => {
    if (timeExtensions < 3) {
      setTimeExtensions(prev => prev + 1);
    }
  };

  const handleSendTradeMessage = () => {
    if (tradeMessage.trim()) {
      // TODO: Send trade message
      setTradeMessage('');
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

  return (
    <Box>
      {/* Time Extension */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography level="h6" sx={{ mb: 2 }}>
            ⏰ Time Extension
          </Typography>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography level="body-sm">
                Extensions used: {timeExtensions}/3
              </Typography>
              <Chip 
                color={timeExtensions >= 3 ? 'danger' : 'success'}
                variant="soft"
                size="sm"
              >
                {timeExtensions >= 3 ? 'Max Used' : 'Available'}
              </Chip>
            </Box>
            
            <Button
              variant="outlined"
              startDecorator={<Timer />}
              onClick={handleRequestTimeExtension}
              disabled={timeExtensions >= 3}
              fullWidth
            >
              Request +2:00 Extension
            </Button>
            
            {timeExtensions > 0 && (
              <Alert color="info" size="sm">
                <Typography level="body-xs">
                  You have used {timeExtensions} time extension{timeExtensions !== 1 ? 's' : ''} this draft.
                </Typography>
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Team Comparison */}
      {selectedTeam && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography level="h6" sx={{ mb: 2 }}>
              📊 Team Comparison
            </Typography>
            <Grid container spacing={2}>
              {/* Your Team */}
              <Grid xs={6}>
                <Box sx={{ p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                  <Typography level="title-sm" sx={{ mb: 1, color: 'primary.500' }}>
                    {userTeam?.team_name} (You)
                  </Typography>
                  
                  {/* Draft Picks */}
                  <Typography level="body-sm" fontWeight="bold" sx={{ mb: 1 }}>
                    Remaining Picks:
                  </Typography>
                  <Stack spacing={0.5} sx={{ mb: 2 }}>
                    {userDraftPicks?.filter(pick => !pick.is_completed).slice(0, 5).map((pick) => (
                      <Chip key={pick.pick_number} size="sm" variant="soft" color="primary">
                        R{pick.round} P{pick.pick_number}
                      </Chip>
                    ))}
                    {userDraftPicks?.filter(pick => !pick.is_completed).length > 5 && (
                      <Typography level="body-xs" color="neutral">
                        +{userDraftPicks.filter(pick => !pick.is_completed).length - 5} more...
                      </Typography>
                    )}
                  </Stack>

                  {/* Drafted Players */}
                  <Typography level="body-sm" fontWeight="bold" sx={{ mb: 1 }}>
                    Drafted Players:
                  </Typography>
                  <Stack spacing={0.5}>
                    {userDraftedPlayers?.slice(0, 3).map((player) => (
                      <Box key={player.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar size="sm" sx={{ width: 20, height: 20 }}>
                          {player.name.charAt(0)}
                        </Avatar>
                        <Typography level="body-xs">
                          {player.name} ({player.position})
                        </Typography>
                      </Box>
                    ))}
                    {userDraftedPlayers && userDraftedPlayers.length > 3 && (
                      <Typography level="body-xs" color="neutral">
                        +{userDraftedPlayers.length - 3} more...
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Grid>

              {/* Selected Team */}
              <Grid xs={6}>
                <Box sx={{ p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                  <Typography level="title-sm" sx={{ mb: 1, color: 'warning.500' }}>
                    {teams?.find(t => t.id === selectedTeam)?.team_name}
                  </Typography>
                  
                  {/* Draft Picks */}
                  <Typography level="body-sm" fontWeight="bold" sx={{ mb: 1 }}>
                    Remaining Picks:
                  </Typography>
                  <Stack spacing={0.5} sx={{ mb: 2 }}>
                    {selectedTeamDraftPicks?.filter(pick => !pick.is_completed).slice(0, 5).map((pick) => (
                      <Chip key={pick.pick_number} size="sm" variant="soft" color="warning">
                        R{pick.round} P{pick.pick_number}
                      </Chip>
                    ))}
                    {selectedTeamDraftPicks?.filter(pick => !pick.is_completed).length > 5 && (
                      <Typography level="body-xs" color="neutral">
                        +{selectedTeamDraftPicks.filter(pick => !pick.is_completed).length - 5} more...
                      </Typography>
                    )}
                  </Stack>

                  {/* Drafted Players */}
                  <Typography level="body-sm" fontWeight="bold" sx={{ mb: 1 }}>
                    Drafted Players:
                  </Typography>
                  <Stack spacing={0.5}>
                    {selectedTeamDraftedPlayers?.slice(0, 3).map((player) => (
                      <Box key={player.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar size="sm" sx={{ width: 20, height: 20 }}>
                          {player.name.charAt(0)}
                        </Avatar>
                        <Typography level="body-xs">
                          {player.name} ({player.position})
                        </Typography>
                      </Box>
                    ))}
                    {selectedTeamDraftedPlayers && selectedTeamDraftedPlayers.length > 3 && (
                      <Typography level="body-xs" color="neutral">
                        +{selectedTeamDraftedPlayers.length - 3} more...
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Trade Proposals */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography level="h6" sx={{ mb: 2 }}>
            🔄 Trade Proposals
          </Typography>
          <Stack spacing={2}>
            <Select
              placeholder="Select team to trade with..."
              value={selectedTeam}
              onChange={(_, value) => setSelectedTeam(value as string)}
              size="sm"
            >
              {teams?.filter(team => team.id !== userTeam?.id).map((team) => (
                <Option key={team.id} value={team.id}>
                  {team.team_name}
                </Option>
              ))}
            </Select>
            
            <Textarea
              placeholder="Send a trade message..."
              value={tradeMessage}
              onChange={(e) => setTradeMessage(e.target.value)}
              minRows={3}
              size="sm"
            />
            
            <Button
              variant="outlined"
              startDecorator={<SwapHoriz />}
              onClick={handleSendTradeMessage}
              disabled={!selectedTeam || !tradeMessage.trim()}
              fullWidth
            >
              Send Trade Message
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Active Trades */}
      <Card variant="outlined">
        <CardContent>
          <Typography level="h6" sx={{ mb: 2 }}>
            📋 Active Trades
          </Typography>
          
          <Alert color="info" sx={{ mb: 2 }}>
            <Typography level="body-sm">
              No active trade proposals at this time.
            </Typography>
          </Alert>
          
          <Stack spacing={1}>
            <Typography level="body-sm" color="neutral">
              • Trade draft picks for players
            </Typography>
            <Typography level="body-sm" color="neutral">
              • Trade players for future picks
            </Typography>
            <Typography level="body-sm" color="neutral">
              • Multi-player package deals
            </Typography>
            <Typography level="body-sm" color="neutral">
              • All trades must be approved by both parties
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
