import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  Avatar,
  Chip,
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  DialogActions,
  Input,
  FormControl,
  FormLabel,
  LinearProgress
} from '@mui/joy'
import {
  Delete,
  Warning,
  People,
  CalendarToday,
  ArrowBack,
  AdminPanelSettings
} from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import { useLeague } from '../hooks/useLeagues'
import { useTeams } from '../hooks/useTeams'
import { useDeleteLeague } from '../hooks/useDeleteLeague'

interface DeleteLeagueProps {
  leagueId: string
}

export default function DeleteLeague({ leagueId }: DeleteLeagueProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: league, isLoading: leagueLoading } = useLeague(leagueId)
  const { data: teams, isLoading: teamsLoading } = useTeams(leagueId)
  const deleteLeagueMutation = useDeleteLeague()
  
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const isCommissioner = league?.commissioner_id === user?.id
  const leagueAge = league ? Math.floor((Date.now() - new Date(league.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0
  const memberCount = teams?.length || 0

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (confirmationText !== league?.name) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteLeagueMutation.mutateAsync(leagueId)
      // Navigate to leagues list after successful deletion
      navigate('/leagues')
    } catch (error) {
      console.error('Error deleting league:', error)
      setIsDeleting(false)
    }
  }

  const handleModalClose = () => {
    setShowDeleteModal(false)
    setConfirmationText('')
    setIsDeleting(false)
  }

  if (!isCommissioner) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography>You are not authorized to delete this league. Only the commissioner can delete the league.</Typography>
        </Alert>
      </Box>
    )
  }

  if (leagueLoading || teamsLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading league information...</Typography>
      </Box>
    )
  }

  if (!league) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography>League not found.</Typography>
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startDecorator={<ArrowBack />}
          onClick={() => navigate(-1)}
          size="sm"
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography level="h2" component="h1" sx={{ fontWeight: 'bold' }}>
          Delete League
        </Typography>
      </Box>

      {/* Warning Alert */}
      <Alert color="danger" sx={{ mb: 3 }}>
        <Warning sx={{ mr: 1 }} />
        <Typography level="body-md" sx={{ fontWeight: 'bold' }}>
          This action cannot be undone. All league data, including teams, rosters, and settings will be permanently deleted.
        </Typography>
      </Alert>

      {/* League Information */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography level="h3" sx={{ mb: 3, fontWeight: 'bold' }}>
            League Information
          </Typography>
          
          <Stack spacing={3}>
            {/* League Name */}
            <Box>
              <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                League Name
              </Typography>
              <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                {league.name}
              </Typography>
            </Box>

            {/* League Description */}
            {league.description && (
              <Box>
                <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                  Description
                </Typography>
                <Typography level="body-md">
                  {league.description}
                </Typography>
              </Box>
            )}

            {/* League Stats */}
            <Box>
              <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
                League Statistics
              </Typography>
              <Stack direction="row" spacing={3}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <People sx={{ mr: 1, color: 'primary.500' }} />
                  <Typography level="body-sm">
                    {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CalendarToday sx={{ mr: 1, color: 'primary.500' }} />
                  <Typography level="body-sm">
                    {leagueAge} {leagueAge === 1 ? 'Day' : 'Days'} Old
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AdminPanelSettings sx={{ mr: 1, color: 'primary.500' }} />
                  <Typography level="body-sm">
                    {league.scoring_type} Scoring
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Divider />

            {/* League Members */}
            <Box>
              <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
                League Members
              </Typography>
              {teams && teams.length > 0 ? (
                <List size="sm">
                  {teams.map((team) => (
                    <ListItem key={team.id}>
                      <ListItemDecorator>
                        <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                          {team.team_name.charAt(0)}
                        </Avatar>
                      </ListItemDecorator>
                      <ListItemContent>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {team.team_name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {team.user_id ? 'Owner Assigned' : 'Available'}
                        </Typography>
                      </ListItemContent>
                      {team.user_id === league.commissioner_id && (
                        <Chip size="sm" color="primary" variant="soft">
                          Commissioner
                        </Chip>
                      )}
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography level="body-sm" color="neutral">
                  No members found
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Delete Button */}
      <Card variant="outlined" sx={{ borderColor: 'danger.300' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography level="h4" color="danger" sx={{ fontWeight: 'bold' }}>
              Delete League
            </Typography>
            <Typography level="body-md" color="neutral">
              Once you delete this league, there is no going back. Please be certain.
            </Typography>
            <Button
              color="danger"
              variant="solid"
              startDecorator={<Delete />}
              onClick={handleDeleteClick}
              disabled={deleteLeagueMutation.isPending}
              sx={{ alignSelf: 'flex-start' }}
            >
              Delete League
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal open={showDeleteModal} onClose={handleModalClose}>
        <ModalDialog variant="outlined" role="alertdialog" sx={{ maxWidth: 500 }}>
          <DialogTitle>
            <Warning sx={{ mr: 1 }} />
            Confirm League Deletion
          </DialogTitle>
          <Divider />
          <DialogContent>
            <Typography level="body-md" sx={{ mb: 2 }}>
              This action cannot be undone. This will permanently delete the league and all associated data.
            </Typography>
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              To confirm, please type the league name exactly as shown:
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 2, p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
              {league.name}
            </Typography>
            <FormControl>
              <FormLabel>League Name</FormLabel>
              <Input
                placeholder="Type the league name here"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                disabled={isDeleting}
              />
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={handleModalClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              variant="solid"
              startDecorator={<Delete />}
              onClick={handleDeleteConfirm}
              disabled={confirmationText !== league.name || isDeleting}
              loading={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete League'}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </Box>
  )
}
