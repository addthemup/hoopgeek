import { Box, Typography, Alert, Table, Chip } from '@mui/joy';
import { usePlayerGameStats } from '../../hooks/usePlayerGameStats';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { LineChart } from '@mui/x-charts/LineChart';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';

interface GameByGamePerformanceTableProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

export default function GameByGamePerformanceTable({ playerId, seasonYear, teamAbbreviation }: GameByGamePerformanceTableProps) {
  const { data: statsData, isLoading: statsLoading, error: statsError } = usePlayerGameStats(playerId, seasonYear);

  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1976d2';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#4CAF50';

  // Fetch boxscore data
  const { data: boxscoreData, isLoading: boxscoreLoading } = useQuery({
    queryKey: ['player-boxscores-for-table', playerId, seasonYear],
    queryFn: async () => {
      let query = supabase
        .from('nba_boxscores')
        .select('game_id, game_date, matchup, min, pts, reb, ast, fg_pct, fg3_pct, ft_pct')
        .eq('player_id', playerId);

      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }

      const { data, error } = await query.order('game_date', { ascending: false }).limit(15);

      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });

  if (statsLoading || boxscoreLoading) {
    return (
      <Box sx={{ p: 2, bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Loading game-by-game data...</Typography>
      </Box>
    );
  }

  if (statsError || !statsData || !boxscoreData) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Unable to load game-by-game data</Typography>
      </Alert>
    );
  }

  // Combine stats with boxscore data
  const gameData = statsData.stats
    .slice(0, 15)
    .map((stat) => {
      const boxscore = boxscoreData.find((b: any) => b.game_id === stat.game_id);
      return {
        gameId: stat.game_id,
        date: boxscore?.game_date || '',
        matchup: boxscore?.matchup || '',
        min: boxscore?.min || 0,
        pts: boxscore?.pts || 0,
        reb: boxscore?.reb || 0,
        ast: boxscore?.ast || 0,
        per: stat.advanced_playerefficiencyrating || 0,
        ts: (stat.advanced_trueshootingpercentage || 0) * 100,
        usage: (stat.advanced_usagepercentage || 0) * 100,
      };
    })
    .reverse(); // Show oldest to newest

  if (gameData.length === 0) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>No game data available</Typography>
      </Alert>
    );
  }

  // Prepare sparkline data
  const pointsData = gameData.map((g) => g.pts);
  const reboundsData = gameData.map((g) => g.reb);
  const assistsData = gameData.map((g) => g.ast);
  const perData = gameData.map((g) => g.per);
  const tsData = gameData.map((g) => g.ts);
  const usageData = gameData.map((g) => g.usage);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <Box sx={{ width: '100%', p: 2, bgcolor: '#000000' }}>
      <Typography level="h4" sx={{ mb: 2, fontWeight: 'bold', color: '#FFFFFF' }}>
        Game-by-Game Performance
      </Typography>
      <Typography level="body-sm" sx={{ mb: 3, color: '#CCCCCC' }}>
        Last 15 Games with Advanced Stats
      </Typography>

      <Box sx={{ overflowX: 'auto', width: '100%' }}>
        <Table hoverRow size="sm" sx={{ minWidth: 800, bgcolor: '#000000' }}>
          <thead>
            <tr>
              <th style={{ color: '#FFFFFF' }}>Date</th>
              <th style={{ color: '#FFFFFF' }}>Opponent</th>
              <th style={{ color: '#FFFFFF' }}>Min</th>
              <th style={{ color: '#FFFFFF' }}>PTS</th>
              <th style={{ color: '#FFFFFF' }}>REB</th>
              <th style={{ color: '#FFFFFF' }}>AST</th>
              <th style={{ color: '#FFFFFF' }}>PER</th>
              <th style={{ color: '#FFFFFF' }}>TS%</th>
              <th style={{ color: '#FFFFFF' }}>USG%</th>
            </tr>
          </thead>
          <tbody>
            {gameData.map((game) => (
              <tr key={game.gameId}>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>{formatDate(game.date)}</Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                    {game.matchup}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>{game.min}</Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: primaryColor }}>
                    {game.pts}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: secondaryColor }}>
                    {game.reb}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: primaryColor }}>
                    {game.ast}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>{game.per > 0 ? game.per.toFixed(1) : 'N/A'}</Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>{game.ts > 0 ? `${game.ts.toFixed(1)}%` : 'N/A'}</Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>{game.usage > 0 ? `${game.usage.toFixed(1)}%` : 'N/A'}</Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Box>

      {/* Mini Sparklines */}
      <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: '#FFFFFF' }}>
            Points Trend
          </Typography>
          <LineChart
            width={600}
            height={100}
            series={[
              {
                data: pointsData,
                showMarkers: false,
                color: primaryColor,
              },
            ]}
            xAxis={[{ 
              scaleType: 'point', 
              data: gameData.map((_, i) => i),
              tickLabelStyle: { fill: '#CCCCCC' },
            }]}
            yAxis={[{
              tickLabelStyle: { fill: '#CCCCCC' },
            }]}
            sx={{ width: '100%', maxWidth: '100%', bgcolor: '#000000' }}
          />
        </Box>
        <Box>
          <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: '#FFFFFF' }}>
            PER Trend
          </Typography>
          <LineChart
            width={600}
            height={100}
            series={[
              {
                data: perData,
                showMarkers: false,
                color: secondaryColor,
              },
            ]}
            xAxis={[{ 
              scaleType: 'point', 
              data: gameData.map((_, i) => i),
              tickLabelStyle: { fill: '#CCCCCC' },
            }]}
            yAxis={[{
              tickLabelStyle: { fill: '#CCCCCC' },
            }]}
            sx={{ width: '100%', maxWidth: '100%', bgcolor: '#000000' }}
          />
        </Box>
      </Box>
    </Box>
  );
}

