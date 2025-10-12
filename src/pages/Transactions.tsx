import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Avatar,
  Table,
  Sheet,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
} from '@mui/joy';
import {
  SwapHoriz,
  TrendingUp,
  TrendingDown,
  Remove,
} from '@mui/icons-material';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useNavigate } from 'react-router-dom';

interface TransactionsProps {
  leagueId: string;
}

// Mock data for trending players
const mockTrendingPlayers = [
  {
    id: 1,
    name: 'LeBron James',
    position: 'SF',
    team: 'LAL',
    ownership: 98,
    addedPercent: 15,
    droppedPercent: 2,
    trend: 'up',
    imageId: 2544
  },
  {
    id: 2,
    name: 'Stephen Curry',
    position: 'PG',
    team: 'GSW',
    ownership: 95,
    addedPercent: 12,
    droppedPercent: 1,
    trend: 'up',
    imageId: 201939
  },
  {
    id: 3,
    name: 'Anthony Davis',
    position: 'C',
    team: 'LAL',
    ownership: 88,
    addedPercent: 8,
    droppedPercent: 5,
    trend: 'down',
    imageId: 203076
  },
  {
    id: 4,
    name: 'Giannis Antetokounmpo',
    position: 'PF',
    team: 'MIL',
    ownership: 97,
    addedPercent: 10,
    droppedPercent: 1,
    trend: 'up',
    imageId: 203507
  },
  {
    id: 5,
    name: 'Luka Doncic',
    position: 'PG',
    team: 'DAL',
    ownership: 96,
    addedPercent: 14,
    droppedPercent: 2,
    trend: 'up',
    imageId: 1629029
  },
];

// Mock data for add/drop activity chart
const mockActivityData = {
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  adds: [45, 52, 38, 67, 89, 102, 78],
  drops: [38, 45, 42, 59, 75, 88, 65],
};

// Mock data for position trends
const mockPositionTrends = [
  { position: 'PG', added: 145, dropped: 98 },
  { position: 'SG', added: 132, dropped: 105 },
  { position: 'SF', added: 128, dropped: 112 },
  { position: 'PF', added: 119, dropped: 95 },
  { position: 'C', added: 156, dropped: 125 },
];

