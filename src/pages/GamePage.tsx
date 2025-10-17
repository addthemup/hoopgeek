import { Box, Typography, Stack, Card, CardContent, Chip, Grid, AspectRatio, Divider } from '@mui/joy'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ArrowBack from '@mui/icons-material/ArrowBack'
import TrendingUp from '@mui/icons-material/TrendingUp'
import LocalFireDepartment from '@mui/icons-material/LocalFireDepartment'
import SportsBasketball from '@mui/icons-material/SportsBasketball'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import Timer from '@mui/icons-material/Timer'
import { getGameById, FullGameData } from '../utils/gameLoader'

// FullGameData interface is now imported from gameLoader

// Mock data removed - now using real data from JSON files

export default function GamePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [gameData, setGameData] = useState<FullGameData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadGameData = async () => {
      if (!id) {
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        const data = await getGameById(id)
        setGameData(data)
      } catch (error) {
        console.error(`Error loading game ${id}:`, error)
        setGameData(null)
      } finally {
        setLoading(false)
      }
    }
    
    loadGameData()
  }, [id])

  if (loading || !gameData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Typography level="h3">Loading game...</Typography>
      </Box>
    )
  }

  const { story, fun_score, team_stats = {}, lead_changes, dunk_stats, deep_shots, scoring_milestones = {} } = gameData
  const { winner, loser } = story.teams
  
  // Safely get team stats with defaults
  const marginOfVictory = team_stats['Margin of Victory'] || Math.abs(winner.points - loser.points)
  const teamThrees = team_stats['Team Threes'] || {}
  const teamThreePercent = team_stats['Team Three %'] || {}
  const teamPace = team_stats['Team Pace'] || {}
  const teamFastBreakPoints = team_stats['Team Fast Break Points'] || {}
  const teamContestedShots = team_stats['Team Contested Shots'] || {}

  // Get fun score color
  const getFunScoreColor = (score: number): 'danger' | 'warning' | 'success' | 'primary' => {
    if (score >= 95) return 'danger'
    if (score >= 85) return 'warning'
    if (score >= 75) return 'success'
    return 'primary'
  }

  // Format percentage values
  const formatStat = (value: number, statName: string): string => {
    if (statName.includes('%') || statName.includes('Percentage')) {
      return (value * 100).toFixed(1) + '%'
    }
    return value.toFixed(1)
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 4, px: 2 }}>
      {/* Back Button */}
      <Box sx={{ mb: 3 }}>
        <Chip
          startDecorator={<ArrowBack />}
          onClick={() => navigate('/')}
          sx={{ cursor: 'pointer' }}
        >
          Back to Feed
        </Chip>
      </Box>

      {/* Hero Section with Video/Image */}
      <Card sx={{ mb: 4 }}>
        <AspectRatio ratio="21/9" sx={{ minHeight: 300 }}>
          {gameData.video_url ? (
            <video
              controls
              poster={gameData.thumbnail_url}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            >
              <source src={gameData.video_url} type="video/mp4" />
            </video>
          ) : (
            <img
              src={gameData.thumbnail_url || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200'}
              alt={story.matchup}
              style={{ objectFit: 'cover' }}
            />
          )}
        </AspectRatio>
      </Card>

      {/* Score Header */}
      <Card sx={{ mb: 4, bgcolor: 'background.level1' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 1 }}>
                {gameData.gameMetadata?.arena} • {new Date(gameData.date).toLocaleDateString()}
              </Typography>
              <Typography level="h1" sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
                {winner.city} <Box component="span" sx={{ color: 'success.plainColor', fontWeight: 'bold' }}>{winner.points}</Box>
                {' '}-{' '}
                {loser.city} <Box component="span" sx={{ color: 'danger.plainColor' }}>{loser.points}</Box>
              </Typography>
              <Typography level="body-md" sx={{ color: 'text.secondary', mt: 1 }}>
                {winner.tricode} defeats {loser.tricode} by {marginOfVictory} points
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ textAlign: 'center' }}>
                <Chip
                  size="lg"
                  color={getFunScoreColor(fun_score)}
                  variant="solid"
                  startDecorator={<LocalFireDepartment />}
                  sx={{ fontSize: 'xl', fontWeight: 'bold', px: 3, py: 1 }}
                >
                  {fun_score.toFixed(1)}
                </Chip>
                <Typography level="body-xs" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  Fun Score
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Left Column - Story & Highlights */}
        <Grid xs={12} lg={8}>
          {/* Game Story */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                📖 How {winner.city} Won
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              {story.advantages.length > 0 ? (
                <Stack spacing={2}>
                  <Typography level="body-md" sx={{ color: 'text.secondary', mb: 1 }}>
                    {winner.city} dominated in {story.advantages.length} key statistical categories:
                  </Typography>
                  
                  {story.advantages.map((advantage, index) => (
                    <Card key={index} variant="soft" color={index < 3 ? 'primary' : 'neutral'}>
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              {index === 0 && <TrendingUp color="success" />}
                              <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                                {advantage.stat_name}
                              </Typography>
                              {index < 3 && (
                                <Chip size="sm" color="primary" variant="solid">
                                  Key Factor
                                </Chip>
                              )}
                            </Stack>
                            <Stack direction="row" spacing={4} sx={{ mt: 1 }}>
                              <Box>
                                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                                  {advantage.teamTricode}
                                </Typography>
                                <Typography level="h4" sx={{ color: 'success.plainColor' }}>
                                  {formatStat(advantage.value1, advantage.stat_name)}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                                  Opponent
                                </Typography>
                                <Typography level="h4" sx={{ color: 'danger.plainColor' }}>
                                  {formatStat(advantage.value2, advantage.stat_name)}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                                  Difference
                                </Typography>
                                <Typography level="h4" sx={{ color: 'primary.plainColor' }}>
                                  +{formatStat(Math.abs(advantage.diff), advantage.stat_name)}
                                </Typography>
                              </Box>
                            </Stack>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Typography>No significant advantages recorded.</Typography>
              )}
            </CardContent>
          </Card>

          {/* Game Flow & Excitement */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                🎯 Game Excitement
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid xs={6} sm={3}>
                  <Card variant="soft" color="warning">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <SwapHoriz sx={{ fontSize: '2rem', mb: 1 }} />
                      <Typography level="h2">{lead_changes.total}</Typography>
                      <Typography level="body-sm">Lead Changes</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid xs={6} sm={3}>
                  <Card variant="soft" color="danger">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Timer sx={{ fontSize: '2rem', mb: 1 }} />
                      <Typography level="h2">{lead_changes.last_5_minutes}</Typography>
                      <Typography level="body-sm">Last 5 Min</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid xs={6} sm={3}>
                  <Card variant="soft" color="success">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <SportsBasketball sx={{ fontSize: '2rem', mb: 1 }} />
                      <Typography level="h2">{dunk_stats['Total Dunks']}</Typography>
                      <Typography level="body-sm">Total Dunks</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid xs={6} sm={3}>
                  <Card variant="soft" color="primary">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <LocalFireDepartment sx={{ fontSize: '2rem', mb: 1 }} />
                      <Typography level="h2">{deep_shots.deep_threes}</Typography>
                      <Typography level="body-sm">Deep Threes</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {lead_changes.buzzer_beater > 0 && (
                <Card variant="solid" color="danger" sx={{ mt: 2 }}>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <LocalFireDepartment sx={{ fontSize: '2rem' }} />
                      <Box>
                        <Typography level="title-lg" sx={{ color: 'white' }}>
                          {lead_changes.buzzer_beater} Buzzer Beater{lead_changes.buzzer_beater > 1 ? 's' : ''}!
                        </Typography>
                        <Typography level="body-sm" sx={{ color: 'white' }}>
                          Game-defining moments in the final seconds
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Dunk Breakdown */}
          {dunk_stats['Total Dunks'] > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography level="h3" sx={{ mb: 2 }}>
                  💪 Dunk Breakdown
                </Typography>
                <Divider sx={{ my: 2 }} />
                
                <Grid container spacing={2}>
                  {Object.entries(dunk_stats).map(([type, count]) => {
                    if (type === 'Total Dunks' || count === 0) return null
                    return (
                      <Grid key={type} xs={6} sm={4}>
                        <Card variant="soft">
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography level="h3" sx={{ color: 'primary.plainColor' }}>
                              {count}
                            </Typography>
                            <Typography level="body-sm">{type}</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    )
                  })}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Player Milestones */}
          {(scoring_milestones?.['40 Ball']?.length > 0 || scoring_milestones?.['Triple Double']?.length > 0) && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography level="h3" sx={{ mb: 2 }}>
                  ⭐ Player Milestones
                </Typography>
                <Divider sx={{ my: 2 }} />
                
                <Stack spacing={2}>
                  {(scoring_milestones?.['70 Ball'] || []).map(([player, points]) => (
                    <Card key={player} variant="solid" color="danger">
                      <CardContent>
                        <Typography level="h4" sx={{ color: 'white' }}>
                          🔥 {player} - {points} Points (70-Point Game!)
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {(scoring_milestones?.['60 Ball'] || []).map(([player, points]) => (
                    <Card key={player} variant="solid" color="warning">
                      <CardContent>
                        <Typography level="h4" sx={{ color: 'white' }}>
                          🔥 {player} - {points} Points (60-Point Game!)
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {(scoring_milestones?.['50 Ball'] || []).map(([player, points]) => (
                    <Card key={player} variant="soft" color="warning">
                      <CardContent>
                        <Typography level="title-lg">
                          🏀 {player} - {points} Points (50-Point Game)
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {(scoring_milestones?.['40 Ball'] || []).map(([player, points]) => (
                    <Card key={player} variant="soft" color="primary">
                      <CardContent>
                        <Typography level="title-md">
                          🎯 {player} - {points} Points
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {(scoring_milestones?.['Triple Double'] || []).map(([player, stats]) => (
                    <Card key={player} variant="soft" color="success">
                      <CardContent>
                        <Typography level="title-md" sx={{ mb: 0.5 }}>
                          📊 {player} - Triple Double
                        </Typography>
                        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                          {stats}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Column - Team Stats */}
        <Grid xs={12} lg={4}>
          {/* Team Statistics */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                📊 Team Statistics
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              <Stack spacing={2}>
                {/* Three Point Shooting */}
                <Box>
                  <Typography level="title-md" sx={{ mb: 1 }}>Three-Point Shooting</Typography>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography level="body-sm">{winner.tricode}</Typography>
                    <Typography level="title-sm">
                      {teamThrees[winner.tricode] || 0} ({teamThreePercent[winner.tricode] || 0}%)
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-sm">{loser.tricode}</Typography>
                    <Typography level="title-sm">
                      {teamThrees[loser.tricode] || 0} ({teamThreePercent[loser.tricode] || 0}%)
                    </Typography>
                  </Stack>
                </Box>

                <Divider />

                {/* Pace */}
                <Box>
                  <Typography level="title-md" sx={{ mb: 1 }}>Pace</Typography>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography level="body-sm">{winner.tricode}</Typography>
                    <Typography level="title-sm">{teamPace[winner.tricode] || 0}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-sm">{loser.tricode}</Typography>
                    <Typography level="title-sm">{teamPace[loser.tricode] || 0}</Typography>
                  </Stack>
                  <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.5 }}>
                    Combined: {team_stats['Pace'] || 0}
                  </Typography>
                </Box>

                <Divider />

                {/* Fast Break Points */}
                <Box>
                  <Typography level="title-md" sx={{ mb: 1 }}>Fast Break Points</Typography>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography level="body-sm">{winner.tricode}</Typography>
                    <Typography level="title-sm">{teamFastBreakPoints[winner.tricode] || 0}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-sm">{loser.tricode}</Typography>
                    <Typography level="title-sm">{teamFastBreakPoints[loser.tricode] || 0}</Typography>
                  </Stack>
                </Box>

                <Divider />

                {/* Contested Shots */}
                <Box>
                  <Typography level="title-md" sx={{ mb: 1 }}>Contested Shots</Typography>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography level="body-sm">{winner.tricode}</Typography>
                    <Typography level="title-sm">{teamContestedShots[winner.tricode] || 0}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-sm">{loser.tricode}</Typography>
                    <Typography level="title-sm">{teamContestedShots[loser.tricode] || 0}</Typography>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Game Info */}
          <Card>
            <CardContent>
              <Typography level="h3" sx={{ mb: 2 }}>
                ℹ️ Game Information
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              <Stack spacing={1.5}>
                <Box>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Date</Typography>
                  <Typography level="title-sm">
                    {new Date(gameData.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Arena</Typography>
                  <Typography level="title-sm">{gameData.gameMetadata?.arena || 'N/A'}</Typography>
                </Box>
                
                <Box>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Season</Typography>
                  <Typography level="title-sm">{gameData.gameMetadata?.season || 'N/A'}</Typography>
                </Box>
                
                <Box>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Game ID</Typography>
                  <Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>{gameData.gameId}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

