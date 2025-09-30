import { Box, Typography, Button, Stack, Card, CardContent, Grid } from '@mui/joy'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Mock data for now
  const leagues = [
    { id: '1', name: 'My League', teams: 8, draftDate: '2024-01-15' },
    { id: '2', name: 'Friends League', teams: 10, draftDate: '2024-01-20' },
  ]

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
          <Button 
            size="lg" 
            onClick={() => navigate('/create-league')}
          >
            Create League
          </Button>
        </Box>

        <Grid container spacing={2}>
          {leagues.map((league) => (
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
                  <Typography level="h4" sx={{ mb: 1 }}>
                    {league.name}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    {league.teams} teams
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Draft: {league.draftDate}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {leagues.length === 0 && (
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
