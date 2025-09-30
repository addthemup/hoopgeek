import { Box, Typography, Button, Stack, Card, CardContent, Grid, Chip, CircularProgress, Alert } from '@mui/joy'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUserLeagues, useRefreshLeagues } from '../hooks/useUserLeagues'
import { format } from 'date-fns'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: leagues, isLoading, isError, error } = useUserLeagues()
  const refreshLeagues = useRefreshLeagues()

  
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
              onClick={() => navigate('/create-league')}
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
                      {league.name}
                    </Typography>
                    {league.is_commissioner && (
                      <Chip size="sm" color="primary" variant="soft">
                        Commissioner
                      </Chip>
                    )}
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
                          ${(league.salary_cap_amount / 1000000).toFixed(0)}M
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
                      Joined: {format(new Date(league.joined_at), 'MMM dd, yyyy')}
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
                onClick={() => navigate('/create-league')}
              >
                Create Your First League
              </Button>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
