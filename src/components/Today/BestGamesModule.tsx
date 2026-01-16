import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  CircularProgress,
  Avatar,
} from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { supabase } from '../../utils/supabase';
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';

interface BestGamesModuleProps {
  weekStartDate: string;
  weekEndDate: string;
  navigate: (path: string) => void;
}

interface GameWithFunScore {
  game: any;
  funScorePost: any;
  funScore: number;
}

export default function BestGamesModule({
  weekStartDate,
  weekEndDate,
  navigate,
}: BestGamesModuleProps) {
  // Fetch games for the week
  const { data: weekGames, isLoading: gamesLoading } = useQuery({
    queryKey: ['best-games-week', weekStartDate, weekEndDate],
    queryFn: async () => {
      const { data: games, error } = await supabase
        .from('nba_games')
        .select('*')
        .gte('game_date', weekStartDate)
        .lte('game_date', weekEndDate)
        .order('game_date', { ascending: true });

      if (error) {
        console.error('Error fetching week games:', error);
        return [];
      }

      return games || [];
    },
  });

  // Fetch fun_score posts for games in this week
  const { data: funScorePosts, isLoading: postsLoading } = useQuery({
    queryKey: ['fun-score-posts-week', weekStartDate, weekEndDate],
    queryFn: async () => {
      if (!weekGames || weekGames.length === 0) return [];

      const gameIds = weekGames.map((g: any) => g.game_id);

      const { data: posts, error } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('status', 'published')
        .eq('post_type', 'fun_score')
        .in('game_id', gameIds);

      if (error) {
        console.error('Error fetching fun_score posts:', error);
        return [];
      }

      return posts || [];
    },
    enabled: !!weekGames && weekGames.length > 0,
  });

  // Match games with fun_score posts and extract scores
  const gamesWithScores: GameWithFunScore[] = useMemo(() => {
    if (!weekGames || !funScorePosts) return [];

    return weekGames
      .map((game: any) => {
        const funScorePost = funScorePosts.find(
          (post: any) => post.game_id === game.game_id
        );

        if (!funScorePost) return null;

        // Extract fun score from title (e.g., "Fun Score: 88.4" -> 8.7)
        const title = funScorePost.title || '';
        const scoreMatch = title.match(/Fun Score:\s*([\d.]+)/);
        const funScore = scoreMatch ? parseFloat(scoreMatch[1]) / 10 : 0;

        return {
          game,
          funScorePost,
          funScore,
        };
      })
      .filter((item): item is GameWithFunScore => item !== null)
      .sort((a, b) => b.funScore - a.funScore)
      .slice(0, 10); // Top 10 games
  }, [weekGames, funScorePosts]);

  const isLoading = gamesLoading || postsLoading;

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress size="lg" />
      </Box>
    );
  }

  if (gamesWithScores.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="body-md" sx={{ color: '#B0B0B0' }}>
          No games with fun scores available for this week
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography level="h3" sx={{ color: '#FFC72C', fontWeight: 'bold', mb: 0.5 }}>
          🏀 Best Games
        </Typography>
        <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
          Top {gamesWithScores.length} games ranked by Fun Score
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {gamesWithScores.map(({ game, funScore }) => {
          const awayTeamColor = getTeamPrimaryColor(game.away_team_tricode);
          const homeTeamColor = getTeamPrimaryColor(game.home_team_tricode);

          return (
            <Grid key={game.game_id} xs={12} sm={6} md={4}>
              <Card
                variant="outlined"
                sx={{
                  bgcolor: '#0a0a0a',
                  borderColor: '#333333',
                  cursor: 'pointer',
                  height: '100%',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: '#FFC72C',
                    transform: 'translateY(-2px)',
                  },
                }}
                onClick={() => navigate(`/game/${game.game_id}`)}
              >
                <CardContent sx={{ p: 2 }}>
                  {/* Fun Score Badge */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Chip
                      size="lg"
                      variant="soft"
                      color="primary"
                      sx={{
                        bgcolor: '#FFC72C',
                        color: '#000000',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                      }}
                    >
                      {funScore.toFixed(1)}
                    </Chip>
                    <Typography level="body-xs" sx={{ color: '#666666' }}>
                      {dayjs(game.game_date).format('MMM D')}
                    </Typography>
                  </Box>

                  {/* Teams with Scores */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {/* Away Team */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          src={getTeamLogoUrl(game.away_team_tricode)}
                          alt={game.away_team_tricode}
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: awayTeamColor,
                          }}
                        >
                          {game.away_team_tricode.charAt(0)}
                        </Avatar>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 500 }}>
                          {game.away_team_tricode}
                        </Typography>
                      </Box>
                      {game.away_team_score !== null && game.away_team_score !== undefined && (
                        <Typography
                          level="title-md"
                          sx={{
                            color: '#FFC72C',
                            fontWeight: 900,
                            fontSize: '1rem',
                          }}
                        >
                          {game.away_team_score}
                        </Typography>
                      )}
                    </Box>

                    {/* VS */}
                    <Box sx={{ textAlign: 'center', my: 0.5 }}>
                      <Typography level="body-xs" sx={{ color: '#666666' }}>
                        @
                      </Typography>
                    </Box>

                    {/* Home Team */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          src={getTeamLogoUrl(game.home_team_tricode)}
                          alt={game.home_team_tricode}
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: homeTeamColor,
                          }}
                        >
                          {game.home_team_tricode.charAt(0)}
                        </Avatar>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 500 }}>
                          {game.home_team_tricode}
                        </Typography>
                      </Box>
                      {game.home_team_score !== null && game.home_team_score !== undefined && (
                        <Typography
                          level="title-md"
                          sx={{
                            color: '#FFC72C',
                            fontWeight: 900,
                            fontSize: '1rem',
                          }}
                        >
                          {game.home_team_score}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Game Status/Time */}
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #333333' }}>
                    {game.game_status_text ? (
                      <Typography level="body-xs" sx={{ color: '#B0B0B0', textAlign: 'center' }}>
                        {game.game_status_text}
                      </Typography>
                    ) : game.game_time_et ? (
                      <Typography level="body-xs" sx={{ color: '#B0B0B0', textAlign: 'center' }}>
                        {game.game_time_et}
                      </Typography>
                    ) : null}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
