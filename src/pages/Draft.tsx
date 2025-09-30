import { useParams } from 'react-router-dom'
import { Box, Typography, Button, Stack, Card, CardContent, Grid, Chip } from '@mui/joy'
import { useDraftStore } from '../stores/draftStore'
import { useEffect } from 'react'

export default function Draft() {
  const { id } = useParams<{ id: string }>()
  const {
    currentPick,
    totalPicks,
    draftOrder,
    availablePlayers,
    draftPicks,
    isDraftActive,
    timeRemaining,
    setDraftActive,
    setTimeRemaining,
    autoPick
  } = useDraftStore()

  // Mock data for now
  const mockPlayers = [
    { id: '1', name: 'LeBron James', position: 'SF', team: 'LAL', salary: 47607350 },
    { id: '2', name: 'Stephen Curry', position: 'PG', team: 'GSW', salary: 51915615 },
    { id: '3', name: 'Kevin Durant', position: 'PF', team: 'PHX', salary: 46400000 },
    { id: '4', name: 'Giannis Antetokounmpo', position: 'PF', team: 'MIL', salary: 45640000 },
    { id: '5', name: 'Luka Doncic', position: 'PG', team: 'DAL', salary: 40000000 },
  ]

  const mockTeams = [
    { id: '1', name: 'Team Alpha' },
    { id: '2', name: 'Team Beta' },
    { id: '3', name: 'Team Gamma' },
    { id: '4', name: 'Team Delta' },
  ]

  useEffect(() => {
    // Initialize draft with mock data
    useDraftStore.getState().setAvailablePlayers(mockPlayers)
    useDraftStore.getState().setDraftOrder(mockTeams.map(t => t.id))
  }, [])

  const handleStartDraft = () => {
    setDraftActive(true)
    setTimeRemaining(60) // 60 seconds per pick
  }

  const handleAutoPick = () => {
    autoPick()
  }

  const currentTeam = mockTeams.find(t => t.id === draftOrder[(currentPick - 1) % draftOrder.length])

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Typography level="h2" sx={{ mb: 3 }}>
        Draft Room - League {id}
      </Typography>

      <Stack spacing={3}>
        {/* Draft Status */}
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography level="h3">
                  Pick #{currentPick} of {totalPicks}
                </Typography>
                <Typography level="body-lg" color="neutral">
                  {currentTeam?.name}'s turn
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography level="h4" color="primary">
                  {timeRemaining}s
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Time remaining
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Draft Controls */}
        <Stack direction="row" spacing={2}>
          {!isDraftActive ? (
            <Button size="lg" onClick={handleStartDraft}>
              Start Draft
            </Button>
          ) : (
            <>
              <Button size="lg" variant="outlined" onClick={handleAutoPick}>
                Auto Pick
              </Button>
              <Button size="lg" variant="soft">
                Skip Pick
              </Button>
            </>
          )}
        </Stack>

        <Grid container spacing={3}>
          {/* Available Players */}
          <Grid xs={12} md={8}>
            <Card variant="outlined">
              <CardContent>
                <Typography level="h3" sx={{ mb: 2 }}>
                  Available Players
                </Typography>
                <Stack spacing={1}>
                  {availablePlayers.map((player) => (
                    <Box 
                      key={player.id}
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 2,
                        border: '1px solid',
                        borderColor: 'neutral.200',
                        borderRadius: 'sm',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'neutral.50'
                        }
                      }}
                    >
                      <Box>
                        <Typography level="title-sm">
                          {player.name}
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {player.position} • {player.team}
                        </Typography>
                      </Box>
                      <Typography level="body-sm" color="primary">
                        ${player.salary.toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Draft Picks */}
          <Grid xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography level="h3" sx={{ mb: 2 }}>
                  Draft Picks
                </Typography>
                <Stack spacing={1}>
                  {draftPicks.map((pick) => {
                    const player = mockPlayers.find(p => p.id === pick.player_id)
                    const team = mockTeams.find(t => t.id === pick.team_id)
                    return (
                      <Box 
                        key={pick.id}
                        sx={{ 
                          p: 2,
                          border: '1px solid',
                          borderColor: 'neutral.200',
                          borderRadius: 'sm'
                        }}
                      >
                        <Typography level="body-sm" color="neutral">
                          Pick #{pick.pick_number}
                        </Typography>
                        <Typography level="title-sm">
                          {player?.name}
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {team?.name}
                        </Typography>
                      </Box>
                    )
                  })}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  )
}
