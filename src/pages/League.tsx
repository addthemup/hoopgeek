import { useParams } from 'react-router-dom'
import { Box, Typography, Button, Stack, Card, CardContent, Chip } from '@mui/joy'

export default function League() {
  const { id } = useParams<{ id: string }>()
  
  // Mock data for now
  const league = {
    id: id || '1',
    name: 'My League',
    description: 'A competitive fantasy basketball league',
    teams: 8,
    draftDate: '2024-01-15',
    draftStatus: 'scheduled' as const,
    members: [
      { id: '1', name: 'Team Alpha', owner: 'John Doe' },
      { id: '2', name: 'Team Beta', owner: 'Jane Smith' },
      { id: '3', name: 'Team Gamma', owner: 'Bob Johnson' },
      { id: '4', name: 'Team Delta', owner: 'Alice Brown' },
    ]
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack spacing={3}>
        <Box>
          <Typography level="h2" sx={{ mb: 1 }}>
            {league.name}
          </Typography>
          <Typography level="body-lg" color="neutral" sx={{ mb: 2 }}>
            {league.description}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Chip variant="soft" color="primary">
              {league.teams} teams
            </Chip>
            <Chip variant="soft" color="neutral">
              Draft: {league.draftDate}
            </Chip>
            <Chip 
              variant="soft" 
              color={league.draftStatus === 'scheduled' ? 'warning' : 'success'}
            >
              {league.draftStatus}
            </Chip>
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            size="lg" 
            onClick={() => window.location.href = `/draft/${league.id}`}
            disabled={league.draftStatus !== 'scheduled'}
          >
            {league.draftStatus === 'scheduled' ? 'Join Draft' : 'View Draft Results'}
          </Button>
          <Button variant="outlined" size="lg">
            Invite Members
          </Button>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Typography level="h3" sx={{ mb: 2 }}>
              League Members
            </Typography>
            <Stack spacing={1}>
              {league.members.map((member) => (
                <Box 
                  key={member.id}
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'neutral.200',
                    borderRadius: 'sm'
                  }}
                >
                  <Box>
                    <Typography level="title-sm">
                      {member.name}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {member.owner}
                    </Typography>
                  </Box>
                  <Chip variant="soft" color="primary">
                    Active
                  </Chip>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}
