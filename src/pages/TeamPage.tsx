import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Grid,
  Avatar,
  Divider,
  LinearProgress,
  Alert,
} from '@mui/joy'
import { ArrowBack, Favorite, FavoriteBorder } from '@mui/icons-material'
import { supabase } from '../utils/supabase'
import IconButton from '@mui/joy/IconButton'
import { useAuth } from '../hooks/useAuth'
import { useIsTeamFavorited, useToggleFavoriteTeam } from '../hooks/useUserSettings'
import { useMediaQuery } from '@mui/material'

interface TeamData {
  id: string
  team_id: number
  abbreviation: string
  nickname: string
  city: string
  year_founded: number
  arena: string
  arena_capacity: number | null
  owner: string
  general_manager: string | null
  head_coach: string
  d_league_affiliation: string | null
  website: string | null
  twitter: string | null
  instagram: string | null
  facebook: string | null
  youtube: string | null
}

export default function TeamPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: teamData, isLoading, error } = useQuery({
    queryKey: ['team', id],
    queryFn: async () => {
      if (!id) throw new Error('Team ID is required')

      const { data, error } = await supabase
        .from('nba_teams')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('❌ Error fetching team:', error)
        throw new Error(`Failed to fetch team: ${error.message}`)
      }

      return data as TeamData
    },
    enabled: !!id,
  })

  const { data: isFavorite } = useIsTeamFavorited(user?.id, teamData?.team_id)
  const toggleFavoriteMutation = useToggleFavoriteTeam()

  const handleFavoriteToggle = async () => {
    if (!user || !teamData) return
    
    try {
      await toggleFavoriteMutation.mutateAsync({ 
        userId: user.id, 
        teamId: teamData.team_id 
      })
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ bgcolor: 'background.body', minHeight: '100vh', py: 4 }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto', px: 2 }}>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography>Loading team data...</Typography>
        </Box>
      </Box>
    )
  }

  if (error || !teamData) {
    return (
      <Box sx={{ bgcolor: 'background.body', minHeight: '100vh', py: 4 }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto', px: 2 }}>
          <Alert color="danger" sx={{ mb: 2 }}>
            {error instanceof Error ? error.message : 'Team not found'}
          </Alert>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBack />
          </IconButton>
        </Box>
      </Box>
    )
  }

  // Detect mobile for proper spacing
  const isMobile = useMediaQuery('(max-width: 900px)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isMobileHeight = useMediaQuery('(max-height: 600px)')
  const isLandscapeMobile = isLandscape && isMobileHeight

  return (
    <Box sx={{ bgcolor: 'background.body', minHeight: '100vh' }}>
      <Box sx={{ 
        maxWidth: '1200px', 
        mx: 'auto', 
        px: 2,
        pt: isLandscapeMobile 
          ? '60px' 
          : { xs: '59px', md: 'calc((100vh - 40px) / 16 + 20px)' }, // Nav bar height (59px on mobile) + margin on desktop
        pb: 4,
      }}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
          <IconButton
            onClick={() => navigate(-1)}
            sx={{ '&:hover': { bgcolor: 'rgba(255, 215, 0, 0.1)' } }}
          >
            <ArrowBack />
          </IconButton>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: 'primary.500',
              fontSize: '1.5rem',
              fontWeight: 600,
            }}
          >
            {teamData.abbreviation}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography level="h2" sx={{ fontWeight: 700 }}>
              {teamData.city} {teamData.nickname}
            </Typography>
            <Typography level="body-md" sx={{ color: 'text.secondary' }}>
              {teamData.abbreviation}
            </Typography>
          </Box>
          {user && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: 'sm',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: isFavorite ? 'danger.50' : 'background.level1',
              }}
            >
              <IconButton
                variant={isFavorite ? "solid" : "outlined"}
                color={isFavorite ? "danger" : "neutral"}
                size="sm"
                sx={{ p: 0.5 }}
                onClick={handleFavoriteToggle}
                disabled={!user || toggleFavoriteMutation.isPending}
                loading={toggleFavoriteMutation.isPending}
              >
                {isFavorite ? (
                  <Favorite sx={{ fontSize: '1.1rem' }} />
                ) : (
                  <FavoriteBorder sx={{ fontSize: '1.1rem' }} />
                )}
              </IconButton>
            </Box>
          )}
        </Stack>

        {/* Main Content */}
        <Grid container spacing={3}>
          {/* Team Information */}
          <Grid xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography level="title-lg" sx={{ mb: 2, fontWeight: 600 }}>
                  Team Information
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      Founded
                    </Typography>
                    <Typography level="body-md">{teamData.year_founded}</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      Arena
                    </Typography>
                    <Typography level="body-md">
                      {teamData.arena}
                      {teamData.arena_capacity && (
                        <Typography component="span" level="body-sm" sx={{ color: 'text.secondary', ml: 1 }}>
                          ({teamData.arena_capacity.toLocaleString()} capacity)
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      Owner
                    </Typography>
                    <Typography level="body-md">{teamData.owner}</Typography>
                  </Box>
                  {teamData.general_manager && (
                    <>
                      <Divider />
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          General Manager
                        </Typography>
                        <Typography level="body-md">{teamData.general_manager}</Typography>
                      </Box>
                    </>
                  )}
                  <Divider />
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      Head Coach
                    </Typography>
                    <Typography level="body-md">{teamData.head_coach}</Typography>
                  </Box>
                  {teamData.d_league_affiliation && (
                    <>
                      <Divider />
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          G League Affiliation
                        </Typography>
                        <Typography level="body-md">{teamData.d_league_affiliation}</Typography>
                      </Box>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Social Links */}
          <Grid xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography level="title-lg" sx={{ mb: 2, fontWeight: 600 }}>
                  Social Media
                </Typography>
                <Stack spacing={2}>
                  {teamData.twitter && (
                    <Box>
                      <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        Twitter
                      </Typography>
                      <Typography
                        component="a"
                        href={teamData.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        level="body-md"
                        sx={{
                          color: 'primary.400',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {teamData.twitter}
                      </Typography>
                    </Box>
                  )}
                  {teamData.instagram && (
                    <>
                      <Divider />
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          Instagram
                        </Typography>
                        <Typography
                          component="a"
                          href={teamData.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          level="body-md"
                          sx={{
                            color: 'primary.400',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {teamData.instagram}
                        </Typography>
                      </Box>
                    </>
                  )}
                  {teamData.facebook && (
                    <>
                      <Divider />
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          Facebook
                        </Typography>
                        <Typography
                          component="a"
                          href={teamData.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          level="body-md"
                          sx={{
                            color: 'primary.400',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {teamData.facebook}
                        </Typography>
                      </Box>
                    </>
                  )}
                  {teamData.youtube && (
                    <>
                      <Divider />
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                          YouTube
                        </Typography>
                        <Typography
                          component="a"
                          href={teamData.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          level="body-md"
                          sx={{
                            color: 'primary.400',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {teamData.youtube}
                        </Typography>
                      </Box>
                    </>
                  )}
                  {!teamData.twitter && !teamData.instagram && !teamData.facebook && !teamData.youtube && (
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      No social media links available
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}
