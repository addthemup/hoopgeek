import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Input,
  Modal,
  ModalDialog,
  ModalClose,
  Stack,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useLeagueInvitations, useSendInvitation, useCancelInvitation } from '../hooks/useLeagueInvitations';
import { Add, Email, Cancel, CheckCircle, Schedule, Error } from '@mui/icons-material';

interface LeagueInvitationManagerProps {
  leagueId: string;
}

export default function LeagueInvitationManager({ leagueId }: LeagueInvitationManagerProps) {
  const { user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [email, setEmail] = useState('');
  const [teamName, setTeamName] = useState('');
  const [message, setMessage] = useState('');

  const { data: invitations, isLoading, error } = useLeagueInvitations(leagueId);
  const sendInvitation = useSendInvitation();
  const cancelInvitation = useCancelInvitation();

  const handleSendInvitation = async () => {
    if (!email || !user?.id) return;

    try {
      await sendInvitation.mutateAsync({
        leagueId,
        email,
        teamName: teamName || undefined,
        message: message || undefined,
        invitedBy: user.id,
      });
      
      // Reset form and close modal
      setEmail('');
      setTeamName('');
      setMessage('');
      setShowInviteModal(false);
    } catch (error) {
      console.error('Failed to send invitation:', error);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation.mutateAsync(invitationId);
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'accepted': return 'success';
      case 'declined': return 'danger';
      case 'expired': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Schedule />;
      case 'accepted': return <CheckCircle />;
      case 'declined': return <Cancel />;
      case 'expired': return <Error />;
      default: return <Schedule />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography>Loading invitations...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <Typography level="body-md">
          Error loading invitations: {error.message}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography level="h4" sx={{ fontWeight: 'bold' }}>
          League Invitations
        </Typography>
        <Button
          variant="solid"
          startDecorator={<Add />}
          onClick={() => setShowInviteModal(true)}
          disabled={sendInvitation.isPending}
        >
          Send Invitation
        </Button>
      </Box>

      {/* Invitations List */}
      <Card variant="outlined">
        <CardContent>
          {!invitations || invitations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Email sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                No invitations sent yet
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 1 }}>
                Send invitations to friends to join your league
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {invitations.map((invitation) => (
                <Box
                  key={invitation.id}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Typography level="body-md" sx={{ fontWeight: 'bold' }}>
                        {invitation.email}
                      </Typography>
                      <Chip
                        size="sm"
                        color={getStatusColor(invitation.status)}
                        startDecorator={getStatusIcon(invitation.status)}
                      >
                        {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                      </Chip>
                    </Box>
                    
                    <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                      {invitation.team_name && (
                        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                          Team: {invitation.team_name}
                        </Typography>
                      )}
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        Sent: {formatDate(invitation.created_at)}
                      </Typography>
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        Expires: {formatDate(invitation.expires_at)}
                      </Typography>
                    </Stack>
                    
                    {invitation.message && (
                      <Typography level="body-sm" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        "{invitation.message}"
                      </Typography>
                    )}
                  </Box>
                  
                  {invitation.status === 'pending' && (
                    <Tooltip title="Cancel Invitation">
                      <IconButton
                        color="danger"
                        variant="outlined"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        disabled={cancelInvitation.isPending}
                      >
                        <Cancel />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Send Invitation Modal */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Send League Invitation
          </Typography>
          
          <Stack spacing={2}>
            <Input
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              startDecorator={<Email />}
              required
            />
            
            <Input
              placeholder="Team name (optional)"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            
            <Input
              placeholder="Personal message (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              multiline
              minRows={3}
            />
            
            <Alert color="info" size="sm">
              The invitation will expire in 7 days. The recipient will receive an email with instructions to join your league.
            </Alert>
            
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setShowInviteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                onClick={handleSendInvitation}
                disabled={!email || sendInvitation.isPending}
                loading={sendInvitation.isPending}
              >
                Send Invitation
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
