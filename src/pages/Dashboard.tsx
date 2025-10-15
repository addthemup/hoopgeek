import { 
  Box, 
  Typography, 
  Button, 
  Stack, 
  Card, 
  CardContent, 
  Grid, 
  Chip, 
  CircularProgress, 
  Alert,
  IconButton,
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Input,
  FormControl,
  FormLabel
} from '@mui/joy'
import { Delete, Warning } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUserLeagues, useRefreshLeagues } from '../hooks/useUserLeagues'
import { useDeleteLeague } from '../hooks/useDeleteLeague'
import { format } from 'date-fns'
import { useState } from 'react'
import LeagueCreationForm from '../components/LeagueCreationForm'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: leagues, isLoading, isError, error } = useUserLeagues()
  const refreshLeagues = useRefreshLeagues()
  const deleteLeagueMutation = useDeleteLeague()
  const [showCreateLeague, setShowCreateLeague] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [leagueToDelete, setLeagueToDelete] = useState<{ id: string; name: string } | null>(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClick = (e: React.MouseEvent, leagueId: string, leagueName: string) => {
    e.stopPropagation() // Prevent card click
    setLeagueToDelete({ id: leagueId, name: leagueName })
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!leagueToDelete || confirmationText !== leagueToDelete.name) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteLeagueMutation.mutateAsync(leagueToDelete.id)
      setDeleteModalOpen(false)
      setLeagueToDelete(null)
      setConfirmationText('')
      refreshLeagues.mutate() // Refresh the leagues list
    } catch (error) {
      console.error('Error deleting league:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleModalClose = () => {
    setDeleteModalOpen(false)
    setLeagueToDelete(null)
    setConfirmationText('')
    setIsDeleting(false)
  }
  
  // Show user-specific content when available
  if (!user) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h2">Please sign in to access your dashboard</Typography>
        <Button size="lg" onClick={() => navigate('/login')} sx={{ mt: 2 }}>
          Sign In
        </Button>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size="lg" />
      </Box>
    )
  }

  if (isError) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Alert color="danger" sx={{ mb: 3 }}>
          Error loading leagues: {error?.message || 'Unknown error'}
        </Alert>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography level="h2" sx={{ mb: 3 }}>
        Dashboard
      </Typography>
      
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography level="h3">
            Your Leagues
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button 
              variant="outlined"
              onClick={() => refreshLeagues.mutate()}
              loading={refreshLeagues.isPending}
            >
              Refresh
            </Button>
            <Button 
              size="lg" 
              onClick={() => setShowCreateLeague(true)}
            >
              Create League
            </Button>
          </Stack>
        </Box>

        <Grid container spacing={2}>
          {leagues?.map((league) => (
            <Grid xs={12} md={6} key={league.id}>
              <Card 
                variant="outlined" 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { 
                    boxShadow: 'md',
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
                onClick={() => navigate(`/league/${league.id}`)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography level="h4" sx={{ mb: 1 }}>
                      {league.name || 'Unnamed League'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {league.is_commissioner && (
                        <>
                          <Chip size="sm" color="primary" variant="soft">
                            Commissioner
                          </Chip>
                          <IconButton
                            size="sm"
                            color="danger"
                            variant="plain"
                            onClick={(e) => handleDeleteClick(e, league.id, league.name)}
                            sx={{ 
                              '&:hover': { 
                                bgcolor: 'danger.100' 
                              }
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </>
                      )}
                    </Stack>
                  </Box>
                  
                  {league.description && (
                    <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
                      {league.description}
                    </Typography>
                  )}

                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">
                        Teams:
                      </Typography>
                      <Typography level="body-sm">
                        {league.max_teams}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">
                        Scoring:
                      </Typography>
                      <Typography level="body-sm">
                        {league.scoring_type?.replace('_', ' ') || 'H2H Points'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">
                        Lineup:
                      </Typography>
                      <Typography level="body-sm">
                        {league.lineup_frequency || 'Weekly'}
                      </Typography>
                    </Box>

                    {league.salary_cap_enabled && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography level="body-sm" color="neutral">
                          Salary Cap:
                        </Typography>
                        <Typography level="body-sm">
                          ${((league.salary_cap_amount || 200000000) / 1000000).toFixed(0)}M
                        </Typography>
                      </Box>
                    )}

                    {league.draft_date && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography level="body-sm" color="neutral">
                          Draft:
                        </Typography>
                        <Typography level="body-sm">
                          {format(new Date(league.draft_date), 'MMM dd, yyyy')}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">
                        Status:
                      </Typography>
                      <Chip 
                        size="sm" 
                        color={league.draft_status === 'completed' ? 'success' : 'warning'}
                        variant="soft"
                      >
                        {league.draft_status || 'Scheduled'}
                      </Chip>
                    </Box>
                  </Stack>

                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography level="body-xs" color="neutral">
                      Your Team: {league.team_name}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      Joined: {league.joined_at ? format(new Date(league.joined_at as string), 'MMM dd, yyyy') : 'Unknown'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {(!leagues || leagues.length === 0) && (
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography level="h4" sx={{ mb: 2 }}>
                No leagues yet
              </Typography>
              <Typography sx={{ mb: 3 }}>
                Create your first league to get started with fantasy basketball!
              </Typography>
              <Button 
                size="lg" 
                onClick={() => setShowCreateLeague(true)}
              >
                Create Your First League
              </Button>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* League Creation Form */}
      <LeagueCreationForm
        open={showCreateLeague}
        onClose={() => setShowCreateLeague(false)}
        onSuccess={(leagueId) => {
          setShowCreateLeague(false)
          refreshLeagues.mutate() // Refresh the leagues list
          navigate(`/league/${leagueId}`) // Navigate to the new league
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal open={deleteModalOpen} onClose={handleModalClose}>
        <ModalDialog variant="outlined" role="alertdialog" sx={{ maxWidth: 500 }}>
          <ModalClose />
          <DialogTitle>
            <Warning sx={{ mr: 1 }} />
            Confirm League Deletion
          </DialogTitle>
          <Divider />
          <DialogContent>
            <Alert color="danger" sx={{ mb: 2 }}>
              <Typography level="body-sm">
                This action cannot be undone. This will permanently delete the league and all associated data including teams, rosters, and settings.
              </Typography>
            </Alert>
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              To confirm, please type the league name exactly as shown:
            </Typography>
            <Typography 
              level="body-sm" 
              sx={{ 
                fontWeight: 'bold', 
                mb: 2, 
                p: 2, 
                bgcolor: 'background.level1', 
                borderRadius: 'sm',
                fontFamily: 'monospace'
              }}
            >
              {leagueToDelete?.name}
            </Typography>
            <FormControl>
              <FormLabel>League Name</FormLabel>
              <Input
                placeholder="Type the league name here"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                disabled={isDeleting}
                autoFocus
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
              disabled={!leagueToDelete || confirmationText !== leagueToDelete.name || isDeleting}
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
