import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Divider,
  Alert,
  Modal,
  ModalDialog,
  ModalClose,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  Select,
  Option,
  Chip,
  IconButton,
  Tooltip,
  Snackbar
} from '@mui/joy'
import {
  Add,
  Edit,
  Delete,
  Group,
  AccountTree,
  Save,
  Cancel
} from '@mui/icons-material'
import { useTeams } from '../hooks/useTeams'
import { useDivisions, useCreateDivision, useUpdateDivision, useDeleteDivision, useAssignTeamsToDivisions, type Division } from '../hooks/useDivisions'

export default function TeamsAndDivisions() {
  const { id: leagueId } = useParams<{ id: string }>()
  const { data: teams = [], isLoading: teamsLoading } = useTeams(leagueId || '')
  const { data: divisions = [], isLoading: divisionsLoading } = useDivisions(leagueId || '')
  
  const [showCreateDivision, setShowCreateDivision] = useState(false)
  const [showEditDivision, setShowEditDivision] = useState(false)
  const [editingDivision, setEditingDivision] = useState<Division | null>(null)
  const [newDivisionName, setNewDivisionName] = useState('')
  const [newDivisionDescription, setNewDivisionDescription] = useState('')
  const [teamAssignments, setTeamAssignments] = useState<Record<string, string>>({})
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color: 'success' | 'error' }>({
    open: false,
    message: '',
    color: 'success'
  })

  const { mutate: createDivision, isPending: creatingDivision } = useCreateDivision()
  const { mutate: updateDivision, isPending: updatingDivision } = useUpdateDivision()
  const { mutate: deleteDivision, isPending: deletingDivision } = useDeleteDivision()
  const { mutate: assignTeams, isPending: assigningTeams } = useAssignTeamsToDivisions()

  // Calculate max divisions based on team count (minimum 5 teams per division)
  const maxDivisions = Math.floor(teams.length / 5)
  const canCreateMoreDivisions = divisions.length < maxDivisions

  // Initialize team assignments from current data
  useEffect(() => {
    if (teams.length > 0) {
      const assignments: Record<string, string> = {}
      teams.forEach(team => {
        assignments[team.id] = team.division_id || ''
      })
      setTeamAssignments(assignments)
    }
  }, [teams])

  const handleCreateDivision = () => {
    if (!leagueId || !newDivisionName.trim()) return

    const nextOrder = divisions.length + 1
    createDivision({
      league_id: leagueId,
      name: newDivisionName.trim(),
      description: newDivisionDescription.trim() || undefined,
      division_order: nextOrder
    }, {
      onSuccess: () => {
        setNewDivisionName('')
        setNewDivisionDescription('')
        setShowCreateDivision(false)
        setSnackbar({ open: true, message: 'Division created successfully!', color: 'success' })
      },
      onError: () => {
        setSnackbar({ open: true, message: 'Failed to create division', color: 'error' })
      }
    })
  }

  const handleEditDivision = (division: Division) => {
    setEditingDivision(division)
    setNewDivisionName(division.name)
    setNewDivisionDescription(division.description || '')
    setShowEditDivision(true)
  }

  const handleUpdateDivision = () => {
    if (!editingDivision) return

    updateDivision({
      id: editingDivision.id,
      name: newDivisionName.trim(),
      description: newDivisionDescription.trim() || undefined
    }, {
      onSuccess: () => {
        setShowEditDivision(false)
        setEditingDivision(null)
        setNewDivisionName('')
        setNewDivisionDescription('')
        setSnackbar({ open: true, message: 'Division updated successfully!', color: 'success' })
      },
      onError: () => {
        setSnackbar({ open: true, message: 'Failed to update division', color: 'error' })
      }
    })
  }

  const handleDeleteDivision = (division: Division) => {
    if (!leagueId) return

    deleteDivision({
      id: division.id,
      leagueId
    }, {
      onSuccess: () => {
        setSnackbar({ open: true, message: 'Division deleted successfully!', color: 'success' })
      },
      onError: () => {
        setSnackbar({ open: true, message: 'Failed to delete division', color: 'error' })
      }
    })
  }

  const handleSaveTeamAssignments = () => {
    if (!leagueId) return

    const assignments = Object.entries(teamAssignments).map(([teamId, divisionId]) => ({
      teamId,
      divisionId: divisionId || null
    }))

    assignTeams({
      teamAssignments: assignments,
      leagueId
    }, {
      onSuccess: () => {
        setSnackbar({ open: true, message: 'Team assignments saved successfully!', color: 'success' })
      },
      onError: () => {
        setSnackbar({ open: true, message: 'Failed to save team assignments', color: 'error' })
      }
    })
  }

  if (teamsLoading || divisionsLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography level="h2" component="h1" sx={{ mb: 3 }}>
        Teams & Divisions
      </Typography>

      {/* Division Management */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography level="title-lg" startDecorator={<AccountTree />}>
              Divisions
            </Typography>
            <Button
              startDecorator={<Add />}
              onClick={() => setShowCreateDivision(true)}
              disabled={!canCreateMoreDivisions}
              size="sm"
            >
              Create Division
            </Button>
          </Box>

          {!canCreateMoreDivisions && (
            <Alert color="warning" sx={{ mb: 2 }}>
              Maximum divisions reached. You need at least 5 teams per division. 
              Current: {teams.length} teams = max {maxDivisions} divisions.
            </Alert>
          )}

          {divisions.length === 0 ? (
            <Alert color="neutral">
              No divisions created yet. Create divisions to organize your teams.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {divisions.map((division) => {
                const divisionTeams = teams.filter(team => team.division_id === division.id)
                return (
                  <Box key={division.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 'md' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography level="title-md">
                        {division.name}
                        <Chip size="sm" sx={{ ml: 1 }}>
                          {divisionTeams.length} teams
                        </Chip>
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Edit Division">
                          <IconButton
                            size="sm"
                            variant="outlined"
                            onClick={() => handleEditDivision(division)}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Division">
                          <IconButton
                            size="sm"
                            variant="outlined"
                            color="danger"
                            onClick={() => handleDeleteDivision(division)}
                            disabled={deletingDivision}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                    {division.description && (
                      <Typography level="body-sm" color="neutral">
                        {division.description}
                      </Typography>
                    )}
                    {divisionTeams.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography level="body-sm" fontWeight="md">
                          Teams:
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                          {divisionTeams.map(team => (
                            <Chip key={team.id} size="sm" variant="soft">
                              {team.team_name}
                            </Chip>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Team Assignment */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography level="title-lg" startDecorator={<Group />}>
              Team Assignments
            </Typography>
            <Button
              startDecorator={<Save />}
              onClick={handleSaveTeamAssignments}
              disabled={assigningTeams}
              size="sm"
            >
              Save Assignments
            </Button>
          </Box>

          <Stack spacing={2}>
            {teams.map((team) => (
              <Box key={team.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ minWidth: 150 }}>
                  {team.team_name}
                </Typography>
                <FormControl sx={{ minWidth: 200 }}>
                  <Select
                    value={teamAssignments[team.id] || ''}
                    onChange={(_, value) => {
                      setTeamAssignments(prev => ({
                        ...prev,
                        [team.id]: value || ''
                      }))
                    }}
                    placeholder="Select Division"
                  >
                    <Option value="">No Division</Option>
                    {divisions.map(division => (
                      <Option key={division.id} value={division.id}>
                        {division.name}
                      </Option>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Create Division Modal */}
      <Modal open={showCreateDivision} onClose={() => setShowCreateDivision(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="title-md">Create New Division</Typography>
          <Divider />
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Division Name</FormLabel>
              <Input
                value={newDivisionName}
                onChange={(e) => setNewDivisionName(e.target.value)}
                placeholder="e.g., Eastern Conference"
                autoFocus
              />
            </FormControl>
            <FormControl>
              <FormLabel>Description (Optional)</FormLabel>
              <Textarea
                value={newDivisionDescription}
                onChange={(e) => setNewDivisionDescription(e.target.value)}
                placeholder="Division description..."
                minRows={2}
              />
            </FormControl>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setShowCreateDivision(false)}
                disabled={creatingDivision}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDivision}
                disabled={creatingDivision || !newDivisionName.trim()}
                loading={creatingDivision}
              >
                Create Division
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Edit Division Modal */}
      <Modal open={showEditDivision} onClose={() => setShowEditDivision(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="title-md">Edit Division</Typography>
          <Divider />
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Division Name</FormLabel>
              <Input
                value={newDivisionName}
                onChange={(e) => setNewDivisionName(e.target.value)}
                placeholder="e.g., Eastern Conference"
                autoFocus
              />
            </FormControl>
            <FormControl>
              <FormLabel>Description (Optional)</FormLabel>
              <Textarea
                value={newDivisionDescription}
                onChange={(e) => setNewDivisionDescription(e.target.value)}
                placeholder="Division description..."
                minRows={2}
              />
            </FormControl>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setShowEditDivision(false)}
                disabled={updatingDivision}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateDivision}
                disabled={updatingDivision || !newDivisionName.trim()}
                loading={updatingDivision}
              >
                Update Division
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        color={snackbar.color}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        {snackbar.message}
      </Snackbar>
    </Box>
  )
}
