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
  IconButton,
  Alert,
  LinearProgress,
  Sheet,
  Divider,
  Badge,
} from '@mui/joy';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import SportsBasketballIcon from '@mui/icons-material/SportsBasketball';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import BarChartIcon from '@mui/icons-material/BarChart';
import TimelineIcon from '@mui/icons-material/Timeline';


// Mock detailed matchup data
const mockMatchupDetails = {
  '1-1': {
    id: '1-1',
    week: 6,
    period: 'Oct 7 - 13',
    status: 'completed',
    matchupType: 'regular',
    homeTeam: {
      id: '1',
      name: 'Team Ballers',
      owner: 'John Doe',
      logo: '🏀',
      record: '4-1-0',
      place: '2nd',
      score: 1247.3,
      isWinner: true,
      players: [
        {
          id: '1',
          name: 'Stephen Curry',
          position: 'PG',
          team: 'GSW',
          points: 45.2,
          stats: { pts: 28, reb: 4, ast: 7, stl: 1, blk: 0, fg: '9/19', ft: '8/8', threes: 4 },
          status: 'Active',
        },
        {
          id: '2',
          name: 'Luka Dončić',
          position: 'SG',
          team: 'DAL',
          points: 52.1,
          stats: { pts: 32, reb: 8, ast: 9, stl: 1, blk: 1, fg: '12/24', ft: '6/8', threes: 4 },
          status: 'Active',
        },
        {
          id: '3',
          name: 'LeBron James',
          position: 'SF',
          team: 'LAL',
          points: 38.7,
          stats: { pts: 26, reb: 7, ast: 7, stl: 1, blk: 1, fg: '10/18', ft: '4/6', threes: 2 },
          status: 'Active',
        },
        {
          id: '4',
          name: 'Giannis Antetokounmpo',
          position: 'PF',
          team: 'MIL',
          points: 48.9,
          stats: { pts: 31, reb: 12, ast: 6, stl: 1, blk: 1, fg: '11/20', ft: '9/12', threes: 1 },
          status: 'Active',
        },
        {
          id: '5',
          name: 'Nikola Jokić',
          position: 'C',
          team: 'DEN',
          points: 55.3,
          stats: { pts: 25, reb: 12, ast: 10, stl: 1, blk: 1, fg: '10/16', ft: '5/6', threes: 1 },
          status: 'Active',
        },
      ],
    },
    awayTeam: {
      id: '2',
      name: 'Slam Dunk Squad',
      owner: 'Jane Smith',
      logo: '⚡',
      record: '3-2-0',
      place: '4th',
      score: 1189.7,
      isWinner: false,
      players: [
        {
          id: '6',
          name: 'Jayson Tatum',
          position: 'PG',
          team: 'BOS',
          points: 43.8,
          stats: { pts: 27, reb: 8, ast: 5, stl: 1, blk: 1, fg: '10/22', ft: '5/6', threes: 3 },
          status: 'Active',
        },
        {
          id: '7',
          name: 'Anthony Davis',
          position: 'SG',
          team: 'LAL',
          points: 46.7,
          stats: { pts: 24, reb: 13, ast: 4, stl: 1, blk: 2, fg: '9/17', ft: '6/8', threes: 1 },
          status: 'Active',
        },
        {
          id: '8',
          name: 'Damian Lillard',
          position: 'SF',
          team: 'MIL',
          points: 39.4,
          stats: { pts: 24, reb: 4, ast: 7, stl: 1, blk: 0, fg: '8/18', ft: '6/7', threes: 3 },
          status: 'Active',
        },
        {
          id: '9',
          name: 'Jimmy Butler',
          position: 'PF',
          team: 'MIA',
          points: 35.6,
          stats: { pts: 21, reb: 5, ast: 5, stl: 1, blk: 0, fg: '7/15', ft: '7/8', threes: 1 },
          status: 'Active',
        },
        {
          id: '10',
          name: 'Trae Young',
          position: 'C',
          team: 'ATL',
          points: 41.2,
          stats: { pts: 26, reb: 3, ast: 10, stl: 1, blk: 0, fg: '8/20', ft: '8/9', threes: 3 },
          status: 'Active',
        },
      ],
    },
    gameLog: [
      { day: 'Mon', date: 'Oct 7', homeScore: 245.3, awayScore: 198.7, homeLead: 46.6 },
      { day: 'Tue', date: 'Oct 8', homeScore: 489.2, awayScore: 456.1, homeLead: 33.1 },
      { day: 'Wed', date: 'Oct 9', homeScore: 723.8, awayScore: 687.4, homeLead: 36.4 },
      { day: 'Thu', date: 'Oct 10', homeScore: 956.1, awayScore: 923.7, homeLead: 32.4 },
      { day: 'Fri', date: 'Oct 11', homeScore: 1189.4, awayScore: 1156.2, homeLead: 33.2 },
      { day: 'Sat', date: 'Oct 12', homeScore: 1247.3, awayScore: 1189.7, homeLead: 57.6 },
    ],
  },
};

