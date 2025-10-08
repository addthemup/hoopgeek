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
  Table,
} from '@mui/joy';
import {
  SportsBasketball,
  Add,
  Remove,
  SwapHoriz,
  Notifications,
  Settings,
  EmojiEvents,
} from '@mui/icons-material';
import { useLeague } from '../hooks/useLeagues';
import { useTeams } from '../hooks/useTeams';
import { useCurrentWeekMatchups } from '../hooks/useMatchups';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import { useCurrentFantasyWeek, getWeekDisplayText, getSeasonPhaseColor } from '../hooks/useCurrentFantasyWeek';
import { useDivisions } from '../hooks/useDivisions';
import { FantasyTeam } from '../types';
import { supabase } from '../utils/supabase';
import { useQuery } from '@tanstack/react-query';

// Mock data for demonstration (keeping for other sections)

// Transform database teams to standings format
const transformTeamToStanding = (dbTeam: FantasyTeam, rank: number) => {
  const winPercentage = dbTeam.wins + dbTeam.losses > 0 
    ? (dbTeam.wins / (dbTeam.wins + dbTeam.losses)) 
    : 0;
  
  return {
    rank,
    team: dbTeam.team_name,
    owner: dbTeam.user_id ? 'Owner Assigned' : 'TBD',
    wins: dbTeam.wins,
    losses: dbTeam.losses,
    pct: winPercentage,
    pointsFor: dbTeam.points_for,
    pointsAgainst: dbTeam.points_against,
    streak: dbTeam.wins > dbTeam.losses ? 'W2' : dbTeam.losses > dbTeam.wins ? 'L1' : '--',
  };
};

const mockTransactions = [
  {
    id: 1,
    type: 'add',
    player: 'LeBron James',
    team: 'Lakers Legends',
    owner: 'John Doe',
    time: '2 hours ago',
    position: 'SF/PF',
  },
  {
    id: 2,
    type: 'drop',
    player: 'Russell Westbrook',
    team: 'Warriors Dynasty',
    owner: 'Jane Smith',
    time: '4 hours ago',
    position: 'PG',
  },
  {
    id: 3,
    type: 'trade',
    player: 'Stephen Curry',
    team: 'Celtics Pride',
    owner: 'Mike Johnson',
    time: '1 day ago',
    position: 'PG',
  },
];

const mockNews = [
  {
    id: 1,
    title: 'Fantasy Basketball Week 6 Waiver Wire Pickups',
    summary: 'Top players to target on the waiver wire for Week 6 of the fantasy basketball season.',
    source: 'HoopGeek',
    time: '3 hours ago',
    image: '🏀',
  },
  {
    id: 2,
    title: 'Injury Report: Key Players to Monitor',
    summary: 'Latest injury updates affecting fantasy basketball lineups this week.',
    source: 'HoopGeek',
    time: '6 hours ago',
    image: '🏥',
  },
  {
    id: 3,
    title: 'Trade Analysis: Breaking Down Recent Deals',
    summary: 'Analyzing the impact of recent NBA trades on fantasy basketball values.',
    source: 'HoopGeek',
    time: '1 day ago',
    image: '📊',
  },
];


interface LeagueHomeProps {
  leagueId: string;
  onTeamClick?: (teamId: string) => void;
}

