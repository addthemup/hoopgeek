import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Divider,
} from '@mui/joy';
import {
  TrendingUp,
  TrendingDown,
  Remove,
} from '@mui/icons-material';
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';

interface NBAGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  awayTeam: {
    id: number;
    name: string;
    city: string;
    abbreviation: string;
    points: number;
    wins: number;
    losses: number;
  };
  homeTeam: {
    id: number;
    name: string;
    city: string;
    abbreviation: string;
    points: number;
    wins: number;
    losses: number;
  };
}

interface OddsData {
  gameId: string;
  markets: Array<{
    name: string;
    books: Array<{
      name: string;
      outcomes: Array<{
        type: string;
        odds: number;
        opening_odds: number;
        odds_trend: string;
        spread?: number;
        opening_spread?: number;
      }>;
    }>;
  }>;
}

interface GameScoreCardProps {
  game: NBAGame;
  odds?: OddsData;
}

export default function GameScoreCard({ game, odds }: GameScoreCardProps) {
  const isFinal = game.gameStatus === 3;
  const isLive = game.gameStatus === 2;
  
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp sx={{ fontSize: '1rem', color: '#16A34A' }} />;
      case 'down':
        return <TrendingDown sx={{ fontSize: '1rem', color: '#DC2626' }} />;
      default:
        return <Remove sx={{ fontSize: '1rem', color: '#666' }} />;
    }
  };

  const formatOdds = (odds: number): string => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const twoWayMarket = odds?.markets.find((m: any) => m.name === '2way');
  const spreadMarket = odds?.markets.find((m: any) => m.name === 'spread');

  return (
    <Card 
      variant="outlined"
      sx={{ 
        width: '100%',
        maxWidth: '100%',
        borderRadius: 0,
        border: { xs: 'none', md: '3px solid' },
        borderColor: 'divider',
        boxShadow: { xs: 'none', md: '3px 3px 0px #000' },
        overflow: 'visible',
        mx: 0,
        boxSizing: 'border-box',
        bgcolor: '#fff',
        p: { xs: 2, md: 2 },
      }}
    >
      <CardContent sx={{ p: 0 }}>
        {/* Game Status Badge */}
        <Box sx={{ mb: 2 }}>
          <Chip 
            size="md"
            sx={{ 
              bgcolor: isLive ? '#ef4444' : isFinal ? '#000' : '#666',
              color: '#fff',
              borderRadius: 0,
              fontFamily: 'serif',
              fontWeight: 900,
              fontSize: '0.75rem',
              px: 1.5,
            }}
          >
            {isLive ? '🔴 LIVE' : isFinal ? 'FINAL' : game.gameStatusText}
          </Chip>
        </Box>

        <Stack spacing={2.5}>
          {/* Away Team */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
                <Box
                  component="img"
                  src={getTeamLogoUrl(game.awayTeam.abbreviation)}
                  alt={game.awayTeam.abbreviation}
                  sx={{
                    width: { xs: 48, md: 56 },
                    height: { xs: 48, md: 56 },
                    objectFit: 'contain',
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: { xs: '1.25rem', md: '1.5rem' },
                    color: getTeamPrimaryColor(game.awayTeam.abbreviation)
                  }}>
                    {game.awayTeam.abbreviation}
                  </Typography>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '0.85rem',
                    color: '#666',
                  }}>
                    {game.awayTeam.city} {game.awayTeam.name}
                  </Typography>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '0.75rem',
                    color: '#999',
                    fontWeight: 600
                  }}>
                    ({game.awayTeam.wins || 0}-{game.awayTeam.losses || 0})
                  </Typography>
                </Box>
              </Stack>
              <Typography sx={{ 
                fontFamily: 'serif',
                fontWeight: 900,
                fontSize: { xs: '2rem', md: '2.5rem' }
              }}>
                {game.awayTeam.points || '-'}
              </Typography>
            </Stack>
          </Box>
          
          <Divider sx={{ borderColor: '#000', borderWidth: 2 }} />
          
          {/* Home Team */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
                <Box
                  component="img"
                  src={getTeamLogoUrl(game.homeTeam.abbreviation)}
                  alt={game.homeTeam.abbreviation}
                  sx={{
                    width: { xs: 48, md: 56 },
                    height: { xs: 48, md: 56 },
                    objectFit: 'contain',
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: { xs: '1.25rem', md: '1.5rem' },
                    color: getTeamPrimaryColor(game.homeTeam.abbreviation)
                  }}>
                    {game.homeTeam.abbreviation}
                  </Typography>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '0.85rem',
                    color: '#666',
                  }}>
                    {game.homeTeam.city} {game.homeTeam.name}
                  </Typography>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '0.75rem',
                    color: '#999',
                    fontWeight: 600
                  }}>
                    ({game.homeTeam.wins || 0}-{game.homeTeam.losses || 0})
                  </Typography>
                </Box>
              </Stack>
              <Typography sx={{ 
                fontFamily: 'serif',
                fontWeight: 900,
                fontSize: { xs: '2rem', md: '2.5rem' }
              }}>
                {game.homeTeam.points || '-'}
              </Typography>
            </Stack>
          </Box>

          {/* Betting Odds */}
          {odds && (twoWayMarket || spreadMarket) && (
            <Box
              sx={{
                mt: 2,
                pt: 2,
                borderTop: '2px solid #000',
              }}
            >
              <Typography sx={{ 
                fontFamily: 'serif',
                fontSize: '0.9rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                mb: 1.5,
              }}>
                Betting Lines
              </Typography>
              
              <Stack spacing={2}>
                {/* Moneyline */}
                {twoWayMarket && twoWayMarket.books[0] && (
                  <Box>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      mb: 1,
                      color: '#666'
                    }}>
                      MONEYLINE
                    </Typography>
                    <Stack spacing={0.75}>
                      {twoWayMarket.books[0].outcomes.map((outcome: any) => {
                        const isHome = outcome.type === 'home';
                        const teamName = isHome 
                          ? game.homeTeam.abbreviation
                          : game.awayTeam.abbreviation;
                        return (
                          <Box key={outcome.type}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography sx={{ 
                                fontFamily: 'serif',
                                fontSize: '0.85rem',
                                fontWeight: 700
                              }}>
                                {teamName}
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography sx={{ 
                                  fontFamily: 'serif',
                                  fontSize: '1rem',
                                  fontWeight: 900
                                }}>
                                  {formatOdds(outcome.odds)}
                                </Typography>
                                {getTrendIcon(outcome.odds_trend)}
                              </Stack>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
                
                {/* Spread */}
                {spreadMarket && spreadMarket.books[0] && (
                  <Box>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      mb: 1,
                      color: '#666'
                    }}>
                      SPREAD
                    </Typography>
                    <Stack spacing={0.75}>
                      {spreadMarket.books[0].outcomes.map((outcome: any) => {
                        const isHome = outcome.type === 'home';
                        const teamName = isHome 
                          ? game.homeTeam.abbreviation
                          : game.awayTeam.abbreviation;
                        return (
                          <Box key={outcome.type}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography sx={{ 
                                fontFamily: 'serif',
                                fontSize: '0.85rem',
                                fontWeight: 700
                              }}>
                                {teamName} {outcome.spread > 0 ? '+' : ''}{outcome.spread}
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography sx={{ 
                                  fontFamily: 'serif',
                                  fontSize: '1rem',
                                  fontWeight: 900
                                }}>
                                  {formatOdds(outcome.odds)}
                                </Typography>
                                {getTrendIcon(outcome.odds_trend)}
                              </Stack>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
                
                {twoWayMarket && twoWayMarket.books[0] && (
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '0.65rem',
                    color: '#999',
                    fontStyle: 'italic',
                    textAlign: 'right'
                  }}>
                    via {twoWayMarket.books[0].name}
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

