import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  Chip,
  Avatar,
  Stack,
  Alert,
  Modal,
  ModalDialog,
  ModalClose,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Grid,
} from '@mui/joy';
import { PersonAdd, Email, Send } from '@mui/icons-material';
import { useTeams } from '../hooks/useTeams';
import { FantasyTeam } from '../types';

interface TeamInvitationManagerProps {
  leagueId: string;
}

interface InviteModalData {
  teamId: string;
  teamName: string;
  email: string;
  message: string;
}

export default function TeamInvitationManager({ leagueId }: TeamInvitationManagerProps) {
  const { data: teams, isLoading, error } = useTeams(leagueId);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState<InviteModalData>({
    teamId: '',
    teamName: '',
    email: '',
    message: '',
  });

  const handleInviteClick = (team: FantasyTeam) => {
    setInviteData({
      teamId: team.id,
      teamName: team.team_name,
      email: '',
      message: `You've been invited to join our fantasy basketball league and take over the team "${team.team_name}". Click the link below to sign up and claim your team!`,
    });
    setInviteModalOpen(true);
  };

  const handleSendInvite = () => {
    // TODO: Implement actual invitation sending
    console.log('Sending invitation:', inviteData);
    alert(`Invitation sent to ${inviteData.email} for team "${inviteData.teamName}"`);
    setInviteModalOpen(false);
    setInviteData({ teamId: '', teamName: '', email: '', message: '' });
  };

  const getTeamStatus = (team: FantasyTeam) => {
    if (team.user_id) {
      return { status: 'Assigned', color: 'success' as const };
    }
    return { status: 'Available', color: 'neutral' as const };
  };

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>Loading teams...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <Typography>Error loading teams: {error.message}</Typography>
      </Alert>
    );
  }

  if (!teams || teams.length === 0) {
    return (
      <Alert color="warning">
        <Typography>No teams found for this league.</Typography>
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Team Management & Invitations
        </Typography>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          Manage team assignments and send invitations to new managers.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Box sx={{ overflowX: 'auto' }}>
            <Table hoverRow>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>#</th>
                  <th>Team Name</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Record</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => {
                  const teamStatus = getTeamStatus(team);
                  return (
                    <tr key={team.id}>
                      <td>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {index + 1}
                        </Typography>
                      </td>
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar 
                            size="sm" 
                            sx={{ 
                              bgcolor: team.is_commissioner ? 'primary.500' : 'neutral.500',
                              width: 32,
                              height: 32
                            }}
                          >
                            {team.team_name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {team.team_name}
                            </Typography>
                            {team.is_commissioner && (
                              <Chip size="sm" color="primary" variant="soft">
                                Commissioner
                              </Chip>
                            )}
                          </Box>
                        </Box>
                      </td>
                      <td>
                        <Chip 
                          size="sm" 
                          color={teamStatus.color} 
                          variant="soft"
                        >
                          {teamStatus.status}
                        </Chip>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {team.user_id ? 'Owner Assigned' : 'TBD'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {team.wins}-{team.losses}
                        </Typography>
                      </td>
                      <td>
                        <Stack direction="row" spacing={1}>
                          {!team.user_id && (
                            <Button
                              size="sm"
                              variant="outlined"
                              color="primary"
                              startDecorator={<PersonAdd />}
                              onClick={() => handleInviteClick(team)}
                            >
                              Invite
                            </Button>
                          )}
                          {team.user_id && (
                            <Button
                              size="sm"
                              variant="outlined"
                              color="neutral"
                              disabled
                            >
                              Assigned
                            </Button>
                          )}
                        </Stack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      {/* Invitation Modal */}
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)}>
        <ModalDialog sx={{ maxWidth: 500 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Send Team Invitation
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
              You're inviting someone to take over the team:
            </Typography>
            <Typography level="body-md" sx={{ fontWeight: 'bold', mt: 1 }}>
              {inviteData.teamName}
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid xs={12}>
              <FormControl required>
                <FormLabel>Email Address</FormLabel>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  startDecorator={<Email />}
                />
              </FormControl>
            </Grid>
            
            <Grid xs={12}>
              <FormControl>
                <FormLabel>Custom Message (Optional)</FormLabel>
                <Textarea
                  placeholder="Add a personal message to the invitation"
                  value={inviteData.message}
                  onChange={(e) => setInviteData(prev => ({ ...prev, message: e.target.value }))}
                  minRows={3}
                  maxRows={6}
                />
              </FormControl>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => setInviteModalOpen(false)}
              sx={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              startDecorator={<Send />}
              onClick={handleSendInvite}
              disabled={!inviteData.email}
              sx={{ flex: 1 }}
            >
              Send Invitation
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
