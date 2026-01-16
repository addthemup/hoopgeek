import { 
  Box, 
  Typography, 
  Button,
  Stack, 
  Card, 
  CardContent, 
  CircularProgress, 
  Alert
} from '@mui/joy'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUserLeagues } from '../hooks/useUserLeagues'
import { useState } from 'react'
import LeagueCreationForm from '../components/LeagueCreationForm'
import { Add } from '@mui/icons-material'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: leagues, isLoading, isError, error } = useUserLeagues()
  const [showCreateLeague, setShowCreateLeague] = useState(false)

  const handleLeagueClick = (leagueId: string) => {
    navigate(`/league/${leagueId}`)
  }

  const handleCreateClick = () => {
    setShowCreateLeague(true)
  }

  // Get initials from league name
  const getLeagueInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  // Generate a color based on league name
  const getLeagueColor = (name: string) => {
    const colors = [
      '#1D4ED8', // Blue
      '#7C3AED', // Purple
      '#DC2626', // Red
      '#059669', // Green
      '#D97706', // Orange
      '#DB2777', // Pink
      '#0891B2', // Cyan
      '#4F46E5', // Indigo
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  // Show user-specific content when available
  if (!user) {
    return (
      <Box sx={{ 
        bgcolor: 'background.body',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}>
        <Box sx={{ 
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          minWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto',
          pt: { xs: '12px', md: '90px' },
          pb: 2,
          px: { xs: 2, sm: 2, md: 2 },
          textAlign: 'center'
        }}>
          <Typography level="h2">Please sign in to access your dashboard</Typography>
          <Button size="lg" onClick={() => navigate('/login')} sx={{ mt: 2 }}>
            Sign In
          </Button>
        </Box>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ 
        bgcolor: 'background.body',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}>
        <Box sx={{ 
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          minWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto',
          pt: { xs: '12px', md: '90px' },
          pb: 2,
          px: { xs: 2, sm: 2, md: 2 },
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh'
        }}>
          <CircularProgress size="lg" />
        </Box>
      </Box>
    )
  }

  if (isError) {
    return (
      <Box sx={{ 
        bgcolor: 'background.body',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}>
        <Box sx={{ 
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          minWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto',
          pt: { xs: '12px', md: '90px' },
          pb: 2,
          px: { xs: 2, sm: 2, md: 2 },
        }}>
          <Alert color="danger" sx={{ mb: 3 }}>
            Error loading leagues: {error?.message || 'Unknown error'}
          </Alert>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      bgcolor: 'background.body',
      minHeight: '100vh',
      overflowX: 'hidden',
      width: '100%',
    }}>
      {/* Main Content Container - Fixed width */}
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        minWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        pt: { xs: '80px', md: '90px' },
        pb: 2,
        px: { xs: 2, sm: 2, md: 2 },
        overflowX: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* League Selector */}
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              overflowY: 'hidden',
              pb: 1,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': {
                display: 'none',
              },
            }}
          >
            {/* Create League Button */}
            <Box
              onClick={handleCreateClick}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 'fit-content',
                cursor: 'pointer',
              }}
            >
              <Box
                sx={{
                  width: { xs: 60, md: 70 },
                  height: { xs: 60, md: 70 },
                  border: '3px dashed',
                  borderColor: '#FFC72C',
                  borderRadius: '50%',
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255, 199, 44, 0.2)',
                    borderColor: '#FFD700',
                  },
                }}
              >
                <Add sx={{ fontSize: { xs: 28, md: 32 }, color: '#FFC72C' }} />
              </Box>
            </Box>

            {/* League Items */}
            {leagues && leagues.length > 0 ? (
              leagues.map((league) => {
                const leagueColor = getLeagueColor(league.name);
                const initials = getLeagueInitials(league.name);
                
                return (
                  <Box
                    key={league.id}
                    onClick={() => handleLeagueClick(league.id)}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      minWidth: 'fit-content',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: 60, md: 70 },
                        height: { xs: 60, md: 70 },
                        border: '3px solid',
                        borderColor: 'text.primary',
                        borderRadius: '50%',
                        bgcolor: leagueColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        position: 'relative',
                        '&:hover': {
                          boxShadow: '0 0 8px rgba(255,199,44,0.4)',
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          color: '#fff',
                          fontSize: { xs: '1.2rem', md: '1.4rem' },
                          fontWeight: 900,
                          fontFamily: 'serif',
                          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        }}
                      >
                        {initials}
                      </Typography>

                      {/* Commissioner Badge */}
                      {league.is_commissioner && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: '5%',
                            right: '5%',
                            bgcolor: '#FFD700',
                            color: '#000',
                            width: { xs: 16, md: 18 },
                            height: { xs: 16, md: 18 },
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: { xs: '0.6rem', md: '0.7rem' },
                            border: '2px solid',
                            borderColor: 'background.body',
                            zIndex: 2,
                          }}
                        >
                          🛡️
                        </Box>
                      )}
                    </Box>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: 'text.primary',
                        fontSize: '0.65rem',
                        maxWidth: { xs: 60, md: 70 },
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {league.name}
                    </Typography>
                  </Box>
                );
              })
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  ml: 2,
                }}
              >
                <Typography
                  level="body-sm"
                  sx={{
                    color: 'text.secondary',
                    fontFamily: 'serif',
                    fontStyle: 'italic',
                  }}
                >
                  No leagues yet. Create your first one! →
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Fantasy News & Data Section */}
        <Box>
          <Typography 
            level="h2" 
            sx={{ 
              mb: 3, 
              color: '#fff',
              fontWeight: 700 
            }}
          >
            Fantasy News
          </Typography>
          
          <Stack spacing={2}>
            {/* Placeholder for Fantasy News/Data */}
            <Card 
              variant="outlined"
              sx={{
                bgcolor: 'background.level1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography 
                  level="h4" 
                  sx={{ 
                    mb: 2, 
                    color: 'text.secondary' 
                  }}
                >
                  Fantasy News & Data Coming Soon
                </Typography>
                <Typography 
                  level="body-md" 
                  sx={{ 
                    color: 'text.tertiary',
                    maxWidth: 500,
                    mx: 'auto'
                  }}
                >
                  Stay tuned for the latest fantasy basketball news, player updates, injury reports, and expert analysis.
                </Typography>
              </CardContent>
            </Card>

            {/* Future sections can be added here:
                - Top Performers
                - Injury Reports
                - Trade Rumors
                - Waiver Wire Pickups
                - Expert Analysis
            */}
          </Stack>
        </Box>
      </Box>

      {/* League Creation Form */}
      <LeagueCreationForm
        open={showCreateLeague}
        onClose={() => setShowCreateLeague(false)}
        onSuccess={(leagueId) => {
          setShowCreateLeague(false)
          navigate(`/league/${leagueId}`) // Navigate to the new league
        }}
      />
    </Box>
  )
}
