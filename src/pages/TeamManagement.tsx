import React, { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Table,
  Avatar,
  Chip,
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Input,
  FormControl,
  FormLabel,
  Snackbar,
  Divider
} from '@mui/joy'
import {
  ArrowBack,
  Add,
  Edit,
  Delete,
  Person,
  PersonOff
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useTeams } from '../hooks/useTeams'
import { useAddTeam, useUpdateTeam, useDeleteTeam } from '../hooks/useTeamManagement'
import { FantasyTeam } from '../types'

interface TeamManagementProps {
  leagueId: string
}

export default function TeamManagement({ leagueId }: TeamManagementProps) {
  const navigate = useNavigate()
  const { data: teams, isLoading, error } = useTeams(leagueId)
  const addTeamMutation = useAddTeam()
  const updateTeamMutation = useUpdateTeam()
  const deleteTeamMutation = useDeleteTeam()
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<FantasyTeam | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [editTeamName, setEditTeamName] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color: 'success' | 'error' }>({
    open: false,
    message: '',
    color: 'success'
  })

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return
    
    try {
      await addTeamMutation.mutateAsync({
        leagueId,
        teamName: newTeamName.trim()
      })
      setNewTeamName('')
      setShowAddModal(false)
      setSnackbar({ open: true, message: 'Team added successfully!', color: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to add team', color: 'error' })
    }
  }

  const handleEditTeam = async () => {
    if (!selectedTeam || !editTeamName.trim()) return
    
    try {
      await updateTeamMutation.mutateAsync({
        teamId: selectedTeam.id,
        updates: { team_name: editTeamName.trim() }
      })
      setShowEditModal(false)
      setSelectedTeam(null)
      setEditTeamName('')
      setSnackbar({ open: true, message: 'Team updated successfully!', color: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update team', color: 'error' })
    }
  }

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return
    
    try {
      await deleteTeamMutation.mutateAsync({ teamId: selectedTeam.id })
      setShowDeleteModal(false)
      setSelectedTeam(null)
      setSnackbar({ open: true, message: 'Team deleted successfully!', color: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete team', color: 'error' })
    }
  }

  const openEditModal = (team: FantasyTeam) => {
    setSelectedTeam(team)
    setEditTeamName(team.team_name)
    setShowEditModal(true)
  }

  const openDeleteModal = (team: FantasyTeam) => {
    setSelectedTeam(team)
    setShowDeleteModal(true)
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading teams...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography>Error loading teams: {error.message}</Typography>
        </Alert>
      </Box>
    )
  }

  const ownedTeams = teams?.filter(team => team.user_id) || []
  const availableTeams = teams?.filter(team => !team.user_id) || []

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
            Team Management
          </Typography>
        </Box>
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Add />}
          onClick={() => setShowAddModal(true)}
        >
          Add Team
        </Button>
      </Box>

      {/* Teams Overview */}
      <Stack spacing={3}>
        {/* Owned Teams */}
        <Card variant="outlined">
          <CardContent>
            <Typography level="h4" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person />
              Owned Teams ({ownedTeams.length})
            </Typography>
            {ownedTeams.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Owner</th>
                    <th>Record</th>
                    <th>Draft Position</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ownedTeams.map((team) => (
                    <tr key={team.id}>
                      <td>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar size="sm">
                            {team.team_name.split(' ').map(n => n[0]).join('')}
                          </Avatar>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {team.team_name}
                          </Typography>
                        </Stack>
                      </td>
                      <td>
                        <Chip size="sm" color="success" variant="soft">
                          Has Owner
                        </Chip>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {team.wins}-{team.losses}-{team.ties}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {team.draft_position || 'N/A'}
                        </Typography>
                      </td>
                      <td>
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            size="sm"
                            variant="outlined"
                            color="primary"
                            onClick={() => openEditModal(team)}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="outlined"
                            color="danger"
                            onClick={() => openDeleteModal(team)}
                          >
                            <Delete />
                          </IconButton>
                        </Stack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Alert color="neutral">
                <Typography>No teams with owners yet.</Typography>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Available Teams */}
        <Card variant="outlined">
          <CardContent>
            <Typography level="h4" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonOff />
              Available Teams ({availableTeams.length})
            </Typography>
            {availableTeams.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Status</th>
                    <th>Record</th>
                    <th>Draft Position</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {availableTeams.map((team) => (
                    <tr key={team.id}>
                      <td>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar size="sm">
                            {team.team_name.split(' ').map(n => n[0]).join('')}
                          </Avatar>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {team.team_name}
                          </Typography>
                        </Stack>
                      </td>
                      <td>
                        <Chip size="sm" color="warning" variant="soft">
                          Available
                        </Chip>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {team.wins}-{team.losses}-{team.ties}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {team.draft_position || 'N/A'}
                        </Typography>
                      </td>
                      <td>
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            size="sm"
                            variant="outlined"
                            color="primary"
                            onClick={() => openEditModal(team)}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="outlined"
                            color="danger"
                            onClick={() => openDeleteModal(team)}
                          >
                            <Delete />
                          </IconButton>
                        </Stack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Alert color="neutral">
                <Typography>No available teams. All teams have owners.</Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* Add Team Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
        <ModalDialog variant="outlined" role="alertdialog">
          <DialogTitle>Add New Team</DialogTitle>
          <Divider />
          <DialogContent>
            <FormControl>
              <FormLabel>Team Name</FormLabel>
              <Input
                placeholder="Enter team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                autoFocus
              />
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleAddTeam}
              loading={addTeamMutation.isPending}
              disabled={!newTeamName.trim()}
            >
              Add Team
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Edit Team Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalDialog variant="outlined" role="alertdialog">
          <DialogTitle>Edit Team</DialogTitle>
          <Divider />
          <DialogContent>
            <FormControl>
              <FormLabel>Team Name</FormLabel>
              <Input
                placeholder="Enter team name"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                autoFocus
              />
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleEditTeam}
              loading={updateTeamMutation.isPending}
              disabled={!editTeamName.trim()}
            >
              Update Team
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Delete Team Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <ModalDialog variant="outlined" role="alertdialog">
          <DialogTitle>Delete Team</DialogTitle>
          <Divider />
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{selectedTeam?.team_name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              onClick={handleDeleteTeam}
              loading={deleteTeamMutation.isPending}
            >
              Delete Team
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        color={snackbar.color}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        autoHideDuration={3000}
      >
        {snackbar.message}
      </Snackbar>
    </Box>
  )
}