export default function Transactions({ leagueId }: TransactionsProps) {
  const navigate = useNavigate();

  // Fetch all accepted trades
  const { data: allTrades = [], isLoading } = useQuery({
    queryKey: ['all-trades', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_trade_offers')
        .select(`
          id,
          created_at,
          responded_at,
          offered_players,
          offered_picks,
          requested_players,
          requested_picks,
          from_team:fantasy_teams!from_team_id(team_name, user_id),
          to_team:fantasy_teams!to_team_id(team_name, user_id)
        `)
        .eq('league_id', leagueId)
        .eq('status', 'accepted')
        .order('responded_at', { ascending: false });

      if (error) {
        console.error('Error fetching all trades:', error);
        return [];
      }

      // Fetch player details for all players involved in trades
      const allPlayerIds = new Set<number>();
      data?.forEach((trade: any) => {
        trade.offered_players?.forEach((id: number) => allPlayerIds.add(id));
        trade.requested_players?.forEach((id: number) => allPlayerIds.add(id));
      });

      let playersMap: Record<number, any> = {};
      if (allPlayerIds.size > 0) {
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('id, name, position, team_abbreviation, nba_player_id, salary_2025_26')
          .in('id', Array.from(allPlayerIds));

        if (!playersError && playersData) {
          playersData.forEach((player) => {
            playersMap[player.id] = player;
          });
        }
      }

      // Fetch pick details
      const allPickNumbers = new Set<number>();
      data?.forEach((trade: any) => {
        trade.offered_picks?.forEach((num: number) => allPickNumbers.add(num));
        trade.requested_picks?.forEach((num: number) => allPickNumbers.add(num));
      });

      let picksMap: Record<number, any> = {};
      if (allPickNumbers.size > 0) {
        const { data: picksData, error: picksError } = await supabase
          .from('draft_order')
          .select('pick_number, round, team_position')
          .eq('league_id', leagueId)
          .in('pick_number', Array.from(allPickNumbers));

        if (!picksError && picksData) {
          picksData.forEach((pick) => {
            picksMap[pick.pick_number] = pick;
          });
        }
      }

      // Attach player and pick data to trades
      const tradesWithDetails = data?.map((trade: any) => ({
        ...trade,
        offered_players_data: trade.offered_players?.map((id: number) => playersMap[id]).filter(Boolean) || [],
        requested_players_data: trade.requested_players?.map((id: number) => playersMap[id]).filter(Boolean) || [],
        offered_picks_data: trade.offered_picks?.map((num: number) => picksMap[num]).filter(Boolean) || [],
        requested_picks_data: trade.requested_picks?.map((num: number) => picksMap[num]).filter(Boolean) || [],
      })) || [];

      return tradesWithDetails;
    },
    enabled: !!leagueId,
    refetchInterval: 30000,
  });

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Left Column - Transactions Table */}
        <Grid xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography level="h3" sx={{ fontWeight: 'bold', mb: 3 }}>
                League Transactions
              </Typography>

              {isLoading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography>Loading transactions...</Typography>
                </Box>
              ) : allTrades.length > 0 ? (
                <Stack spacing={2}>
                  {allTrades.map((trade: any) => {
                    const fromTeamName = trade.from_team?.team_name || 'Unknown Team';
                    const toTeamName = trade.to_team?.team_name || 'Unknown Team';
                    const tradeTime = trade.responded_at
                      ? new Date(trade.responded_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'Recently';

                    return (
                      <Sheet
                        key={trade.id}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 'sm',
                          '&:hover': { bgcolor: 'background.level1' },
                        }}
                      >
                        <Stack spacing={1.5}>
                          {/* Trade Header */}
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar sx={{ bgcolor: 'primary.500', width: 32, height: 32 }}>
                                <SwapHoriz />
                              </Avatar>
                              <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {fromTeamName}
                                  </Typography>
                                  <Typography level="body-xs" color="neutral">
                                    ↔
                                  </Typography>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {toTeamName}
                                  </Typography>
                                </Stack>
                                <Typography level="body-xs" color="neutral">
                                  {tradeTime}
                                </Typography>
                              </Box>
                            </Stack>
                            <Chip size="sm" color="success" variant="soft">
                              ✓ Accepted
                            </Chip>
                          </Stack>

                          {/* Trade Details */}
                          <Grid container spacing={2}>
                            {/* From Team Assets */}
                            <Grid xs={12} md={6}>
                              <Box sx={{ bgcolor: 'background.level1', p: 1.5, borderRadius: 'sm' }}>
                                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 1 }}>
                                  {fromTeamName} Sends:
                                </Typography>
                                <Stack spacing={0.5}>
                                  {trade.offered_players_data?.map((player: any) => (
                                    <Box
                                      key={player.id}
                                      onClick={() => navigate(`/players/${player.id}`)}
                                      sx={{
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: 'primary.50' },
                                        p: 0.5,
                                        borderRadius: 'sm',
                                      }}
                                    >
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Avatar
                                          size="sm"
                                          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                                          sx={{ width: 20, height: 20 }}
                                        >
                                          {player.name?.charAt(0)}
                                        </Avatar>
                                        <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                                          {player.name}
                                        </Typography>
                                        <Typography level="body-xs" color="neutral">
                                          {player.position} • {player.team_abbreviation}
                                        </Typography>
                                      </Stack>
                                    </Box>
                                  ))}
                                  {trade.offered_picks_data?.map((pick: any) => (
                                    <Box key={pick.pick_number}>
                                      <Typography level="body-xs">
                                        Pick #{pick.pick_number} (Rd {pick.round})
                                      </Typography>
                                    </Box>
                                  ))}
                                </Stack>
                              </Box>
                            </Grid>

                            {/* To Team Assets */}
                            <Grid xs={12} md={6}>
                              <Box sx={{ bgcolor: 'background.level1', p: 1.5, borderRadius: 'sm' }}>
                                <Typography level="body-xs" sx={{ fontWeight: 'bold', mb: 1 }}>
                                  {toTeamName} Sends:
                                </Typography>
                                <Stack spacing={0.5}>
                                  {trade.requested_players_data?.map((player: any) => (
                                    <Box
                                      key={player.id}
                                      onClick={() => navigate(`/players/${player.id}`)}
                                      sx={{
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: 'primary.50' },
                                        p: 0.5,
                                        borderRadius: 'sm',
                                      }}
                                    >
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Avatar
                                          size="sm"
                                          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                                          sx={{ width: 20, height: 20 }}
                                        >
                                          {player.name?.charAt(0)}
                                        </Avatar>
                                        <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                                          {player.name}
                                        </Typography>
                                        <Typography level="body-xs" color="neutral">
                                          {player.position} • {player.team_abbreviation}
                                        </Typography>
                                      </Stack>
                                    </Box>
                                  ))}
                                  {trade.requested_picks_data?.map((pick: any) => (
                                    <Box key={pick.pick_number}>
                                      <Typography level="body-xs">
                                        Pick #{pick.pick_number} (Rd {pick.round})
                                      </Typography>
                                    </Box>
                                  ))}
                                </Stack>
                              </Box>
                            </Grid>
                          </Grid>
                        </Stack>
                      </Sheet>
                    );
                  })}
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography level="body-lg" color="neutral">
                    No transactions yet
                  </Typography>
                  <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                    Trades will appear here once they are completed
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Trending & Analytics */}
        <Grid xs={12} lg={4}>
          <Stack spacing={3}>
            {/* Trending Players */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Trending Players
                </Typography>

                <List size="sm">
                  {mockTrendingPlayers.map((player, index) => (
                    <ListItem
                      key={player.id}
                      sx={{
                        py: 1,
                        px: 0,
                        borderBottom: index < mockTrendingPlayers.length - 1 ? '1px solid' : 'none',
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemDecorator>
                        <Avatar
                          size="sm"
                          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.imageId}.png`}
                          sx={{ width: 32, height: 32 }}
                        >
                          {player.name.charAt(0)}
                        </Avatar>
                      </ListItemDecorator>
                      <ListItemContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {player.name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {player.position} • {player.team}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              size="sm"
                              color={player.trend === 'up' ? 'success' : 'danger'}
                              startDecorator={player.trend === 'up' ? <TrendingUp /> : <TrendingDown />}
                            >
                              {player.addedPercent}%
                            </Chip>
                            <Typography level="body-xs" color="neutral">
                              {player.ownership}%
                            </Typography>
                          </Stack>
                        </Stack>
                      </ListItemContent>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>

            {/* Activity Chart */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Weekly Activity
                </Typography>

                <Box sx={{ width: '100%', height: 200 }}>
                  <LineChart
                    xAxis={[{ scaleType: 'point', data: mockActivityData.days }]}
                    series={[
                      {
                        data: mockActivityData.adds,
                        label: 'Adds',
                        color: '#10b981',
                      },
                      {
                        data: mockActivityData.drops,
                        label: 'Drops',
                        color: '#ef4444',
                      },
                    ]}
                    height={200}
                    margin={{ left: 30, right: 10, top: 10, bottom: 30 }}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Position Trends */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Position Trends
                </Typography>

                <Box sx={{ width: '100%', height: 220 }}>
                  <BarChart
                    xAxis={[{ scaleType: 'band', data: mockPositionTrends.map((p) => p.position) }]}
                    series={[
                      {
                        data: mockPositionTrends.map((p) => p.added),
                        label: 'Added',
                        color: '#10b981',
                      },
                      {
                        data: mockPositionTrends.map((p) => p.dropped),
                        label: 'Dropped',
                        color: '#ef4444',
                      },
                    ]}
                    height={220}
                    margin={{ left: 40, right: 10, top: 10, bottom: 30 }}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Hot Takes */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  League Insights
                </Typography>

                <Stack spacing={2}>
                  <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 'sm', borderLeft: '4px solid', borderColor: 'success.500' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      🔥 Most Active Day
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      Saturday saw 102 adds and 88 drops - the most active day this week!
                    </Typography>
                  </Box>

                  <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 'sm', borderLeft: '4px solid', borderColor: 'primary.500' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      📈 Position Spotlight
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      Centers are the hottest position this week with 156 adds across the league.
                    </Typography>
                  </Box>

                  <Box sx={{ p: 2, bgcolor: 'warning.50', borderRadius: 'sm', borderLeft: '4px solid', borderColor: 'warning.500' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      ⚡ Trade Activity
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {allTrades.length} trade{allTrades.length !== 1 ? 's' : ''} completed this season.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

