import { Box, Typography, Card, CardContent, Grid, LinearProgress, Alert } from '@mui/joy'
import { useTeamFourFactors } from '../hooks/useTeamFourFactors'

interface TeamFourFactorsProps {
  teamId: number | string | undefined
  season?: string
}

export default function TeamFourFactors({ teamId, season }: TeamFourFactorsProps) {
  const { data: fourFactors, isLoading, error } = useTeamFourFactors(teamId, season)

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2 }}>
            Four Factors
          </Typography>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography level="body-sm">Loading four factors data...</Typography>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert color="danger">
            <Typography level="body-sm">
              Failed to load four factors: {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!fourFactors) {
    return null
  }

  // Format percentage values for display
  const formatPercentage = (value: number): string => {
    return (value * 100).toFixed(1) + '%'
  }

  // Format rate values (like FTA rate)
  const formatRate = (value: number): string => {
    return value.toFixed(3)
  }

  const offensiveFactors = [
    {
      label: 'Effective FG%',
      value: fourFactors.effectiveFieldGoalPercentage,
      format: formatPercentage,
      description: 'Accounts for the fact that 3-pointers are worth more than 2-pointers'
    },
    {
      label: 'Turnover %',
      value: fourFactors.turnoverPercentage,
      format: formatPercentage,
      description: 'Percentage of possessions that end in a turnover'
    },
    {
      label: 'Off. Rebound %',
      value: fourFactors.offensiveReboundPercentage,
      format: formatPercentage,
      description: 'Percentage of available offensive rebounds secured'
    },
    {
      label: 'FT Rate',
      value: fourFactors.freeThrowAttemptRate,
      format: formatRate,
      description: 'Free throw attempts per field goal attempt'
    }
  ]

  const defensiveFactors = [
    {
      label: 'Opp. eFG%',
      value: fourFactors.oppEffectiveFieldGoalPercentage,
      format: formatPercentage,
      description: 'Opponent effective field goal percentage'
    },
    {
      label: 'Opp. TOV %',
      value: fourFactors.oppTurnoverPercentage,
      format: formatPercentage,
      description: 'Opponent turnover percentage'
    },
    {
      label: 'Opp. OReb %',
      value: fourFactors.oppOffensiveReboundPercentage,
      format: formatPercentage,
      description: 'Opponent offensive rebound percentage'
    },
    {
      label: 'Opp. FT Rate',
      value: fourFactors.oppFreeThrowAttemptRate,
      format: formatRate,
      description: 'Opponent free throw attempt rate'
    }
  ]

  return (
    <Box>
      <Typography level="title-lg" sx={{ mb: 2, fontWeight: 600 }}>
        Four Factors
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 3 }}>
        The four factors that best predict team performance. Based on {fourFactors.gamesPlayed} games.
      </Typography>

      <Grid container spacing={2}>
        {/* Offensive Four Factors */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2, fontWeight: 600 }}>
                Offensive
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {offensiveFactors.map((factor, index) => (
                  <Box key={index}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                        {factor.label}
                      </Typography>
                      <Typography level="body-md" sx={{ fontWeight: 600 }}>
                        {factor.format(factor.value)}
                      </Typography>
                    </Box>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      {factor.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Defensive Four Factors */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2, fontWeight: 600 }}>
                Defensive
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {defensiveFactors.map((factor, index) => (
                  <Box key={index}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                        {factor.label}
                      </Typography>
                      <Typography level="body-md" sx={{ fontWeight: 600 }}>
                        {factor.format(factor.value)}
                      </Typography>
                    </Box>
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                      {factor.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
