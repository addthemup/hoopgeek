import { Box } from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';

interface SlateGame {
  game_id: string;
  game_status: number;
  game_status_text: string;
  home_team_abbr: string;
  away_team_abbr: string;
  home_team_score?: number;
  away_team_score?: number;
}

interface SlateGamesRowProps {
  poolId: string;
}

export default function SlateGamesRow({ poolId }: SlateGamesRowProps) {
  const { data: games, isLoading } = useQuery<SlateGame[]>({
    queryKey: ['dfs-pool-slate-games', poolId],
    queryFn: async () => {
      if (!poolId) return [];

      // Fetch pool games and join with nba_games for full game data
      const { data: poolGames, error: poolGamesError } = await supabase
        .from('dfs_pool_games')
        .select('game_id, away_team, home_team')
        .eq('pool_id', poolId)
        .eq('is_included', true);

      if (poolGamesError) throw poolGamesError;
      if (!poolGames || poolGames.length === 0) return [];

      const gameIds = poolGames.map(pg => pg.game_id);

      // Fetch full game data from nba_games
      const { data: nbaGames, error: nbaGamesError } = await supabase
        .from('nba_games')
        .select('game_id, game_status, game_status_text, home_team_abbr, away_team_abbr, home_team_score, away_team_score')
        .in('game_id', gameIds)
        .order('game_date_est', { ascending: true });

      if (nbaGamesError) throw nbaGamesError;

      return (nbaGames || []).map(game => ({
        game_id: game.game_id,
        game_status: game.game_status || 1,
        game_status_text: game.game_status_text || 'Scheduled',
        home_team_abbr: game.home_team_abbr,
        away_team_abbr: game.away_team_abbr,
        home_team_score: game.home_team_score,
        away_team_score: game.away_team_score,
      }));
    },
    enabled: !!poolId,
  });

  // Don't show loading skeleton - just return null while loading
  if (isLoading) {
    return null;
  }

  if (!games || games.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          overflowY: 'hidden',
          pb: 0,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        }}
      >
        {games.map((game) => {
          const isFinal = game.game_status === 3;
          const isLive = game.game_status === 2;

          return (
            <Box
              key={game.game_id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 'fit-content',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  width: 83,
                  height: 83,
                  border: isFinal
                    ? '3px dashed'
                    : isLive
                      ? '3px solid #FFC72C'
                      : '3px solid',
                  borderColor: isFinal
                    ? 'text.primary'
                    : isLive
                      ? '#FFC72C'
                      : 'text.primary',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  bgcolor: 'background.level1',
                  position: 'relative',
                  transition: 'all 0.2s',
                }}
              >
                {/* Split background with team colors */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '50%',
                    height: '100%',
                    bgcolor: getTeamPrimaryColor(game.away_team_abbr),
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '50%',
                    height: '100%',
                    bgcolor: getTeamPrimaryColor(game.home_team_abbr),
                  }}
                />

                {/* Away team logo */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '50%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                  }}
                >
                  <Box
                    component="img"
                    src={getTeamLogoUrl(game.away_team_abbr)}
                    alt={game.away_team_abbr}
                    sx={{
                      width: 32,
                      height: 32,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </Box>

                {/* Home team logo */}
                <Box
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '50%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                  }}
                >
                  <Box
                    component="img"
                    src={getTeamLogoUrl(game.home_team_abbr)}
                    alt={game.home_team_abbr}
                    sx={{
                      width: 32,
                      height: 32,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </Box>

                {/* Vertical divider line */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: '50%',
                    top: '10%',
                    bottom: '30%',
                    width: '1px',
                    bgcolor: 'rgba(0, 0, 0, 0.3)',
                    transform: 'translateX(-50%)',
                    zIndex: 1,
                  }}
                />

                {/* Score Badge at bottom */}
                {(isFinal || isLive) && game.away_team_score !== undefined && game.home_team_score !== undefined && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: '8%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bgcolor: isLive ? '#ef4444' : '#FFC72C',
                      color: '#000',
                      px: 1,
                      py: 0.25,
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      fontFamily: '"Libre Baskerville", Georgia, serif',
                      border: '2px solid',
                      borderColor: 'background.body',
                      zIndex: 2,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {game.away_team_score}-{game.home_team_score}
                  </Box>
                )}

                {/* Status text at top of circle */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '8%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: isLive ? '#ef4444' : isFinal ? '#000' : 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: '4px',
                    fontSize: '0.5rem',
                    fontWeight: 'bold',
                    fontFamily: '"Libre Baskerville", Georgia, serif',
                    lineHeight: 1,
                    zIndex: 2,
                    whiteSpace: 'nowrap',
                    maxWidth: '90%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {isLive ? 'LIVE' : isFinal ? 'FINAL' : game.game_status_text}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

