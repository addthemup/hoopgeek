import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Avatar,
  Button,
  LinearProgress,
  Sheet,
} from '@mui/joy';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import TodaysContests from '../components/DFS/TodaysContests';
import TeamOfTheWeek from '../components/DFS/TeamOfTheWeek';
import UserStatsAndEntries from '../components/DFS/UserStatsAndEntries';
import NBAGamesCarousel from '../components/DFS/NBAGamesCarousel';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: nbaScoreboard, isLoading: scoreboardLoading } = useNBAScoreboard();



  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 1, md: 3 }, pt: { xs: 1, md: 1.5 } }}>
      {/* NBA Games Row - At the Very Top */}
      <Box sx={{ mb: 2 }}>
        {scoreboardLoading ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <LinearProgress />
            <Typography level="body-sm" sx={{ mt: 1 }}>
              Loading games...
            </Typography>
          </Box>
        ) : nbaScoreboard && nbaScoreboard.games.length > 0 ? (
          <NBAGamesCarousel games={nbaScoreboard.games} />
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography level="body-md" color="neutral">
                  No games scheduled today
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Left Column - Main Content */}
        <Grid xs={12} lg={8}>
          <Stack spacing={3}>
            {/* Today's Contests - REAL DATA */}
            <TodaysContests />
          </Stack>
        </Grid>

        {/* Right Column - Stats & Top Players */}
        <Grid xs={12} lg={4}>
          <Stack spacing={3}>
            {/* User Stats and Entries */}
            {user ? (
              <UserStatsAndEntries userId={user.id} />
            ) : (
              <Card>
                <CardContent>
                  <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                    📊 Your Stats
                  </Typography>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
                      Sign in to track your stats
                    </Typography>
                    <Button onClick={() => navigate('/login')}>
                      Sign In
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Team of the Week */}
            <TeamOfTheWeek />

            {/* Recent Winners */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  🏆 Recent Winners
                </Typography>
                <Stack spacing={1.5}>
                  {[
                    { name: 'hoops_king23', prize: '$10,000', contest: 'Main Slate' },
                    { name: 'dfs_master', prize: '$5,000', contest: 'Showdown' },
                    { name: 'courtside_pro', prize: '$2,500', contest: 'Classic' },
                  ].map((winner, index) => (
                    <Sheet key={index} variant="soft" sx={{ p: 1.5, borderRadius: 'sm' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar size="sm" sx={{ width: 28, height: 28 }}>
                            {winner.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {winner.name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {winner.contest}
                            </Typography>
                          </Box>
                        </Stack>
                        <Chip size="sm" color="success" variant="soft">
                          {winner.prize}
                        </Chip>
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
