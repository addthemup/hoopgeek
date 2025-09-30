import { Box, Typography, Button, Stack, Card, CardContent, Grid, Chip } from '@mui/joy'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4 }}>
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography level="h1" sx={{ mb: 2, fontSize: '3rem', fontWeight: 'bold' }}>
          🏀 HoopGeek
        </Typography>
        <Typography level="h3" sx={{ mb: 3, color: 'text.secondary' }}>
          Your Basketball Mecca
        </Typography>
        <Typography level="h5" sx={{ mb: 4, color: 'text.tertiary', maxWidth: 800, mx: 'auto' }}>
          Where fantasy basketball meets advanced analytics, daily highlights, and community insights. 
          Experience the game like never before.
        </Typography>
        
        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 4 }}>
          <Chip color="primary" variant="soft" size="lg">Fantasy Basketball</Chip>
          <Chip color="success" variant="soft" size="lg">Daily Highlights</Chip>
          <Chip color="warning" variant="soft" size="lg">Advanced Analytics</Chip>
          <Chip color="danger" variant="soft" size="lg">Community</Chip>
        </Stack>

        <Stack direction="row" spacing={2} justifyContent="center">
          {user ? (
            <Button size="lg" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button size="lg" variant="solid" onClick={() => navigate('/login')}>
                Get Started
              </Button>
              <Button size="lg" variant="outlined" onClick={() => navigate('/login')}>
                Sign In
              </Button>
            </>
          )}
        </Stack>
      </Box>

      {/* Features Grid */}
      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                🏀 Fantasy Basketball
              </Typography>
              <Typography sx={{ mb: 2 }}>
                Weekly lineups, salary cap management, and automatic injury handling. 
                Build your dream team with real NBA salaries.
              </Typography>
              <Button variant="soft" onClick={() => navigate('/fantasy')}>
                Explore Fantasy
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                🎬 Daily Highlights
              </Typography>
              <Typography sx={{ mb: 2 }}>
                Curated game highlights with advanced stats analysis. 
                Discover the most exciting plays and performances.
              </Typography>
              <Button variant="soft" onClick={() => navigate('/highlights')}>
                Watch Highlights
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                📊 Advanced Analytics
              </Typography>
              <Typography sx={{ mb: 2 }}>
                Deep dive into player performance, team trends, and predictive insights. 
                Make data-driven decisions.
              </Typography>
              <Button variant="soft" onClick={() => navigate('/analysis')}>
                View Analysis
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                💬 Community
              </Typography>
              <Typography sx={{ mb: 2 }}>
                Connect with fellow basketball enthusiasts. Share insights, 
                debate strategies, and celebrate the game together.
              </Typography>
              <Button variant="soft" onClick={() => navigate('/community')}>
                Join Community
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Coming Soon Section */}
      <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'background.level1', borderRadius: 'md' }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          🚀 Coming Soon
        </Typography>
        <Typography sx={{ mb: 3, color: 'text.secondary' }}>
          We're building the ultimate basketball platform with betting insights, 
          social features, and much more.
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
          <Chip variant="outlined">Betting Analysis</Chip>
          <Chip variant="outlined">Social Trading</Chip>
          <Chip variant="outlined">Mobile App</Chip>
          <Chip variant="outlined">Live Chat</Chip>
        </Stack>
      </Box>
    </Box>
  )
}
