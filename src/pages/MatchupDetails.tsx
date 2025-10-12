import React from 'react';
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
  Alert,
  LinearProgress,
  Table,
  Sheet,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Divider,
} from '@mui/joy';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatchupDetails, MatchupPlayer } from '../hooks/useMatchupDetails';
import { getTeamColors } from '../utils/nbaTeamColors';
import { ArrowBack, EmojiEvents } from '@mui/icons-material';

export default function MatchupDetails() {
  const { leagueId, matchupId } = useParams<{ leagueId: string; matchupId: string }>();
  const navigate = useNavigate();
  const { data: matchup, isLoading, error } = useMatchupDetails(matchupId || '');

  const [activeTab, setActiveTab] = React.useState(0);

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

  if (error || !matchup) {
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

  const team1Score = matchup.fantasy_team1_score || 0;
  const team2Score = matchup.fantasy_team2_score || 0;
  const team1IsWinner = team1Score > team2Score;
  const team2IsWinner = team2Score > team1Score;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'live': return 'warning';
      case 'scheduled': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Final';
      case 'live': return 'Live';
      case 'scheduled': return 'Scheduled';
      default: return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Separate players into starters and bench
  const team1Starters = matchup.team1.roster.slice(0, 5);
  const team1Bench = matchup.team1.roster.slice(5);
  const team2Starters = matchup.team2.roster.slice(0, 5);
  const team2Bench = matchup.team2.roster.slice(5);

  const team1Colors = getTeamColors(matchup.team1.team_name);
  const team2Colors = getTeamColors(matchup.team2.team_name);

  const renderJersey = (player: MatchupPlayer, colors: any) => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          position: 'relative',
        }}
      >
        {/* Jersey */}
        <Box
          sx={{
            width: 50,
            height: 50,
            borderRadius: '6px',
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            border: '2px solid',
            borderColor: colors.secondary,
            position: 'relative',
          }}
        >
          {/* Jersey Number */}
          <Typography
            sx={{
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#FFFFFF',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {player.jersey_number || '??'}
          </Typography>

          {/* Position Badge */}
          <Box
            sx={{
              position: 'absolute',
              top: -6,
              right: -6,
              bgcolor: 'background.surface',
              border: '2px solid',
              borderColor: colors.primary,
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 'bold', color: colors.primary }}>
              {player.position}
            </Typography>
          </Box>
        </Box>

        {/* Player Name */}
        <Typography
          level="body-xs"
          sx={{
            fontWeight: 'bold',
            textAlign: 'center',
            maxWidth: 70,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {player.name.split(' ').pop()}
        </Typography>
      </Box>
    );
  };

  const renderPlayerTable = (players: MatchupPlayer[], teamColors: any, teamName: string) => {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 2, fontWeight: 'bold', color: teamColors.primary }}>
          {teamName} Roster
        </Typography>
        <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'hidden' }}>
          <Table>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Player</th>
                <th style={{ width: '15%' }}>Pos</th>
                <th style={{ width: '15%' }}>Team</th>
                <th style={{ width: '15%' }}>Salary</th>
                <th style={{ width: '15%' }}>FPts</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar
                        size="sm"
                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                        sx={{ width: 32, height: 32 }}
                      >
                        {player.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {player.name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          #{player.jersey_number || '--'}
                        </Typography>
                      </Box>
                    </Stack>
                  </td>
                  <td>
                    <Chip size="sm" variant="soft">
                      {player.position}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm">{player.team_abbreviation}</Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      ${(player.salary_2025_26 / 1000000).toFixed(1)}M
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {player.total_points?.toFixed(1) || '0.0'}
                    </Typography>
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: 'var(--joy-palette-background-level1)' }}>
                <td colSpan={4}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    Total
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {matchup.fantasy_team1_id === teamName
                      ? team1Score.toFixed(1)
                      : team2Score.toFixed(1)}
                  </Typography>
                </td>
              </tr>
            </tbody>
          </Table>
        </Sheet>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Back Button */}
      <Button
        variant="plain"
        startDecorator={<ArrowBack />}
        onClick={() => navigate(`/league/${leagueId}/scoreboard`)}
        sx={{ mb: 2 }}
      >
        Back to Scoreboard
      </Button>

      {/* Header */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            {/* Team 1 */}
            <Grid xs={12} md={5}>
              <Stack spacing={1}>
                <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                  {matchup.team1.team_name}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  {matchup.team1.wins}-{matchup.team1.losses}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    level="h1"
                    sx={{ fontWeight: 'bold', color: team1IsWinner ? 'success.500' : 'neutral' }}
                  >
                    {team1Score.toFixed(1)}
                  </Typography>
                  {team1IsWinner && matchup.status === 'completed' && (
                    <EmojiEvents sx={{ fontSize: 40, color: 'success.500' }} />
                  )}
                </Stack>
              </Stack>
            </Grid>

            {/* VS Section */}
            <Grid xs={12} md={2}>
              <Box sx={{ textAlign: 'center' }}>
                <Chip color={getStatusColor(matchup.status)} variant="soft" size="sm" sx={{ mb: 1 }}>
                  {getStatusText(matchup.status)}
                </Chip>
                <Typography level="h2" sx={{ fontWeight: 'bold', color: 'neutral.500' }}>
                  VS
                </Typography>
                <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                  {matchup.week_info.week_name}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  {formatDate(matchup.week_info.start_date)} - {formatDate(matchup.week_info.end_date)}
                </Typography>
              </Box>
            </Grid>

            {/* Team 2 */}
            <Grid xs={12} md={5}>
              <Stack spacing={1} sx={{ textAlign: 'right' }}>
                <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                  {matchup.team2.team_name}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  {matchup.team2.wins}-{matchup.team2.losses}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ justifyContent: 'flex-end' }}>
                  {team2IsWinner && matchup.status === 'completed' && (
                    <EmojiEvents sx={{ fontSize: 40, color: 'success.500' }} />
                  )}
                  <Typography
                    level="h1"
                    sx={{ fontWeight: 'bold', color: team2IsWinner ? 'success.500' : 'neutral' }}
                  >
                    {team2Score.toFixed(1)}
                  </Typography>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as number)}>
        <TabList>
          <Tab>Court View</Tab>
          <Tab>Box Score</Tab>
          <Tab>Matchup Stats</Tab>
        </TabList>

        {/* Court View Tab */}
        <TabPanel value={0}>
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent>
              {/* Basketball Court */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  minHeight: 500,
                  background: 'linear-gradient(180deg, #d4a373 0%, #c4935a 100%)',
                  borderRadius: '8px',
                  border: '4px solid #8B4513',
                  padding: 3,
                  display: 'flex',
                  gap: 4,
                }}
              >
                {/* Left Side - Starters */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Typography
                    level="title-lg"
                    sx={{
                      fontWeight: 'bold',
                      textAlign: 'center',
                      color: 'white',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      mb: 1,
                    }}
                  >
                    STARTERS
                  </Typography>

                  {/* Team 1 Starters */}
                  <Box>
                    <Typography
                      level="body-sm"
                      sx={{
                        fontWeight: 'bold',
                        color: team1Colors.primary,
                        textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                        mb: 1,
                        textAlign: 'center',
                      }}
                    >
                      {matchup.team1.team_name}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 1.5,
                        justifyItems: 'center',
                      }}
                    >
                      {team1Starters.map((player) => renderJersey(player, team1Colors))}
                    </Box>
                  </Box>

                  {/* Center Line */}
                  <Box sx={{ height: 2, bgcolor: 'white', opacity: 0.5, my: 1 }} />

                  {/* Team 2 Starters */}
                  <Box>
                    <Typography
                      level="body-sm"
                      sx={{
                        fontWeight: 'bold',
                        color: team2Colors.primary,
                        textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                        mb: 1,
                        textAlign: 'center',
                      }}
                    >
                      {matchup.team2.team_name}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 1.5,
                        justifyItems: 'center',
                      }}
                    >
                      {team2Starters.map((player) => renderJersey(player, team2Colors))}
                    </Box>
                  </Box>
                </Box>

                {/* Vertical Divider */}
                <Box sx={{ width: 2, bgcolor: 'white', opacity: 0.5 }} />

                {/* Right Side - Rotation/Bench */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Typography
                    level="title-lg"
                    sx={{
                      fontWeight: 'bold',
                      textAlign: 'center',
                      color: 'white',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      mb: 1,
                    }}
                  >
                    ROTATION
                  </Typography>

                  {/* Team 1 Bench */}
                  <Box>
                    <Typography
                      level="body-sm"
                      sx={{
                        fontWeight: 'bold',
                        color: team1Colors.primary,
                        textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                        mb: 1,
                        textAlign: 'center',
                      }}
                    >
                      {matchup.team1.team_name}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 1.5,
                        justifyItems: 'center',
                      }}
                    >
                      {team1Bench.slice(0, 6).map((player) => renderJersey(player, team1Colors))}
                    </Box>
                  </Box>

                  {/* Center Line */}
                  <Box sx={{ height: 2, bgcolor: 'white', opacity: 0.5, my: 1 }} />

                  {/* Team 2 Bench */}
                  <Box>
                    <Typography
                      level="body-sm"
                      sx={{
                        fontWeight: 'bold',
                        color: team2Colors.primary,
                        textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                        mb: 1,
                        textAlign: 'center',
                      }}
                    >
                      {matchup.team2.team_name}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 1.5,
                        justifyItems: 'center',
                      }}
                    >
                      {team2Bench.slice(0, 6).map((player) => renderJersey(player, team2Colors))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Box Score Tab */}
        <TabPanel value={1}>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {renderPlayerTable(matchup.team1.roster, team1Colors, matchup.team1.team_name)}
            <Divider />
            {renderPlayerTable(matchup.team2.roster, team2Colors, matchup.team2.team_name)}
          </Stack>
        </TabPanel>

        {/* Matchup Stats Tab */}
        <TabPanel value={2}>
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 2 }}>
                    {matchup.team1.team_name} Stats
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography level="body-sm" color="neutral">
                        Total Salary
                      </Typography>
                      <Typography level="h4">
                        $
                        {(
                          matchup.team1.roster.reduce((sum, p) => sum + (p.salary_2025_26 || 0), 0) /
                          1000000
                        ).toFixed(1)}
                        M
                      </Typography>
                    </Box>
                    <Box>
                      <Typography level="body-sm" color="neutral">
                        Players Active
                      </Typography>
                      <Typography level="h4">{matchup.team1.roster.length}</Typography>
                    </Box>
                    <Box>
                      <Typography level="body-sm" color="neutral">
                        Record
                      </Typography>
                      <Typography level="h4">
                        {matchup.team1.wins}-{matchup.team1.losses}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 2 }}>
                    {matchup.team2.team_name} Stats
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography level="body-sm" color="neutral">
                        Total Salary
                      </Typography>
                      <Typography level="h4">
                        $
                        {(
                          matchup.team2.roster.reduce((sum, p) => sum + (p.salary_2025_26 || 0), 0) /
                          1000000
                        ).toFixed(1)}
                        M
                      </Typography>
                    </Box>
                    <Box>
                      <Typography level="body-sm" color="neutral">
                        Players Active
                      </Typography>
                      <Typography level="h4">{matchup.team2.roster.length}</Typography>
                    </Box>
                    <Box>
                      <Typography level="body-sm" color="neutral">
                        Record
                      </Typography>
                      <Typography level="h4">
                        {matchup.team2.wins}-{matchup.team2.losses}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Tabs>
    </Box>
  );
}
