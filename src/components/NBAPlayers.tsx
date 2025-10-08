import { Box, Typography, Button, Stack, Card, CardContent, Chip, Grid, Alert } from '@mui/joy'
import { usePlayers, useSyncPlayers } from '../hooks/useNBAData'
import { useImportNBAPlayers } from '../hooks/useNBAImport'

export default function NBAPlayers() {
  const { data: players, isLoading, error } = usePlayers()
  const syncPlayers = useSyncPlayers()
  const importPlayers = useImportNBAPlayers()

  const formatHeight = (height: string | undefined) => {
    if (!height || height === 'N/A') return 'N/A';
    
    // If height is already in feet-inches format, return as-is
    if (height.includes('-')) return height;
    
    // Convert inches to feet-inches format
    const totalInches = parseInt(height);
    if (isNaN(totalInches)) return height;
    
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    
    return `${feet}'${inches}"`;
  };

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
          <Stack direction="row" spacing={2}>
            <Button 
              variant="outlined"
              onClick={() => importPlayers.mutate()}
              loading={importPlayers.isPending}
            >
              {importPlayers.isPending ? 'Importing...' : 'Import NBA Players'}
            </Button>
            <Button 
              size="lg" 
              onClick={() => syncPlayers.mutate()}
              loading={syncPlayers.isPending}
            >
              {syncPlayers.isPending ? 'Syncing...' : 'Sync NBA Players'}
            </Button>
          </Stack>
        </Box>

        {importPlayers.isSuccess && (
          <Alert color="success">
            <Typography level="body-md">
              Import completed! {importPlayers.data.stats.imported} new players imported, 
              {importPlayers.data.stats.updated} players updated, 
              {importPlayers.data.stats.errors} errors.
            </Typography>
          </Alert>
        )}

        {importPlayers.isError && (
          <Alert color="danger">
            <Typography level="body-md">
              Import failed: {importPlayers.error?.message}
            </Typography>
          </Alert>
        )}

        {players && players.length > 0 ? (
          <Grid container spacing={2}>
            {players.map((player: any) => (
              <Grid xs={12} sm={6} md={4} key={player.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 1 }}>
                      {player.name}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      {player.position && (
                        <Chip variant="soft" color="primary">
                          {player.position}
                        </Chip>
                      )}
                      {player.team_name && (
                        <Chip variant="soft" color="neutral">
                          {player.team_name}
                        </Chip>
                      )}
                      {player.jersey_number && (
                        <Chip variant="soft" color="warning">
                          #{player.jersey_number}
                        </Chip>
                      )}
                    </Stack>
                    
                    <Stack spacing={1}>
                      {player.height && (
                        <Typography level="body-sm" color="neutral">
                          Height: {formatHeight(player.height)}
                        </Typography>
                      )}
                      {player.weight && (
                        <Typography level="body-sm" color="neutral">
                          Weight: {player.weight} lbs
                        </Typography>
                      )}
                      {player.age && (
                        <Typography level="body-sm" color="neutral">
                          Age: {player.age}
                        </Typography>
                      )}
                      {player.years_pro !== undefined && (
                        <Typography level="body-sm" color="neutral">
                          Experience: {player.years_pro} years
                        </Typography>
                      )}
                      {player.college && (
                        <Typography level="body-sm" color="neutral">
                          College: {player.college}
                        </Typography>
                      )}
                      {player.draft_year && (
                        <Typography level="body-sm" color="neutral">
                          Draft: {player.draft_year} (Round {player.draft_round}, Pick {player.draft_number})
                        </Typography>
                      )}
                      {player.salary > 0 && (
                        <Typography level="body-sm" color="neutral">
                          Salary: ${player.salary.toLocaleString()}
                        </Typography>
                      )}
                    </Stack>
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
