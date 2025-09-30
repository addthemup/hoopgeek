import { Box, Typography, Button, Stack, Card, CardContent, Chip, Grid } from '@mui/joy'
import { usePlayers, useSyncPlayers } from '../hooks/useNBAData'

export default function NBAPlayers() {
  const { data: players, isLoading, error } = usePlayers()
  const syncPlayers = useSyncPlayers()

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h3">Loading NBA players...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h3" color="danger">
          Error loading players: {error.message}
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography level="h2">NBA Players</Typography>
          <Button 
            size="lg" 
            onClick={() => syncPlayers.mutate()}
            loading={syncPlayers.isPending}
          >
            {syncPlayers.isPending ? 'Syncing...' : 'Sync NBA Players'}
          </Button>
        </Box>

        {players && players.length > 0 ? (
          <Grid container spacing={2}>
            {players.map((player) => (
              <Grid xs={12} sm={6} md={4} key={player.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 1 }}>
                      {player.name}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <Chip variant="soft" color="primary">
                        {player.position}
                      </Chip>
                      <Chip variant="soft" color="neutral">
                        {player.team}
                      </Chip>
                    </Stack>
                    <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                      Salary: ${player.salary.toLocaleString()}
                    </Typography>
                    {player.stats && (
                      <Box>
                        <Typography level="body-sm" sx={{ mb: 1 }}>
                          <strong>Stats:</strong>
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          PTS: {player.stats.points} | REB: {player.stats.rebounds} | AST: {player.stats.assists}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography level="h4" sx={{ mb: 2 }}>
                No players found
              </Typography>
              <Typography sx={{ mb: 3 }}>
                Click "Sync NBA Players" to fetch the latest player data.
              </Typography>
              <Button 
                size="lg" 
                onClick={() => syncPlayers.mutate()}
                loading={syncPlayers.isPending}
              >
                Sync NBA Players
              </Button>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
