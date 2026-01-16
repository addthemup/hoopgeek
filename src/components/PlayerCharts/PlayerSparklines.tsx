import { Box, Typography, Stack, Alert } from '@mui/joy';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { lineElementClasses } from '@mui/x-charts/LineChart';
import { usePlayerGameStats } from '../../hooks/usePlayerGameStats';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';
import { FANDUEL_SCORING, calculateFantasyPoints } from '../../utils/fantasyScoring';

interface PlayerSparklinesProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

export default function PlayerSparklines({ playerId, seasonYear, teamAbbreviation }: PlayerSparklinesProps) {
  const { data: statsData, isLoading: statsLoading, error: statsError } = usePlayerGameStats(playerId, seasonYear);

  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1976d2';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#4CAF50';

  // Fetch boxscore data for last 20 games
  const { data: boxscoreData, isLoading: boxscoreLoading } = useQuery({
    queryKey: ['player-boxscores-sparklines', playerId, seasonYear],
    queryFn: async () => {
      let query = supabase
        .from('nba_boxscores')
        .select('game_id, game_date, min, pts, reb, ast, stl, blk, tov, fg_pct, fg3_pct, ft_pct')
        .eq('player_id', playerId);

      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }

      const { data, error } = await query.order('game_date', { ascending: false }).limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });

  if (statsLoading || boxscoreLoading) {
    return (
      <Box sx={{ p: 2, bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Loading...</Typography>
      </Box>
    );
  }

  if (statsError || !statsData || !boxscoreData) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Unable to load data</Typography>
      </Alert>
    );
  }

  // Combine stats with boxscore data and reverse to show chronological order
  const gameData = statsData.stats
    .slice(0, 20)
    .map((stat) => {
      const boxscore = boxscoreData.find((b: any) => b.game_id === stat.game_id);
      if (!boxscore) return null;
      
      const fantasyPoints = calculateFantasyPoints({
        pts: boxscore.pts || 0,
        reb: boxscore.reb || 0,
        ast: boxscore.ast || 0,
        stl: boxscore.stl || 0,
        blk: boxscore.blk || 0,
        tov: boxscore.tov || 0,
      } as any, FANDUEL_SCORING);

      return {
        gameId: stat.game_id,
        date: boxscore.game_date,
        min: parseFloat(boxscore.min) || 0,
        fantasy: fantasyPoints,
        ts: (stat.advanced_trueshootingpercentage || 0) * 100,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .reverse(); // Show oldest to newest

  if (gameData.length === 0) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>No game data available</Typography>
      </Alert>
    );
  }

  // Get current (most recent) values for display
  const currentMinutes = gameData[gameData.length - 1]?.min || 0;
  const currentFantasy = gameData[gameData.length - 1]?.fantasy || 0;
  const currentTS = gameData[gameData.length - 1]?.ts || 0;

  return (
    <Stack spacing={2}>
      {/* Minutes Sparkline */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="column" spacing={0.5}>
            <Typography sx={{ color: '#FFFFFF', fontWeight: 500, fontSize: '0.875rem' }}>
              Minutes
            </Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: primaryColor }}>
              {currentMinutes.toFixed(1)}
            </Typography>
          </Stack>
          <Box sx={{ width: 120, height: 40, overflow: 'hidden' }}>
            {gameData.length > 0 && (
              <SparkLineChart
                data={gameData.map((g) => g.min)}
                height={40}
                width={120}
                color={primaryColor}
                margin={{ top: 5, bottom: 5, left: 4, right: 0 }}
                sx={{
                  [`& .${lineElementClasses.root}`]: {
                    strokeWidth: 2,
                  },
                }}
              />
            )}
          </Box>
        </Stack>
      </Box>

      {/* Fantasy Points Sparkline */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="column" spacing={0.5}>
            <Typography sx={{ color: '#FFFFFF', fontWeight: 500, fontSize: '0.875rem' }}>
              Fantasy Pts
            </Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: secondaryColor }}>
              {currentFantasy.toFixed(1)}
            </Typography>
          </Stack>
          <Box sx={{ width: 120, height: 40, overflow: 'hidden' }}>
            {gameData.length > 0 && (
              <SparkLineChart
                data={gameData.map((g) => g.fantasy)}
                height={40}
                width={120}
                color={secondaryColor}
                margin={{ top: 5, bottom: 5, left: 4, right: 0 }}
                sx={{
                  [`& .${lineElementClasses.root}`]: {
                    strokeWidth: 2,
                  },
                }}
              />
            )}
          </Box>
        </Stack>
      </Box>

      {/* True Shooting Sparkline */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="column" spacing={0.5}>
            <Typography sx={{ color: '#FFFFFF', fontWeight: 500, fontSize: '0.875rem' }}>
              True Shooting %
            </Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, color: primaryColor }}>
              {`${currentTS.toFixed(1)}%`}
            </Typography>
          </Stack>
          <Box sx={{ width: 120, height: 40, overflow: 'hidden' }}>
            {gameData.length > 0 && (
              <SparkLineChart
                data={gameData.map((g) => g.ts)}
                height={40}
                width={120}
                color={primaryColor}
                margin={{ top: 5, bottom: 5, left: 4, right: 0 }}
                sx={{
                  [`& .${lineElementClasses.root}`]: {
                    strokeWidth: 2,
                  },
                }}
              />
            )}
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}

