import React from 'react';
import {
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Stack,
  Divider,
  Alert,
} from '@mui/joy';
import { CheckCircle, Close } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useTeams } from '../hooks/useTeams';
import { useRoster } from '../hooks/useRosterManagement';

interface PostDraftModalProps {
  open: boolean;
  onClose: () => void;
  leagueId: string;
}

export default function PostDraftModal({ open, onClose, leagueId }: PostDraftModalProps) {
  const { user } = useAuth();
  const { data: teams } = useTeams(leagueId);
  const { data: roster, isLoading: rosterLoading } = useRoster(leagueId);

  const userTeam = teams?.find(team => team.user_id === user?.id);

  if (!userTeam) {
    return null;
  }

  const teamRoster = roster?.filter(player => player.team_id === userTeam.id) || [];

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: '800px',
          width: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <ModalClose />
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="success" />
            <Typography level="h3" sx={{ fontWeight: 'bold' }}>
              Draft Complete! 🎉
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Alert color="success" sx={{ mb: 3 }}>
            <Typography>
              Congratulations! Your team has been drafted. Here's your complete roster:
            </Typography>
          </Alert>

          <Box sx={{ mb: 3 }}>
            <Typography level="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
              {userTeam.team_name}
            </Typography>
            <Typography level="body-md" color="neutral">
              Owner: {user?.email}
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {rosterLoading ? (
            <Typography>Loading your roster...</Typography>
          ) : teamRoster.length === 0 ? (
            <Alert color="warning">
              <Typography>No players found on your roster.</Typography>
            </Alert>
          ) : (
            <Box>
              <Typography level="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                Your Roster ({teamRoster.length} players)
              </Typography>
              
              <Grid container spacing={2}>
                {teamRoster.map((player, index) => (
                  <Grid xs={12} sm={6} md={4} key={player.id}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
                          <Avatar
                            size="lg"
                            sx={{ 
                              width: 60, 
                              height: 60,
                              bgcolor: 'primary.500',
                              fontSize: '1.2rem'
                            }}
                          >
                            {player.name.split(' ').map(n => n[0]).join('')}
                          </Avatar>
                          
                          <Box>
                            <Typography level="body-md" sx={{ fontWeight: 'bold' }}>
                              {player.name}
                            </Typography>
                            <Typography level="body-sm" color="neutral">
                              {player.team_abbreviation} • {player.position}
                            </Typography>
                          </Box>
                          
                          <Chip 
                            color="primary" 
                            variant="soft"
                            size="sm"
                          >
                            {player.position}
                          </Chip>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
            <Button
              size="lg"
              startDecorator={<CheckCircle />}
              onClick={onClose}
              sx={{ minWidth: 200 }}
            >
              Start Managing My Team
            </Button>
          </Box>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
}