export default function MatchupDetails() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: leagueId, matchupId } = useParams<{ id: string; matchupId: string }>();
  const { data: league, isLoading, error } = useLeague(leagueId || '');

  const matchup = mockMatchupDetails[matchupId as keyof typeof mockMatchupDetails];

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography level="body-md" sx={{ mt: 2 }}>
          Loading matchup details...
        </Typography>
      </Box>
    );
  }

  if (error || !league || !matchup) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-md">
            Failed to load matchup details. Please try again.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleBackToScoreboard = () => {
    navigate(`/league/${leagueId}/scoreboard`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'live': return 'warning';
      case 'upcoming': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Final';
      case 'live': return 'Live';
      case 'upcoming': return 'Upcoming';
      default: return 'Unknown';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <IconButton
            variant="outlined"
            onClick={handleBackToScoreboard}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography level="h2" sx={{ mb: 1 }}>
              Week {matchup.week} Matchup Details
            </Typography>
            <Typography level="body-lg" color="neutral">
              {league.name} • {matchup.period}
            </Typography>
          </Box>
          <Chip
            color={getStatusColor(matchup.status)}
            variant="soft"
            size="lg"
          >
            {getStatusText(matchup.status)}
          </Chip>
        </Stack>

        {/* Matchup Summary */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              {/* Away Team */}
              <Grid xs={12} md={5}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    size="lg"
                    sx={{
                      bgcolor: matchup.awayTeam.isWinner ? 'success.100' : 'neutral.100',
                      color: matchup.awayTeam.isWinner ? 'success.700' : 'neutral.600',
                      fontSize: 'xl',
                      width: 80,
                      height: 80,
                    }}
                  >
                    {matchup.awayTeam.logo}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography level="h4" sx={{ mb: 0.5 }}>
                      {matchup.awayTeam.name}
                    </Typography>
                    <Typography level="body-md" color="neutral" sx={{ mb: 1 }}>
                      {matchup.awayTeam.owner} • {matchup.awayTeam.record} ({matchup.awayTeam.place})
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography level="h3" color={matchup.awayTeam.isWinner ? 'success' : 'neutral'}>
                        {matchup.awayTeam.score}
                      </Typography>
                      {matchup.awayTeam.isWinner && (
                        <EmojiEventsIcon sx={{ color: 'success.500', fontSize: 24 }} />
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Grid>

              {/* VS Section */}
              <Grid xs={12} md={2}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography level="h6" color="primary" sx={{ mb: 1 }}>
                    VS
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Point Differential
                  </Typography>
                  <Typography level="h5" color={matchup.homeTeam.isWinner ? 'success' : 'danger'}>
                    {Math.abs(matchup.homeTeam.score - matchup.awayTeam.score).toFixed(1)}
                  </Typography>
                </Box>
              </Grid>

              {/* Home Team */}
              <Grid xs={12} md={5}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ flexDirection: 'row-reverse' }}>
                  <Avatar
                    size="lg"
                    sx={{
                      bgcolor: matchup.homeTeam.isWinner ? 'success.100' : 'neutral.100',
                      color: matchup.homeTeam.isWinner ? 'success.700' : 'neutral.600',
                      fontSize: 'xl',
                      width: 80,
                      height: 80,
                    }}
                  >
                    {matchup.homeTeam.logo}
                  </Avatar>
                  <Box sx={{ flex: 1, textAlign: 'right' }}>
                    <Typography level="h4" sx={{ mb: 0.5 }}>
                      {matchup.homeTeam.name}
                    </Typography>
                    <Typography level="body-md" color="neutral" sx={{ mb: 1 }}>
                      {matchup.homeTeam.owner} • {matchup.homeTeam.record} ({matchup.homeTeam.place})
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ justifyContent: 'flex-end' }}>
                      <Typography level="h3" color={matchup.homeTeam.isWinner ? 'success' : 'neutral'}>
                        {matchup.homeTeam.score}
                      </Typography>
                      {matchup.homeTeam.isWinner && (
                        <EmojiEventsIcon sx={{ color: 'success.500', fontSize: 24 }} />
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* Game Log Timeline */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography level="h5" sx={{ mb: 3 }}>
            <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Game Log
          </Typography>
          <Grid container spacing={2}>
            {matchup.gameLog.map((day, index) => (
              <Grid xs={12} sm={6} md={2} key={index}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    textAlign: 'center',
                    bgcolor: index === matchup.gameLog.length - 1 ? 'primary.50' : 'neutral.50'
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                      {day.day}
                    </Typography>
                    <Typography level="body-xs" color="neutral" sx={{ mb: 2 }}>
                      {day.date}
                    </Typography>
                    <Typography level="h6" sx={{ mb: 1 }}>
                      {day.homeScore.toFixed(1)} - {day.awayScore.toFixed(1)}
                    </Typography>
                    <Chip 
                      size="sm" 
                      color={day.homeLead > 0 ? 'success' : 'danger'}
                      variant="soft"
                    >
                      {day.homeLead > 0 ? '+' : ''}{day.homeLead.toFixed(1)}
                    </Chip>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Player Performance */}
      <Grid container spacing={3}>
        {/* Home Team Players */}
        <Grid xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h5" sx={{ mb: 3 }}>
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {matchup.homeTeam.name} Roster
              </Typography>
              <Stack spacing={2}>
                {matchup.homeTeam.players.map((player) => (
                  <Card key={player.id} variant="soft" size="sm">
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography level="body-md" fontWeight="md">
                            {player.name}
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {player.position} • {player.team}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography level="h6" color="primary">
                            {player.points}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            Fantasy Points
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 1 }} />
                      <Grid container spacing={1}>
                        <Grid xs={3}>
                          <Typography level="body-xs" color="neutral">PTS</Typography>
                          <Typography level="body-sm">{player.stats.pts}</Typography>
                        </Grid>
                        <Grid xs={3}>
                          <Typography level="body-xs" color="neutral">REB</Typography>
                          <Typography level="body-sm">{player.stats.reb}</Typography>
                        </Grid>
                        <Grid xs={3}>
                          <Typography level="body-xs" color="neutral">AST</Typography>
                          <Typography level="body-sm">{player.stats.ast}</Typography>
                        </Grid>
                        <Grid xs={3}>
                          <Typography level="body-xs" color="neutral">STL</Typography>
                          <Typography level="body-sm">{player.stats.stl}</Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Away Team Players */}
        <Grid xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h5" sx={{ mb: 3 }}>
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {matchup.awayTeam.name} Roster
              </Typography>
              <Stack spacing={2}>
                {matchup.awayTeam.players.map((player) => (
                  <Card key={player.id} variant="soft" size="sm">
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography level="body-md" fontWeight="md">
                            {player.name}
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {player.position} • {player.team}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography level="h6" color="primary">
                            {player.points}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            Fantasy Points
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 1 }} />
                      <Grid container spacing={1}>
                        <Grid xs={3}>
                          <Typography level="body-xs" color="neutral">PTS</Typography>
                          <Typography level="body-sm">{player.stats.pts}</Typography>
                        </Grid>
                        <Grid xs={3}>
                          <Typography level="body-xs" color="neutral">REB</Typography>
                          <Typography level="body-sm">{player.stats.reb}</Typography>
                        </Grid>
                        <Grid xs={3}>
                          <Typography level="body-xs" color="neutral">AST</Typography>
                          <Typography level="body-sm">{player.stats.ast}</Typography>
                        </Grid>
                        <Grid xs={3}>
                          <Typography level="body-xs" color="neutral">STL</Typography>
                          <Typography level="body-sm">{player.stats.stl}</Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Matchup Analytics */}
      <Card variant="outlined" sx={{ mt: 4 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography level="h5">
              <BarChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Matchup Analytics
            </Typography>
            <Button variant="outlined" startDecorator={<TrendingUpIcon />}>
              View Full Analytics
            </Button>
          </Stack>
          
          <Grid container spacing={3}>
            <Grid xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography level="h4" color="primary">
                  {((matchup.homeTeam.score + matchup.awayTeam.score) / 2).toFixed(1)}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Average Points per Team
                </Typography>
              </Box>
            </Grid>
            <Grid xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography level="h4" color="success">
                  {Math.max(...matchup.homeTeam.players.map(p => p.points), ...matchup.awayTeam.players.map(p => p.points)).toFixed(1)}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Highest Individual Score
                </Typography>
              </Box>
            </Grid>
            <Grid xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography level="h4" color="warning">
                  {matchup.gameLog.length}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Days in Matchup
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
