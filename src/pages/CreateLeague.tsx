import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Box, 
  Typography, 
  Button, 
  Input, 
  FormControl, 
  FormLabel, 
  Stack,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  Sheet,
  Alert
} from '@mui/joy'
import { useAuth } from '../hooks/useAuth'
import { useCreateLeague } from '../hooks/useLeagues'

interface LeagueFormData {
  name: string
  description: string
  maxTeams: number
  scoringType: string
  teamName: string
}

const scoringOptions = [
  {
    value: 'H2H_Points',
    title: 'H2H Points',
    description: 'Face-off with one opponent each week, trying to score more total points.'
  },
  {
    value: 'Roto',
    title: 'Roto',
    description: 'Compete against your whole league all season long, trying to rank the highest in each stat category.'
  },
  {
    value: 'H2H_Category',
    title: 'H2H Each Category',
    description: 'Go head-to-head with one opponent each week, earning a win or loss for each stat category.'
  },
  {
    value: 'H2H_Most_Categories',
    title: 'H2H Most Categories',
    description: 'Go head-to-head with one opponent each week, earning a win if you win the most categories.'
  },
  {
    value: 'Season_Points',
    title: 'Season Points',
    description: 'Earn as many points as possible over the entire season to win the championship.'
  }
]

const teamCountOptions = [4, 6, 8, 10, 12, 14, 16, 18, 20]

export default function CreateLeague() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const createLeague = useCreateLeague()
  const [formData, setFormData] = useState<LeagueFormData>({
    name: '',
    description: '',
    maxTeams: 10,
    scoringType: 'H2H_Points',
    teamName: ''
  })

  if (!user) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h2">Please sign in to create a league</Typography>
        <Button size="lg" onClick={() => navigate('/login')} sx={{ mt: 2 }}>
          Sign In
        </Button>
      </Box>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const result = await createLeague.mutateAsync(formData)
      console.log('League created:', result)
      
      // Navigate to the created league
      if (result.league?.id) {
        navigate(`/league/${result.league.id}`)
      } else {
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Error creating league:', error)
    }
  }

  const handleInputChange = (field: keyof LeagueFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4 }}>
      <Typography level="h2" sx={{ mb: 4, textAlign: 'center' }}>
        Create Your League
      </Typography>

      {createLeague.error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          Error creating league: {createLeague.error.message}
        </Alert>
      )}

      <Card variant="outlined" sx={{ maxWidth: 600, mx: 'auto' }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
              {/* League Name */}
              <FormControl required>
                <FormLabel>League Name</FormLabel>
                <Input
                  placeholder="Enter your league name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  size="lg"
                />
              </FormControl>

              {/* Description */}
              <FormControl>
                <FormLabel>Description (Optional)</FormLabel>
                <Input
                  placeholder="Describe your league..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  size="lg"
                />
              </FormControl>

              {/* Team Name */}
              <FormControl required>
                <FormLabel>Your Team Name</FormLabel>
                <Input
                  placeholder="Enter your team name"
                  value={formData.teamName}
                  onChange={(e) => handleInputChange('teamName', e.target.value)}
                  size="lg"
                />
              </FormControl>

              {/* Number of Teams */}
              <FormControl>
                <FormLabel>Number of Teams</FormLabel>
                <RadioGroup
                  value={formData.maxTeams}
                  onChange={(e) => handleInputChange('maxTeams', parseInt(e.target.value))}
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'row', 
                    flexWrap: 'wrap',
                    gap: 2
                  }}
                >
                  {teamCountOptions.map((count) => (
                    <Sheet
                      key={count}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 'md',
                        cursor: 'pointer',
                        border: formData.maxTeams === count ? '2px solid' : '1px solid',
                        borderColor: formData.maxTeams === count ? 'primary.500' : 'neutral.300',
                        backgroundColor: formData.maxTeams === count ? 'primary.50' : 'background.surface',
                        '&:hover': {
                          borderColor: 'primary.400',
                          backgroundColor: 'primary.25'
                        }
                      }}
                      onClick={() => handleInputChange('maxTeams', count)}
                    >
                      <Radio
                        value={count}
                        label={count.toString()}
                        sx={{ 
                          '& .MuiRadio-root': { display: 'none' },
                          '& .MuiFormControlLabel-label': { 
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            color: formData.maxTeams === count ? 'primary.700' : 'text.primary'
                          }
                        }}
                      />
                    </Sheet>
                  ))}
                </RadioGroup>
              </FormControl>

              {/* Scoring Type */}
              <FormControl>
                <FormLabel>Scoring</FormLabel>
                <RadioGroup
                  value={formData.scoringType}
                  onChange={(e) => handleInputChange('scoringType', e.target.value)}
                  sx={{ gap: 2 }}
                >
                  {scoringOptions.map((option) => (
                    <Sheet
                      key={option.value}
                      variant="outlined"
                      sx={{
                        p: 3,
                        borderRadius: 'md',
                        cursor: 'pointer',
                        border: formData.scoringType === option.value ? '2px solid' : '1px solid',
                        borderColor: formData.scoringType === option.value ? 'primary.500' : 'neutral.300',
                        backgroundColor: formData.scoringType === option.value ? 'primary.50' : 'background.surface',
                        '&:hover': {
                          borderColor: 'primary.400',
                          backgroundColor: 'primary.25'
                        }
                      }}
                      onClick={() => handleInputChange('scoringType', option.value)}
                    >
                      <Radio
                        value={option.value}
                        sx={{ 
                          '& .MuiRadio-root': { display: 'none' },
                          '& .MuiFormControlLabel-label': { width: '100%' }
                        }}
                        label={
                          <Box>
                            <Typography level="title-md" sx={{ 
                              color: formData.scoringType === option.value ? 'primary.700' : 'text.primary',
                              mb: 1
                            }}>
                              {option.title}
                            </Typography>
                            <Typography level="body-sm" color="neutral">
                              {option.description}
                            </Typography>
                          </Box>
                        }
                      />
                    </Sheet>
                  ))}
                </RadioGroup>
              </FormControl>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                loading={createLeague.isPending}
                disabled={!formData.name || !formData.teamName}
                sx={{ mt: 2 }}
              >
                Create League
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
