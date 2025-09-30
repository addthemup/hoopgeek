import { Box, Typography, Button, Stack, Card, CardContent } from '@mui/joy'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <Typography level="h1" sx={{ mb: 2 }}>
        Welcome to HoopGeek
      </Typography>
      <Typography level="h4" sx={{ mb: 4, color: 'text.secondary' }}>
        The Future of Fantasy Basketball
      </Typography>
      
      <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography level="h3" sx={{ mb: 2 }}>
              🏀 Weekly Lineups
            </Typography>
            <Typography>
              Set your lineup once per week and let player averages determine your score. 
              No more daily micromanagement!
            </Typography>
          </CardContent>
        </Card>
        
        <Card variant="outlined">
          <CardContent>
            <Typography level="h3" sx={{ mb: 2 }}>
              💰 Salary Cap System
            </Typography>
            <Typography>
              Build your team around real NBA salaries. Trades require salary matching 
              for authentic roster management.
            </Typography>
          </CardContent>
        </Card>
        
        <Card variant="outlined">
          <CardContent>
            <Typography level="h3" sx={{ mb: 2 }}>
              🎨 Futuristic UI
            </Typography>
            <Typography>
              Experience fantasy basketball like never before with our cutting-edge 
              interface that brings your team to life.
            </Typography>
          </CardContent>
        </Card>
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
  )
}
