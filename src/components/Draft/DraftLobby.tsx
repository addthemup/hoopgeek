import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Avatar,
  Chip,
  Button,
  Alert,
  Grid,
} from '@mui/joy';
import { People, Schedule, Chat } from '@mui/icons-material';
import { useDraftLobbyParticipants, useJoinDraftLobby, useUpdateLobbyStatus } from '../../hooks/useDraftLobby';
import { useAuth } from '../../hooks/useAuth';
import { useTeams } from '../../hooks/useTeams';
import { useLeague } from '../../hooks/useLeagues';

interface DraftLobbyProps {
  leagueId: string;
  onStartDraft?: () => void;
}

export default function DraftLobby({ leagueId, onStartDraft }: DraftLobbyProps) {
  const { user } = useAuth();
  const { data: league } = useLeague(leagueId);
  const { data: teams } = useTeams(leagueId);
  const { data: participants, isLoading: participantsLoading } = useDraftLobbyParticipants(leagueId);
  const joinLobby = useJoinDraftLobby();
  const updateStatus = useUpdateLobbyStatus();

  // Find user's team
  const userTeam = teams?.find(team => team.user_id === user?.id);
  const isUserInLobby = participants?.some(p => p.user_id === user?.id);

  // Auto-join lobby when component mounts
  useEffect(() => {
    if (userTeam && !isUserInLobby && !joinLobby.isPending) {
      joinLobby.mutate({ leagueId, fantasyTeamId: userTeam.id });
    }
  }, [userTeam, isUserInLobby, leagueId, joinLobby]);

  // Update status periodically to show as online
  useEffect(() => {
    if (isUserInLobby) {
      const interval = setInterval(() => {
        updateStatus.mutate({ leagueId });
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isUserInLobby, leagueId, updateStatus]);

  const getTimeUntilDraft = () => {
    if (!league?.draft_date) return null;
    
    const now = new Date();
    const draftTime = new Date(league.draft_date);
    const timeDiff = draftTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) return 'Draft starting now!';
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const isCommissioner = league?.commissioner_id === user?.id;
  const canStartDraft = isCommissioner && participants && participants.length >= 2;

  return (
    <Box sx={{ p: 3 }}>
      {/* Lobby Header */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <People />
            <Typography level="h3">Draft Lobby</Typography>
            <Chip color="primary" variant="soft">
              {participants?.length || 0} / {league?.max_teams || 0} teams
            </Chip>
          </Stack>
          
          <Stack direction="row" spacing={2} alignItems="center">
            <Schedule />
            <Typography level="body-md">
              Draft starts in: <strong>{getTimeUntilDraft() || 'Not scheduled'}</strong>
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Participants Grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {teams?.map((team) => {
          const participant = participants?.find(p => p.fantasy_team_id === team.id);
          const isOnline = participant?.is_online;
          const isCurrentUser = team.user_id === user?.id;
          
          return (
            <Grid xs={12} sm={6} md={4} key={team.id}>
              <Card 
                variant="outlined" 
                sx={{ 
                  opacity: isOnline ? 1 : 0.6,
                  borderColor: isCurrentUser ? 'primary.500' : undefined,
                  borderWidth: isCurrentUser ? 2 : 1
                }}
              >
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar 
                      size="lg" 
                      sx={{ 
                        bgcolor: isOnline ? 'success.500' : 'neutral.500',
                        border: isCurrentUser ? '2px solid' : 'none',
                        borderColor: 'primary.500'
                      }}
                    >
                      {team.team_name.charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography level="title-sm" fontWeight="bold">
                        {team.team_name}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        {team.user_id ? 'Owner Assigned' : 'TBD'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip 
                          size="sm" 
                          color={isOnline ? 'success' : 'neutral'} 
                          variant="soft"
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </Chip>
                        {isCurrentUser && (
                          <Chip size="sm" color="primary" variant="soft">
                            You
                          </Chip>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Lobby Actions */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography level="h4">Ready to Draft?</Typography>
            
            {!isUserInLobby && userTeam && (
              <Alert color="warning" variant="soft">
                You're not in the lobby yet. Click below to join!
              </Alert>
            )}
            
            {!userTeam && (
              <Alert color="danger" variant="soft">
                You need to be assigned to a team to join the draft lobby.
              </Alert>
            )}
            
            <Stack direction="row" spacing={2}>
              {!isUserInLobby && userTeam && (
                <Button
                  onClick={() => joinLobby.mutate({ leagueId, fantasyTeamId: userTeam.id })}
                  loading={joinLobby.isPending}
                  startDecorator={<People />}
                >
                  Join Lobby
                </Button>
              )}
              
              {isCommissioner && (
                <Button
                  onClick={onStartDraft}
                  disabled={!canStartDraft}
                  color="success"
                  startDecorator={<Schedule />}
                >
                  Start Draft
                </Button>
              )}
            </Stack>
            
            {isCommissioner && !canStartDraft && (
              <Alert color="warning" variant="soft">
                Need at least 2 teams in the lobby to start the draft.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
