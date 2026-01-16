import { Box, Typography, Sheet, Table } from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { getTeamColors } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { FANDUEL_SCORING } from '../utils/fantasyScoring';
import { hexToRgba } from './MarginBars';

interface LiveGameBoxScoreProps {
  gameId: string;
}

interface GameData {
  game_id: string;
  game_status: number;
  game_status_text: string;
  home_team_tricode: string;
  away_team_tricode: string;
  home_team_score: number;
  away_team_score: number;
  game_date: string;
  arena_name?: string;
  arena_city?: string;
}

interface PlayerStat {
  nba_player_id: number;
  player_name: string;
  team_tricode: string;
  stats: {
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
    tov?: number;
    fgm?: number;
    fga?: number;
    fg3m?: number;
    fg3a?: number;
    ftm?: number;
    fta?: number;
    min?: number;
    plus_minus?: number;
  };
  fantasy_points?: number;
}

export default function LiveGameBoxScore({ gameId }: LiveGameBoxScoreProps) {
  // Fetch game data
  const { data: gameData, isLoading: gameLoading } = useQuery<GameData>({
    queryKey: ['game-data', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_games')
        .select('game_id, game_status, game_status_text, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_date, arena_name, arena_city')
        .eq('game_id', gameId)
        .single();
      
      if (error) {
        console.error('Error fetching game data:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!gameId,
  });

  // Fetch live player stats
  const { data: liveStats, isLoading: statsLoading } = useQuery<PlayerStat[]>({
    queryKey: ['live-player-stats-boxscore', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_player_stats')
        .select('nba_player_id, player_name, team_tricode, stats')
        .eq('game_id', gameId)
        .order('team_tricode')
        .order('stats->min', { ascending: false, nullsFirst: false });
      
      if (error) {
        console.error('Error fetching live stats:', error);
        return [];
      }
      
      // Calculate fantasy points for each player
      return (data || []).map((player) => {
        const stats = player.stats || {};
        const fantasyPoints = FANDUEL_SCORING.calculatePoints({
          pts: stats.pts || 0,
          reb: stats.reb || 0,
          ast: stats.ast || 0,
          stl: stats.stl || 0,
          blk: stats.blk || 0,
          tov: stats.tov || 0,
          fgm: stats.fgm || 0,
          fga: stats.fga || 0,
          fg_pct: stats.fg_pct || 0,
          fg3m: stats.fg3m || 0,
          fg3a: stats.fg3a || 0,
          fg3_pct: stats.fg3_pct || 0,
          ftm: stats.ftm || 0,
          fta: stats.fta || 0,
          ft_pct: stats.ft_pct || 0,
          oreb: stats.oreb || 0,
          dreb: stats.dreb || 0,
          pf: stats.pf || 0,
          min: stats.min || 0,
          plus_minus: stats.plus_minus || 0,
        } as any);
        
        return {
          ...player,
          fantasy_points: fantasyPoints,
        };
      });
    },
    enabled: !!gameId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (gameLoading || statsLoading || !gameData) {
    return (
      <Box sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.5)', borderRadius: '8px' }}>
        <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center' }}>
          Loading box score...
        </Typography>
      </Box>
    );
  }

  const homeTeamStats = liveStats?.filter(p => p.team_tricode === gameData.home_team_tricode) || [];
  const awayTeamStats = liveStats?.filter(p => p.team_tricode === gameData.away_team_tricode) || [];
  
  const homeColors = getTeamColors(gameData.home_team_tricode);
  const awayColors = getTeamColors(gameData.away_team_tricode);

  // Calculate team totals
  const calculateTeamTotals = (players: PlayerStat[]) => {
    return players.reduce((acc, player) => {
      const stats = player.stats || {};
      return {
        pts: acc.pts + (stats.pts || 0),
        reb: acc.reb + (stats.reb || 0),
        ast: acc.ast + (stats.ast || 0),
        stl: acc.stl + (stats.stl || 0),
        blk: acc.blk + (stats.blk || 0),
        tov: acc.tov + (stats.tov || 0),
        fgm: acc.fgm + (stats.fgm || 0),
        fga: acc.fga + (stats.fga || 0),
        fg3m: acc.fg3m + (stats.fg3m || 0),
        fg3a: acc.fg3a + (stats.fg3a || 0),
        ftm: acc.ftm + (stats.ftm || 0),
        fta: acc.fta + (stats.fta || 0),
      };
    }, { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 });
  };

  const homeTotals = calculateTeamTotals(homeTeamStats);
  const awayTotals = calculateTeamTotals(awayTeamStats);

  return (
    <Sheet
      sx={{
        bgcolor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '8px',
        p: 2,
        border: '1px solid rgba(184, 134, 11, 0.3)',
      }}
    >
      {/* Game Header */}
      <Box sx={{ mb: 2, textAlign: 'center' }}>
        <Typography level="h3" sx={{ color: '#ffffff', mb: 1 }}>
          {gameData.away_team_tricode} @ {gameData.home_team_tricode}
        </Typography>
        <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {gameData.game_status_text} {gameData.arena_name && `• ${gameData.arena_name}`}
        </Typography>
      </Box>

      {/* Score Display */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 3 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            component="img"
            src={getTeamLogoUrl(gameData.away_team_tricode)}
            alt={gameData.away_team_tricode}
            sx={{ width: 60, height: 60, mb: 1 }}
          />
          <Typography level="h2" sx={{ color: hexToRgba(awayColors.primary, 0.9) }}>
            {gameData.away_team_score}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            component="img"
            src={getTeamLogoUrl(gameData.home_team_tricode)}
            alt={gameData.home_team_tricode}
            sx={{ width: 60, height: 60, mb: 1 }}
          />
          <Typography level="h2" sx={{ color: hexToRgba(homeColors.primary, 0.9) }}>
            {gameData.home_team_score}
          </Typography>
        </Box>
      </Box>

      {/* Box Score Table */}
      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ '& th, & td': { color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.1)' } }}>
          <thead>
            <tr>
              <th style={{ minWidth: '120px' }}>Player</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TOV</th>
              <th>FP</th>
            </tr>
          </thead>
          <tbody>
            {/* Away Team */}
            <tr>
              <td colSpan={9} style={{ 
                backgroundColor: hexToRgba(awayColors.primary, 0.2),
                fontWeight: 'bold',
                padding: '8px',
              }}>
                {gameData.away_team_tricode}
              </td>
            </tr>
            {awayTeamStats.map((player) => (
              <tr key={player.nba_player_id}>
                <td>{player.player_name}</td>
                <td>{player.stats?.min || 0}</td>
                <td>{player.stats?.pts || 0}</td>
                <td>{player.stats?.reb || 0}</td>
                <td>{player.stats?.ast || 0}</td>
                <td>{player.stats?.stl || 0}</td>
                <td>{player.stats?.blk || 0}</td>
                <td>{player.stats?.tov || 0}</td>
                <td>{player.fantasy_points?.toFixed(1) || '0.0'}</td>
              </tr>
            ))}
            <tr style={{ backgroundColor: hexToRgba(awayColors.primary, 0.1), fontWeight: 'bold' }}>
              <td>TOTALS</td>
              <td>—</td>
              <td>{awayTotals.pts}</td>
              <td>{awayTotals.reb}</td>
              <td>{awayTotals.ast}</td>
              <td>{awayTotals.stl}</td>
              <td>{awayTotals.blk}</td>
              <td>{awayTotals.tov}</td>
              <td>{awayTeamStats.reduce((sum, p) => sum + (p.fantasy_points || 0), 0).toFixed(1)}</td>
            </tr>
            
            {/* Home Team */}
            <tr>
              <td colSpan={9} style={{ 
                backgroundColor: hexToRgba(homeColors.primary, 0.2),
                fontWeight: 'bold',
                padding: '8px',
                marginTop: '16px',
              }}>
                {gameData.home_team_tricode}
              </td>
            </tr>
            {homeTeamStats.map((player) => (
              <tr key={player.nba_player_id}>
                <td>{player.player_name}</td>
                <td>{player.stats?.min || 0}</td>
                <td>{player.stats?.pts || 0}</td>
                <td>{player.stats?.reb || 0}</td>
                <td>{player.stats?.ast || 0}</td>
                <td>{player.stats?.stl || 0}</td>
                <td>{player.stats?.blk || 0}</td>
                <td>{player.stats?.tov || 0}</td>
                <td>{player.fantasy_points?.toFixed(1) || '0.0'}</td>
              </tr>
            ))}
            <tr style={{ backgroundColor: hexToRgba(homeColors.primary, 0.1), fontWeight: 'bold' }}>
              <td>TOTALS</td>
              <td>—</td>
              <td>{homeTotals.pts}</td>
              <td>{homeTotals.reb}</td>
              <td>{homeTotals.ast}</td>
              <td>{homeTotals.stl}</td>
              <td>{homeTotals.blk}</td>
              <td>{homeTotals.tov}</td>
              <td>{homeTeamStats.reduce((sum, p) => sum + (p.fantasy_points || 0), 0).toFixed(1)}</td>
            </tr>
          </tbody>
        </Table>
      </Box>
    </Sheet>
  );
}