export default function LeagueHome({ leagueId, onTeamClick }: LeagueHomeProps) {
  const { data: league, isLoading, error } = useLeague(leagueId);
  const { data: teams, isLoading: teamsLoading, error: teamsError } = useTeams(leagueId);
  const { data: matchups, isLoading: matchupsLoading, error: matchupsError } = useCurrentWeekMatchups(leagueId);
  const { data: nbaScoreboard, isLoading: scoreboardLoading, error: scoreboardError } = useNBAScoreboard();
  const { currentWeek, seasonPhase, isLoading: weekLoading } = useCurrentFantasyWeek();
  const { data: divisions = [], isLoading: divisionsLoading } = useDivisions(leagueId);

  // Fetch salary cap usage for all teams - moved to top to avoid hooks order issues
  const { data: teamSalaryData } = useQuery({
    queryKey: ['team-salary-cap-usage', leagueId],
    queryFn: async () => {
      if (!teams || teams.length === 0) return {};

      const salaryData: Record<string, number> = {};

      // Fetch salary data for all teams in parallel
      const promises = teams.map(async (team) => {
        try {
          const { data: rosterData, error } = await supabase
            .from('fantasy_team_players')
            .select(`
              player:player_id (
                salary_2025_26
              )
            `)
            .eq('fantasy_team_id', team.id);

          if (error) {
            console.error(`Error fetching roster for team ${team.id}:`, error);
            return { teamId: team.id, salary: 0 };
          }

          const totalSalary = rosterData?.reduce((sum, rosterSpot) => {
            const player = rosterSpot.player as any; // Type assertion for player
            const playerSalary = player?.salary_2025_26 || 0;
            return sum + playerSalary;
          }, 0) || 0;

          return { teamId: team.id, salary: totalSalary };
        } catch (error) {
          console.error(`Error calculating salary for team ${team.id}:`, error);
          return { teamId: team.id, salary: 0 };
        }
      });

      const results = await Promise.all(promises);
      
      results.forEach(({ teamId, salary }) => {
        salaryData[teamId] = salary;
      });

      return salaryData;
    },
    enabled: !!teams && teams.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Debug logging
  console.log('LeagueHome Debug Info:', {
    leagueId,
    league,
    isLoading,
    error,
    errorMessage: error?.message,
    errorStack: error?.stack
  });

  if (isLoading || teamsLoading || matchupsLoading || weekLoading || divisionsLoading) {
    console.log('LeagueHome: Loading state');
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading league...</Typography>
      </Box>
    );
  }

  if (error || !league || teamsError || matchupsError) {
    console.log('LeagueHome: Error or no league data', { error, league, teamsError });
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          Failed to load league. Please try again later.
          {error && (
            <Box sx={{ mt: 2 }}>
              <Typography level="body-xs" color="danger">
                League Error: {error.message || 'Unknown error'}
              </Typography>
            </Box>
          )}
          {teamsError && (
            <Box sx={{ mt: 2 }}>
              <Typography level="body-xs" color="danger">
                Teams Error: {teamsError.message || 'Unknown error'}
              </Typography>
            </Box>
          )}
        </Alert>
      </Box>
    );
  }

  // Generate standings grouped by divisions
  const generateDivisionStandings = () => {
    if (!teams || !divisions) return { divisionStandings: [], unassignedTeams: [] };

    const divisionStandings: Array<{
      division: { id: string; name: string; division_order: number };
      teams: Array<ReturnType<typeof transformTeamToStanding>>;
    }> = [];

    const unassignedTeams: Array<ReturnType<typeof transformTeamToStanding>> = [];

    // Sort divisions by order
    const sortedDivisions = [...divisions].sort((a, b) => a.division_order - b.division_order);

    // Process each division
    sortedDivisions.forEach(division => {
      const divisionTeams = teams.filter(team => team.division_id === division.id);
      
      if (divisionTeams.length > 0) {
        const sortedTeams = divisionTeams
          .sort((a, b) => {
            const aWinPct = a.wins / (a.wins + a.losses + a.ties);
            const bWinPct = b.wins / (b.wins + b.losses + b.ties);
            if (aWinPct !== bWinPct) return bWinPct - aWinPct;
            return b.points_for - a.points_for;
          })
          .map((team, index) => transformTeamToStanding(team, index + 1));

        divisionStandings.push({
          division,
          teams: sortedTeams
        });
      }
    });

    // Handle unassigned teams
    const assignedTeamIds = new Set(teams.filter(team => team.division_id).map(team => team.id));
    const unassigned = teams.filter(team => !assignedTeamIds.has(team.id));
    
    if (unassigned.length > 0) {
      const sortedUnassigned = unassigned
        .sort((a, b) => {
          const aWinPct = a.wins / (a.wins + a.losses + a.ties);
          const bWinPct = b.wins / (b.wins + b.losses + b.ties);
          if (aWinPct !== bWinPct) return bWinPct - aWinPct;
          return b.points_for - a.points_for;
        })
        .map((team, index) => transformTeamToStanding(team, index + 1));

      unassignedTeams.push(...sortedUnassigned);
    }

    return { divisionStandings, unassignedTeams };
  };

  const { divisionStandings, unassignedTeams } = generateDivisionStandings();

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', p: 2 }}>
      {/* League Header */}
      <Sheet 
        variant="solid" 
        color="primary" 
        sx={{ 
          p: 3, 
          mb: 3, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          color: 'white',
          '& .MuiChip-root': {
            color: 'white',
            borderColor: 'rgba(255,255,255,0.3)',
          }
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Avatar sx={{ width: 60, height: 60, bgcolor: 'rgba(255,255,255,0.2)' }}>
            <SportsBasketball sx={{ fontSize: 30 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography level="h2" sx={{ fontWeight: 'bold', mb: 1 }}>
              {league.name}
            </Typography>
            <Typography level="body-md" sx={{ opacity: 0.9 }}>
              {league.description}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton sx={{ color: 'white' }}>
              <Notifications />
            </IconButton>
            <IconButton sx={{ color: 'white' }}>
              <Settings />
            </IconButton>
          </Stack>
        </Stack>
        
        <Grid container spacing={2}>
          <Grid xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography level="h4" sx={{ fontWeight: 'bold' }}>{league.max_teams}</Typography>
              <Typography level="body-sm" sx={{ opacity: 0.8 }}>Teams</Typography>
            </Box>
          </Grid>
          <Grid xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography level="h4" sx={{ fontWeight: 'bold' }}>{league.scoring_type || 'H2H Points'}</Typography>
              <Typography level="body-sm" sx={{ opacity: 0.8 }}>Scoring</Typography>
            </Box>
          </Grid>
          <Grid xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography level="h4" sx={{ fontWeight: 'bold' }}>{league.lineup_frequency || 'Weekly'}</Typography>
              <Typography level="body-sm" sx={{ opacity: 0.8 }}>Lineups</Typography>
            </Box>
          </Grid>
          <Grid xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography level="h4" sx={{ fontWeight: 'bold' }}>${(league.salary_cap_amount || 100000000) / 1000000}M</Typography>
              <Typography level="body-sm" sx={{ opacity: 0.8 }}>Salary Cap</Typography>
            </Box>
          </Grid>
          <Grid xs={12} sm={6} md={2.4}>
            <Box sx={{ textAlign: 'center' }}>
              <Chip 
                color={getSeasonPhaseColor(seasonPhase) as any} 
                variant="solid"
                sx={{ 
                  mb: 1,
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  minWidth: '80px'
                }}
              >
                {getWeekDisplayText(currentWeek, seasonPhase)}
              </Chip>
              <Typography level="body-sm" sx={{ opacity: 0.8 }}>
                {currentWeek ? `${currentWeek.start_date} - ${currentWeek.end_date}` : 'Season Phase'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Sheet>


      <Grid container spacing={3}>
        {/* Left Column - Matchups, Standings, and Commish Notes */}
        <Grid xs={12} lg={8}>
          <Stack spacing={3}>
            {/* Commissioner Notes */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Commish Notes
                </Typography>
                
                <Alert color="primary" sx={{ mb: 2 }}>
                  <Typography level="body-sm">
                    Welcome to Week 6! Make sure to set your lineups before the games start. 
                    Good luck to everyone!
                  </Typography>
                </Alert>
                
                <Button variant="outlined" size="sm" fullWidth>
                  View All Announcements
                </Button>
              </CardContent>
            </Card>
            {/* Matchups Section - Only show during regular season and playoffs */}
            {seasonPhase !== 'preseason' && seasonPhase !== 'offseason' && (
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {getWeekDisplayText(currentWeek, seasonPhase)} Matchups
                    </Typography>
                  <Chip size="sm" color="neutral">Not started yet</Chip>
                </Stack>
                
                <Stack spacing={2}>
                  {matchups && matchups.length > 0 ? (
                    matchups.map((matchup) => (
                    <Sheet key={matchup.id} variant="outlined" sx={{ p: 2 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid xs={5}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.500', cursor: 'pointer' }} onClick={() => onTeamClick?.(matchup.fantasy_team1_id)}>
                              {matchup.team1?.team_name?.charAt(0) || '?'}
                            </Avatar>
                            <Box>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => onTeamClick?.(matchup.fantasy_team1_id)}>
                                {matchup.team1?.team_name || 'Team 1'}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {matchup.team1?.user_id ? 'Owner Assigned' : 'TBD'}
                              </Typography>
                            </Box>
                          </Stack>
                        </Grid>
                        <Grid xs={2} sx={{ textAlign: 'center' }}>
                          <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                            {matchup.fantasy_team1_score} - {matchup.fantasy_team2_score}
                          </Typography>
                          <Chip 
                            size="sm" 
                            color={matchup.status === 'completed' ? 'success' : 'neutral'}
                            sx={{ mt: 0.5 }}
                          >
                            {matchup.status === 'completed' ? 'Final' : 'Scheduled'}
                          </Chip>
                        </Grid>
                        <Grid xs={5}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => onTeamClick?.(matchup.fantasy_team2_id)}>
                                {matchup.team2?.team_name || 'Team 2'}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {matchup.team2?.user_id ? 'Owner Assigned' : 'TBD'}
                              </Typography>
                            </Box>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.500', cursor: 'pointer' }} onClick={() => onTeamClick?.(matchup.fantasy_team2_id)}>
                              {matchup.team2?.team_name?.charAt(0) || '?'}
                            </Avatar>
                          </Stack>
                        </Grid>
                      </Grid>
                    </Sheet>
                    ))
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography level="body-md" color="neutral">
                        No matchups scheduled for Week 1 yet.
                      </Typography>
                      <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                        The commissioner will generate the schedule once teams are set up.
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
            )}

            {/* Preseason Message */}
            {seasonPhase === 'preseason' && (
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar sx={{ bgcolor: 'warning.500' }}>
                      <EmojiEvents />
                    </Avatar>
                    <Box>
                      <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                        Preseason
                      </Typography>
                      <Typography level="body-md" color="neutral">
                        The regular season hasn't started yet. Matchups will appear once Week 1 begins on {currentWeek?.start_date}.
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Standings Section */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  League Standings
                </Typography>
                
                <Stack spacing={3}>
                  {/* Division Standings */}
                  {divisionStandings.map(({ division, teams: divisionTeams }) => (
                    <Box key={division.id}>
                      <Typography level="title-md" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.600' }}>
                        {division.name}
                      </Typography>
                      <Table size="sm" hoverRow>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th style={{ textAlign: 'center' }}>W</th>
                            <th style={{ textAlign: 'center' }}>L</th>
                            <th style={{ textAlign: 'center' }}>PCT</th>
                            <th style={{ textAlign: 'center' }}>PF</th>
                            <th style={{ textAlign: 'center' }}>PA</th>
                            <th style={{ textAlign: 'center' }}>Streak</th>
                          </tr>
                        </thead>
                        <tbody>
                          {divisionTeams.map((team) => (
                            <tr key={team.rank} onClick={() => {
                              const found = teams?.find(t => t.team_name === team.team)
                              if (found) onTeamClick?.(found.id)
                            }} style={{ cursor: 'pointer' }}>
                              <td>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team.rank}
                                  </Typography>
                                  {team.rank <= 3 && (
                                    <EmojiEvents sx={{ fontSize: 16, color: team.rank === 1 ? 'gold' : team.rank === 2 ? 'silver' : '#CD7F32' }} />
                                  )}
                                </Stack>
                              </td>
                              <td>
                                <Box>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team.team}
                                  </Typography>
                                  <Typography level="body-xs" color="neutral">
                                    {team.owner}
                                  </Typography>
                                </Box>
                              </td>
                              <td style={{ textAlign: 'center' }}>{team.wins}</td>
                              <td style={{ textAlign: 'center' }}>{team.losses}</td>
                              <td style={{ textAlign: 'center' }}>{team.pct.toFixed(3)}</td>
                              <td style={{ textAlign: 'center' }}>{team.pointsFor.toFixed(1)}</td>
                              <td style={{ textAlign: 'center' }}>{team.pointsAgainst.toFixed(1)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <Chip 
                                  size="sm" 
                                  color={team.streak.startsWith('W') ? 'success' : 'danger'}
                                  variant="outlined"
                                >
                                  {team.streak}
                                </Chip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Box>
                  ))}

                  {/* Unassigned Teams */}
                  {unassignedTeams.length > 0 && (
                    <Box>
                      <Typography level="title-md" sx={{ fontWeight: 'bold', mb: 1, color: 'neutral.600' }}>
                        Unassigned Teams
                      </Typography>
                      <Table size="sm" hoverRow>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th style={{ textAlign: 'center' }}>W</th>
                            <th style={{ textAlign: 'center' }}>L</th>
                            <th style={{ textAlign: 'center' }}>PCT</th>
                            <th style={{ textAlign: 'center' }}>PF</th>
                            <th style={{ textAlign: 'center' }}>PA</th>
                            <th style={{ textAlign: 'center' }}>Streak</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unassignedTeams.map((team) => (
                            <tr key={team.rank} onClick={() => {
                              const found = teams?.find(t => t.team_name === team.team)
                              if (found) onTeamClick?.(found.id)
                            }} style={{ cursor: 'pointer' }}>
                              <td>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team.rank}
                                  </Typography>
                                </Stack>
                              </td>
                              <td>
                                <Box>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team.team}
                                  </Typography>
                                  <Typography level="body-xs" color="neutral">
                                    {team.owner}
                                  </Typography>
                                </Box>
                              </td>
                              <td style={{ textAlign: 'center' }}>{team.wins}</td>
                              <td style={{ textAlign: 'center' }}>{team.losses}</td>
                              <td style={{ textAlign: 'center' }}>{team.pct.toFixed(3)}</td>
                              <td style={{ textAlign: 'center' }}>{team.pointsFor.toFixed(1)}</td>
                              <td style={{ textAlign: 'center' }}>{team.pointsAgainst.toFixed(1)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <Chip 
                                  size="sm" 
                                  color={team.streak.startsWith('W') ? 'success' : 'danger'}
                                  variant="outlined"
                                >
                                  {team.streak}
                                </Chip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Box>
                  )}

                  {/* No divisions message */}
                  {divisionStandings.length === 0 && unassignedTeams.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography level="body-md" color="neutral">
                        No teams found in standings.
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                    Recent Transactions
                  </Typography>
                  <Button size="sm" variant="outlined">
                    View All
                  </Button>
                </Stack>
                
                <List>
                  {mockTransactions.map((transaction) => (
                    <ListItem key={transaction.id}>
                      <ListItemDecorator>
                        <Avatar sx={{ 
                          bgcolor: transaction.type === 'add' ? 'success.500' : 
                                  transaction.type === 'drop' ? 'danger.500' : 'warning.500',
                          width: 32,
                          height: 32
                        }}>
                          {transaction.type === 'add' ? <Add /> : 
                           transaction.type === 'drop' ? <Remove /> : <SwapHoriz />}
                        </Avatar>
                      </ListItemDecorator>
                      <ListItemContent>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {transaction.player}
                          </Typography>
                          <Chip size="sm" variant="outlined">
                            {transaction.position}
                          </Chip>
                          <Typography level="body-xs" color="neutral">
                            {transaction.type === 'add' ? 'Added' : 
                             transaction.type === 'drop' ? 'Dropped' : 'Traded'}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography level="body-xs" color="neutral">
                            {transaction.team} • {transaction.owner}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {transaction.time}
                          </Typography>
                        </Stack>
                      </ListItemContent>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right Column - NBA Scoreboard and Salary Table */}
        <Grid xs={12} lg={4}>
          <Stack spacing={3}>
            {/* NBA Scoreboard */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  NBA Scoreboard
                </Typography>
                
                {scoreboardLoading ? (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <LinearProgress />
                    <Typography level="body-sm" sx={{ mt: 1 }}>
                      Loading NBA games...
                    </Typography>
                  </Box>
                ) : scoreboardError ? (
                  <Alert color="warning">
                    <Typography level="body-sm">
                      Unable to load NBA games. Showing mock data.
                    </Typography>
                  </Alert>
                ) : nbaScoreboard && nbaScoreboard.games.length > 0 ? (
                  <Stack spacing={2}>
                    {nbaScoreboard.games.map((game) => (
                      <Sheet key={game.gameId} variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography level="body-xs" color="neutral">
                            {game.gameStatus === 1 ? 'Scheduled' : 
                             game.gameStatus === 2 ? 'Live' : 'Final'}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {game.gameStatusText}
                          </Typography>
                        </Stack>
                        <Grid container spacing={1} alignItems="center">
                          <Grid xs={5}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.500', fontSize: '0.7rem' }}>
                                {game.awayTeam.abbreviation}
                              </Avatar>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {game.awayTeam.name}
                              </Typography>
                            </Stack>
                          </Grid>
                          <Grid xs={2} sx={{ textAlign: 'center' }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {game.awayTeam.points}
                            </Typography>
                          </Grid>
                          <Grid xs={5}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {game.homeTeam.name}
                              </Typography>
                              <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.500', fontSize: '0.7rem' }}>
                                {game.homeTeam.abbreviation}
                              </Avatar>
                            </Stack>
                          </Grid>
                        </Grid>
                        <Grid container spacing={1} sx={{ mt: 0.5 }}>
                          <Grid xs={5}></Grid>
                          <Grid xs={2} sx={{ textAlign: 'center' }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {game.homeTeam.points}
                            </Typography>
                          </Grid>
                          <Grid xs={5}></Grid>
                        </Grid>
                        {game.arena && game.arena !== 'Unknown Arena' && (
                          <Typography level="body-xs" color="neutral" sx={{ mt: 1, textAlign: 'center' }}>
                            {game.arena}
                          </Typography>
                        )}
                      </Sheet>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography level="body-md" color="neutral">
                      No NBA games scheduled for today.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Salary Table - Only show if league has salary cap enabled */}
            {league.salary_cap_enabled && (
              <Card>
                <CardContent>
                  <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                    League Salary Cap
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                      League Cap: ${(league.salary_cap_amount || 100000000) / 1000000}M
                    </Typography>
                  </Box>
                  
                  <Table size="sm" hoverRow>
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th style={{ textAlign: 'right' }}>Used</th>
                        <th style={{ textAlign: 'right' }}>Available</th>
                        <th style={{ textAlign: 'right' }}>% Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams && teams.length > 0 ? (
                        teams
                          .sort((a, b) => {
                            const aSalary = teamSalaryData?.[a.id] || 0;
                            const bSalary = teamSalaryData?.[b.id] || 0;
                            return bSalary - aSalary; // Sort by salary used (highest first)
                          })
                          .map((team) => {
                            const salaryCapMax = league.salary_cap_amount || 100000000;
                            const used = teamSalaryData?.[team.id] || 0;
                            const available = salaryCapMax - used;
                            const percentUsed = (used / salaryCapMax) * 100;
                            
                            return (
                              <tr 
                                key={team.id} 
                                onClick={() => onTeamClick?.(team.id)} 
                                style={{ cursor: 'pointer' }}
                              >
                                <td>
                                  <Box>
                                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                      {team.team_name}
                                    </Typography>
                                    <Typography level="body-xs" color="neutral">
                                      {team.user_id ? 'Owner Assigned' : 'TBD'}
                                    </Typography>
                                  </Box>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    ${(used / 1000000).toFixed(1)}M
                                  </Typography>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Typography 
                                    level="body-sm" 
                                    sx={{ 
                                      fontWeight: 'bold',
                                      color: available < 0 ? 'danger.500' : 'success.500'
                                    }}
                                  >
                                    ${(available / 1000000).toFixed(1)}M
                                  </Typography>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Chip 
                                    size="sm" 
                                    color={percentUsed > 90 ? 'danger' : percentUsed > 75 ? 'warning' : 'success'}
                                    variant="outlined"
                                  >
                                    {percentUsed.toFixed(1)}%
                                  </Chip>
                                </td>
                              </tr>
                            );
                          })
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>
                            <Typography level="body-sm" color="neutral">
                              No teams found
                            </Typography>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Fantasy News */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Fantasy News
                </Typography>
                
                <Stack spacing={2}>
                  {mockNews.map((article) => (
                    <Sheet key={article.id} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" spacing={2}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                          {article.image}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            {article.title}
                          </Typography>
                          <Typography level="body-xs" color="neutral" sx={{ mb: 1, display: 'block' }}>
                            {article.summary}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography level="body-xs" color="neutral">
                              {article.source}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              •
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {article.time}
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
                
                <Button variant="outlined" size="sm" fullWidth sx={{ mt: 2 }}>
                  View All News
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
