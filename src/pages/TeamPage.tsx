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
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  IconButton,
  Alert,
  LinearProgress,
  Sheet,
  Divider,
  Badge,
} from '@mui/joy';
import { useParams } from 'react-router-dom';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import SportsBasketballIcon from '@mui/icons-material/SportsBasketball';
import PersonIcon from '@mui/icons-material/Person';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

export default function TeamPage() {
  const { id: leagueId, teamId } = useParams();
  const { user } = useAuth();
  const { data: league, isLoading, error } = useLeague(leagueId || '');

  // Mock data for the team and players
  const team = {
    id: 'my-team-id',
    name: 'HoopGeek Squad',
    logo: 'https://i.imgur.com/F02Qy2j.png', // Placeholder logo
    owner: user?.email || 'Current User',
    record: '4-1-0',
    place: '2nd Place',
    totalPoints: 650.5,
    streak: 'W2',
    fantasyLevel: 'Gold',
    fantasyRating: 745,
    matchup: {
      week: 6,
      opponentName: 'Ballerz United',
      opponentRank: '3rd',
      projectedScore: 125.3,
      opponentProjectedScore: 118.7,
      matchupRating: 'Good', // Great, Good, Neutral, Bad, Terrible
      lastWeekResult: 'Won Week 5 vs. Dunkin Donuts'
    },
    roster: [
      { id: '1', name: 'Stephen Curry', team: 'GSW', pos: 'PG', status: 'Active', game: 'vs LAL', gameTime: 'Sun 7:00 PM', projPts: 35.2, actualPts: 0, startPct: 100, rosPct: 100, matchupRating: 'Great', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3975.png&w=350&h=254' },
      { id: '2', name: 'Luka Dončić', team: 'DAL', pos: 'SG', status: 'Active', game: '@ PHX', gameTime: 'Sun 10:00 PM', projPts: 32.8, actualPts: 0, startPct: 100, rosPct: 100, matchupRating: 'Good', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/4279805.png&w=350&h=254' },
      { id: '3', name: 'LeBron James', team: 'LAL', pos: 'SF', status: 'Active', game: '@ GSW', gameTime: 'Sun 7:00 PM', projPts: 28.5, actualPts: 0, startPct: 100, rosPct: 100, matchupRating: 'Neutral', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/1966.png&w=350&h=254' },
      { id: '4', name: 'Giannis Antetokounmpo', team: 'MIL', pos: 'PF', status: 'Active', game: 'vs BOS', gameTime: 'Mon 7:30 PM', projPts: 38.1, actualPts: 0, startPct: 100, rosPct: 100, matchupRating: 'Great', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3032977.png&w=350&h=254' },
      { id: '5', name: 'Nikola Jokić', team: 'DEN', pos: 'C', status: 'Active', game: 'vs UTA', gameTime: 'Mon 9:00 PM', projPts: 36.7, actualPts: 0, startPct: 100, rosPct: 100, matchupRating: 'Good', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3112335.png&w=350&h=254' },
      { id: '6', name: 'Jayson Tatum', team: 'BOS', pos: 'F', status: 'Active', game: '@ MIL', gameTime: 'Mon 7:30 PM', projPts: 29.1, actualPts: 0, startPct: 100, rosPct: 100, matchupRating: 'Neutral', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/4066497.png&w=350&h=254' },
      { id: '7', name: 'Damian Lillard', team: 'MIL', pos: 'G', status: 'Questionable', game: 'vs BOS', gameTime: 'Mon 7:30 PM', projPts: 24.5, actualPts: 0, startPct: 85, rosPct: 98, matchupRating: 'Good', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/6609.png&w=350&h=254' },
      { id: '8', name: 'Anthony Davis', team: 'LAL', pos: 'UTIL', status: 'Out', game: '@ GSW', gameTime: 'Sun 7:00 PM', projPts: 0, actualPts: 0, startPct: 0, rosPct: 99, matchupRating: 'Bad', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/6583.png&w=350&h=254' },
    ],
    bench: [
      { id: '9', name: 'Tyrese Haliburton', team: 'IND', pos: 'PG', status: 'Active', game: 'vs CHI', gameTime: 'Tue 8:00 PM', projPts: 26.1, actualPts: 0, startPct: 95, rosPct: 99, matchupRating: 'Good', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/4432908.png&w=350&h=254' },
      { id: '10', name: 'Devin Booker', team: 'PHX', pos: 'SG', status: 'Active', game: 'vs DAL', gameTime: 'Sun 10:00 PM', projPts: 22.3, actualPts: 0, startPct: 90, rosPct: 97, matchupRating: 'Neutral', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3136864.png&w=350&h=254' },
      { id: '11', name: 'Victor Wembanyama', team: 'SAS', pos: 'PF', status: 'Active', game: '@ HOU', gameTime: 'Wed 8:00 PM', projPts: 20.9, actualPts: 0, startPct: 80, rosPct: 95, matchupRating: 'Great', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/5104172.png&w=350&h=254' },
    ],
    ir: [
      { id: '12', name: 'Kawhi Leonard', team: 'LAC', pos: 'SF', status: 'IR', game: 'vs SAC', gameTime: 'Thu 10:30 PM', projPts: 0, actualPts: 0, startPct: 0, rosPct: 80, matchupRating: 'N/A', avatar: 'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/6470.png&w=350&h=254' },
    ]
  };

  const getMatchupRatingColor = (rating: string) => {
    switch (rating) {
      case 'Great': return 'success';
      case 'Good': return 'info';
      case 'Neutral': return 'warning';
      case 'Bad': return 'danger';
      case 'Terrible': return 'danger';
      default: return 'neutral';
    }
  };

  const getPlayerStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Questionable': return 'warning';
      case 'Out': return 'danger';
      case 'IR': return 'neutral';
      default: return 'neutral';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <Typography level="body-md">
          Error loading league data: {error.message}
        </Typography>
      </Alert>
    );
  }

  if (!league) {
    return (
      <Alert color="warning">
        <Typography level="body-md">
          League not found.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Team Header Card */}
      <Card
        variant="outlined"
        sx={{
          mb: 4,
          p: 3,
          background: 'linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)', // Gradient background
          color: 'white',
          boxShadow: 'lg',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid xs={12} md={8}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={team.logo} alt={team.name} sx={{ '--Avatar-size': '80px', border: '2px solid white' }} />
              <Box>
                <Typography level="h2" sx={{ color: 'white' }}>{team.name}</Typography>
                <Typography level="body-md" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Owner: {team.owner}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    {team.fantasyLevel} {team.fantasyRating}
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    {team.record}
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    {team.place}
                  </Chip>
                </Stack>
              </Box>
            </Stack>
          </Grid>
          <Grid xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Typography level="h3" sx={{ color: 'white', mb: 1 }}>{team.totalPoints} Total Pts</Typography>
            <Typography level="body-md" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Streak: {team.streak}
            </Typography>
            <Button
              variant="solid"
              color="primary"
              startDecorator={<EditIcon />}
              sx={{ mt: 2, bgcolor: 'white', color: '#1a2a6c', '&:hover': { bgcolor: 'lightgray' } }}
            >
              Edit Lineup
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Matchup Card */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography level="h4" sx={{ mb: 2 }}>Current Matchup - Week {team.matchup.week}</Typography>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Box sx={{ textAlign: 'center' }}>
              <Avatar src={team.logo} alt={team.name} sx={{ '--Avatar-size': '60px', mb: 1 }} />
              <Typography level="title-md">{team.name}</Typography>
              <Typography level="body-sm" color="text.secondary">{team.record}</Typography>
              <Typography level="h3" sx={{ mt: 1 }}>{team.matchup.projectedScore}</Typography>
            </Box>
            <Typography level="h4" color="neutral">VS</Typography>
            <Box sx={{ textAlign: 'center' }}>
              <Avatar src="https://i.imgur.com/F02Qy2j.png" alt={team.matchup.opponentName} sx={{ '--Avatar-size': '60px', mb: 1 }} /> {/* Placeholder opponent logo */}
              <Typography level="title-md">{team.matchup.opponentName}</Typography>
              <Typography level="body-sm" color="text.secondary">{team.matchup.opponentRank}</Typography>
              <Typography level="h3" sx={{ mt: 1 }}>{team.matchup.opponentProjectedScore}</Typography>
            </Box>
          </Stack>
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Chip size="md" color={getMatchupRatingColor(team.matchup.matchupRating)}>
              Matchup Rating: {team.matchup.matchupRating}
            </Chip>
            <Typography level="body-sm" sx={{ mt: 1 }}>
              Last Week: {team.matchup.lastWeekResult}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Roster Section */}
      <Typography level="h4" sx={{ mb: 2 }}>Roster</Typography>
      <Sheet variant="outlined" sx={{ borderRadius: 'md', overflow: 'auto', mb: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--joy-palette-neutral-100)' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>Pos</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>Player</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>Game</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>Proj Pts</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>Actual Pts</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>% Start</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--joy-palette-neutral-200)' }}>% Ros</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--joy-palette-neutral-200)' }}></th> {/* For actions */}
            </tr>
          </thead>
          <tbody>
            {team.roster.map((player) => (
              <tr key={player.id} style={{ borderBottom: '1px solid var(--joy-palette-neutral-100)' }}>
                <td style={{ padding: '12px' }}><Chip size="sm" variant="soft">{player.pos}</Chip></td>
                <td style={{ padding: '12px' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar src={player.avatar} alt={player.name} size="sm" />
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography level="body-md">{player.name}</Typography>
                      <Typography level="body-xs" color="text.secondary">{player.team} - {player.pos}</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                        <Chip size="sm" variant="soft" color={getPlayerStatusColor(player.status)}>
                          {player.status}
                        </Chip>
                        <Chip size="sm" variant="soft" color={getMatchupRatingColor(player.matchupRating)}>
                          {player.matchupRating}
                        </Chip>
                      </Stack>
                    </Box>
                  </Stack>
                </td>
                <td style={{ padding: '12px' }}>
                  <Typography level="body-sm">{player.game}</Typography>
                  <Typography level="body-xs" color="text.secondary">{player.gameTime}</Typography>
                </td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.projPts}</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.actualPts}</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.startPct}%</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.rosPct}%</Typography></td>
                <td style={{ padding: '12px' }}>
                  <IconButton size="sm" variant="plain" color="neutral">
                    <MoreVertIcon />
                  </IconButton>
                </td>
              </tr>
            ))}
            {/* Bench Players */}
            <tr>
              <td colSpan={8} style={{ textAlign: 'left', background: 'var(--joy-palette-background-level1)' }}>
                <Typography level="title-md" sx={{ ml: 1, py: 1 }}>Bench</Typography>
              </td>
            </tr>
            {team.bench.map((player) => (
              <tr key={player.id} style={{ borderBottom: '1px solid var(--joy-palette-neutral-100)' }}>
                <td style={{ padding: '12px' }}><Chip size="sm" variant="soft">{player.pos}</Chip></td>
                <td style={{ padding: '12px' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar src={player.avatar} alt={player.name} size="sm" />
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography level="body-md">{player.name}</Typography>
                      <Typography level="body-xs" color="text.secondary">{player.team} - {player.pos}</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                        <Chip size="sm" variant="soft" color={getPlayerStatusColor(player.status)}>
                          {player.status}
                        </Chip>
                        <Chip size="sm" variant="soft" color={getMatchupRatingColor(player.matchupRating)}>
                          {player.matchupRating}
                        </Chip>
                      </Stack>
                    </Box>
                  </Stack>
                </td>
                <td style={{ padding: '12px' }}>
                  <Typography level="body-sm">{player.game}</Typography>
                  <Typography level="body-xs" color="text.secondary">{player.gameTime}</Typography>
                </td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.projPts}</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.actualPts}</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.startPct}%</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.rosPct}%</Typography></td>
                <td style={{ padding: '12px' }}>
                  <IconButton size="sm" variant="plain" color="neutral">
                    <MoreVertIcon />
                  </IconButton>
                </td>
              </tr>
            ))}
            {/* IR Players */}
            <tr>
              <td colSpan={8} style={{ textAlign: 'left', background: 'var(--joy-palette-background-level1)' }}>
                <Typography level="title-md" sx={{ ml: 1, py: 1 }}>Injured Reserve</Typography>
              </td>
            </tr>
            {team.ir.map((player) => (
              <tr key={player.id} style={{ borderBottom: '1px solid var(--joy-palette-neutral-100)' }}>
                <td style={{ padding: '12px' }}><Chip size="sm" variant="soft">{player.pos}</Chip></td>
                <td style={{ padding: '12px' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar src={player.avatar} alt={player.name} size="sm" />
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography level="body-md">{player.name}</Typography>
                      <Typography level="body-xs" color="text.secondary">{player.team} - {player.pos}</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                        <Chip size="sm" variant="soft" color={getPlayerStatusColor(player.status)}>
                          {player.status}
                        </Chip>
                        <Chip size="sm" variant="soft" color={getMatchupRatingColor(player.matchupRating)}>
                          {player.matchupRating}
                        </Chip>
                      </Stack>
                    </Box>
                  </Stack>
                </td>
                <td style={{ padding: '12px' }}>
                  <Typography level="body-sm">{player.game}</Typography>
                  <Typography level="body-xs" color="text.secondary">{player.gameTime}</Typography>
                </td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.projPts}</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.actualPts}</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.startPct}%</Typography></td>
                <td style={{ padding: '12px' }}><Typography level="body-md">{player.rosPct}%</Typography></td>
                <td style={{ padding: '12px' }}>
                  <IconButton size="sm" variant="plain" color="neutral">
                    <MoreVertIcon />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>

      {/* Team Analysis Section (Placeholder) */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography level="h4" sx={{ mb: 2 }}>Team Analysis</Typography>
          <Grid container spacing={2}>
            <Grid xs={12} md={4}>
              <Card variant="soft" color="success">
                <CardContent>
                  <Typography level="title-md">Strengths</Typography>
                  <List size="sm">
                    <ListItem><ListItemDecorator><CheckCircleOutlineIcon /></ListItemDecorator>Elite Scoring Guards</ListItem>
                    <ListItem><ListItemDecorator><CheckCircleOutlineIcon /></ListItemDecorator>Strong Rebounding Forwards</ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} md={4}>
              <Card variant="soft" color="warning">
                <CardContent>
                  <Typography level="title-md">Neutral</Typography>
                  <List size="sm">
                    <ListItem><ListItemDecorator><HelpOutlineIcon /></ListItemDecorator>Average Bench Depth</ListItem>
                    <ListItem><ListItemDecorator><HelpOutlineIcon /></ListItemDecorator>Consistency Issues</ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} md={4}>
              <Card variant="soft" color="danger">
                <CardContent>
                  <Typography level="title-md">Weaknesses</Typography>
                  <List size="sm">
                    <ListItem><ListItemDecorator><RemoveCircleOutlineIcon /></ListItemDecorator>Injury Prone Players</ListItem>
                    <ListItem><ListItemDecorator><RemoveCircleOutlineIcon /></ListItemDecorator>Lack of Blocks/Steals</ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Button variant="outlined" sx={{ mt: 3 }}>View Research Assistant</Button>
        </CardContent>
      </Card>
    </Box>
  );
}