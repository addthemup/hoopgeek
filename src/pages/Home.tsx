import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Divider,
  Sheet,
} from '@mui/joy';
import {
  TrendingUp,
  TrendingDown,
  Remove,
  SportsBasketball,
} from '@mui/icons-material';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import { useBettingOdds, formatOdds } from '../hooks/useBettingOdds';
import { NBA_TEAM_COLORS } from '../utils/nbaTeamColors';
import PlayersOfTheNight from '../components/PlayersOfTheNight';

export default function Home() {
  const { data: nbaScoreboard, isLoading: scoreboardLoading } = useNBAScoreboard();
  const { data: bettingOdds, isLoading: oddsLoading } = useBettingOdds();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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

  const getTeamColor = (tricode: string) => {
    const colors = NBA_TEAM_COLORS[tricode];
    return colors?.primary || '#000';
  };

  return (
    <Box sx={{ 
      bgcolor: '#F5F1E8',
      minHeight: '100vh',
      py: 4
    }}>
      <Box sx={{ 
        maxWidth: '1400px', 
        mx: 'auto',
        px: 3
      }}>
        {/* Simple Header */}
        <Sheet sx={{ 
          bgcolor: 'transparent',
          borderBottom: '6px double #000',
          pb: 2,
          mb: 4
        }}>
          <Stack spacing={1} alignItems="center">
            <Typography 
              sx={{ 
                fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
                fontFamily: 'serif',
                fontWeight: 900,
                letterSpacing: '-0.01em',
                color: '#000',
                lineHeight: 1
              }}
            >
              🏀 HOOPGEEK
            </Typography>
            <Typography sx={{ 
              fontFamily: 'serif',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.15em'
            }}>
              {today}
            </Typography>
          </Stack>
        </Sheet>

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Today's Games with Scores */}
          <Grid xs={12} md={8}>
            <Typography sx={{ 
              fontFamily: 'serif',
              fontSize: '2rem',
              fontWeight: 900,
              mb: 3,
              pb: 1,
              borderBottom: '4px double #000',
              textTransform: 'uppercase'
            }}>
              Today's Games
            </Typography>
            
            {scoreboardLoading ? (
              <Typography sx={{ fontFamily: 'serif', color: '#666', textAlign: 'center', py: 4 }}>
                Loading games...
              </Typography>
            ) : nbaScoreboard && nbaScoreboard.games.length > 0 ? (
              <Stack spacing={2}>
                {nbaScoreboard.games.map((game: any) => (
                  <Card 
                    key={game.gameId}
                    variant="outlined"
                    sx={{ 
                      bgcolor: '#fff',
                      border: '3px solid #000',
                      borderRadius: 0,
                      boxShadow: '3px 3px 0px #000'
                    }}
                  >
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid xs={12} sm={6}>
                          <Stack spacing={2}>
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <Typography sx={{ 
                                    fontFamily: 'serif',
                                    fontWeight: 900,
                                    fontSize: '1.5rem',
                                    color: getTeamColor(game.awayTeam.abbreviation || game.awayTeam.teamTricode)
                                  }}>
                                    {game.awayTeam.abbreviation || game.awayTeam.teamTricode}
                                  </Typography>
                                  <Typography sx={{ 
                                    fontFamily: 'serif',
                                    fontSize: '0.85rem',
                                    color: '#666',
                                    fontWeight: 600
                                  }}>
                                    ({game.awayTeam.wins || 0}-{game.awayTeam.losses || 0})
                                  </Typography>
                                </Stack>
                                <Typography sx={{ 
                                  fontFamily: 'serif',
                                  fontWeight: 900,
                                  fontSize: '2rem'
                                }}>
                                  {game.awayTeam.points || game.awayTeam.score || '-'}
                                </Typography>
                              </Stack>
                              <Typography sx={{ 
                                fontFamily: 'serif',
                                fontSize: '0.85rem',
                                color: '#666',
                                mt: 0.5
                              }}>
                                {game.awayTeam.city} {game.awayTeam.name}
                              </Typography>
                            </Box>
                            
                            <Divider sx={{ borderColor: '#000' }} />
                            
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <Typography sx={{ 
                                    fontFamily: 'serif',
                                    fontWeight: 900,
                                    fontSize: '1.5rem',
                                    color: getTeamColor(game.homeTeam.abbreviation || game.homeTeam.teamTricode)
                                  }}>
                                    {game.homeTeam.abbreviation || game.homeTeam.teamTricode}
                                  </Typography>
                                  <Typography sx={{ 
                                    fontFamily: 'serif',
                                    fontSize: '0.85rem',
                                    color: '#666',
                                    fontWeight: 600
                                  }}>
                                    ({game.homeTeam.wins || 0}-{game.homeTeam.losses || 0})
                                  </Typography>
                                </Stack>
                                <Typography sx={{ 
                                  fontFamily: 'serif',
                                  fontWeight: 900,
                                  fontSize: '2rem'
                                }}>
                                  {game.homeTeam.points || game.homeTeam.score || '-'}
                                </Typography>
                              </Stack>
                              <Typography sx={{ 
                                fontFamily: 'serif',
                                fontSize: '0.85rem',
                                color: '#666',
                                mt: 0.5
                              }}>
                                {game.homeTeam.city} {game.homeTeam.name}
                              </Typography>
                            </Box>
                            
                            <Chip 
                              size="sm"
                              sx={{ 
                                bgcolor: '#000',
                                color: '#fff',
                                borderRadius: 0,
                                fontFamily: 'serif',
                                fontWeight: 700,
                                fontSize: '0.7rem'
                              }}
                            >
                              {game.gameStatusText}
                            </Chip>
                          </Stack>
                        </Grid>
                        
                        {/* Betting Odds Section */}
                        <Grid xs={12} sm={6}>
                          {bettingOdds && !oddsLoading && (() => {
                            const bettingGame = bettingOdds.games.find(
                              (bg: any) => bg.gameId === game.gameId
                            );
                            
                            if (!bettingGame) return (
                              <Typography sx={{ 
                                fontFamily: 'serif',
                                fontSize: '0.8rem',
                                color: '#999',
                                fontStyle: 'italic'
                              }}>
                                No odds available
                              </Typography>
                            );
                            
                            const twoWayMarket = bettingGame.markets.find((m: any) => m.name === '2way');
                            const spreadMarket = bettingGame.markets.find((m: any) => m.name === 'spread');
                            
                            return (
                              <Stack spacing={2}>
                                {/* Moneyline (2-way) Odds */}
                                {twoWayMarket && twoWayMarket.books[0] && (
                                  <Box>
                                    <Typography sx={{ 
                                      fontFamily: 'serif',
                                      fontSize: '0.9rem',
                                      fontWeight: 900,
                                      textTransform: 'uppercase',
                                      mb: 1,
                                      borderBottom: '2px solid #000',
                                      pb: 0.5
                                    }}>
                                      Moneyline
                                    </Typography>
                                    <Stack spacing={1}>
                                      {twoWayMarket.books[0].outcomes.map((outcome: any) => {
                                        const isHome = outcome.type === 'home';
                                        const teamName = isHome 
                                          ? (game.homeTeam.abbreviation || game.homeTeam.teamTricode) 
                                          : (game.awayTeam.abbreviation || game.awayTeam.teamTricode);
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
                                            <Typography sx={{ 
                                              fontFamily: 'serif',
                                              fontSize: '0.7rem',
                                              color: '#666'
                                            }}>
                                              Open: {formatOdds(outcome.opening_odds)}
                                            </Typography>
                                          </Box>
                                        );
                                      })}
                                    </Stack>
                                  </Box>
                                )}
                                
                                {/* Spread Odds */}
                                {spreadMarket && spreadMarket.books[0] && (
                                  <Box>
                                    <Typography sx={{ 
                                      fontFamily: 'serif',
                                      fontSize: '0.9rem',
                                      fontWeight: 900,
                                      textTransform: 'uppercase',
                                      mb: 1,
                                      borderBottom: '2px solid #000',
                                      pb: 0.5
                                    }}>
                                      Spread
                                    </Typography>
                                    <Stack spacing={1}>
                                      {spreadMarket.books[0].outcomes.map((outcome: any) => {
                                        const isHome = outcome.type === 'home';
                                        const teamName = isHome 
                                          ? (game.homeTeam.abbreviation || game.homeTeam.teamTricode)
                                          : (game.awayTeam.abbreviation || game.awayTeam.teamTricode);
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
                                            <Typography sx={{ 
                                              fontFamily: 'serif',
                                              fontSize: '0.7rem',
                                              color: '#666'
                                            }}>
                                              Open: {outcome.opening_spread > 0 ? '+' : ''}{outcome.opening_spread} ({formatOdds(outcome.opening_odds)})
                                            </Typography>
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
                            );
                          })()}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Card 
                variant="outlined"
                sx={{ 
                  bgcolor: '#fff',
                  border: '3px solid #000',
                  borderRadius: 0
                }}
              >
                <CardContent>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '1.2rem',
                    color: '#666',
                    textAlign: 'center',
                    py: 6
                  }}>
                    No games scheduled today
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Sidebar */}
          <Grid xs={12} md={4}>
            {/* Quick Stats Box */}
            <Card 
              variant="outlined"
              sx={{ 
                mb: 3,
                bgcolor: '#000',
                color: '#fff',
                border: '3px solid #000',
                borderRadius: 0,
                boxShadow: '3px 3px 0px #000'
              }}
            >
              <CardContent>
                <Stack spacing={2} alignItems="center">
                  <SportsBasketball sx={{ fontSize: '3rem' }} />
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '1.3rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    letterSpacing: '0.1em'
                  }}>
                    Live NBA Data
                  </Typography>
                  <Divider sx={{ width: '100%', bgcolor: '#fff' }} />
                  <Stack spacing={1} sx={{ width: '100%' }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontFamily: 'serif', fontSize: '0.9rem' }}>
                        Games Today
                      </Typography>
                      <Typography sx={{ fontFamily: 'serif', fontSize: '0.9rem', fontWeight: 900 }}>
                        {nbaScoreboard?.games.length || 0}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontFamily: 'serif', fontSize: '0.9rem' }}>
                        Odds Available
                      </Typography>
                      <Typography sx={{ fontFamily: 'serif', fontSize: '0.9rem', fontWeight: 900 }}>
                        {bettingOdds?.games.length || 0}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '0.7rem',
                    color: '#FFD700',
                    textAlign: 'center',
                    fontStyle: 'italic'
                  }}>
                    Updated every 60 seconds
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            {/* Players of the Night */}
            <Box sx={{ mb: 3 }}>
              <PlayersOfTheNight />
            </Box>

            {/* Game Highlights Section */}
            <Card 
              variant="outlined"
              sx={{ 
                bgcolor: '#fff',
                border: '3px solid #000',
                borderRadius: 0
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ 
                  bgcolor: '#000', 
                  color: '#fff', 
                  p: 2
                }}>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '1.2rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    Legend
                  </Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <TrendingUp sx={{ fontSize: '1rem', color: '#16A34A' }} />
                        <Typography sx={{ 
                          fontFamily: 'serif',
                          fontSize: '0.85rem',
                          fontWeight: 700
                        }}>
                          Odds Moving Up
                        </Typography>
                      </Stack>
                      <Typography sx={{ 
                        fontFamily: 'serif',
                        fontSize: '0.75rem',
                        color: '#666',
                        pl: 3
                      }}>
                        Line is getting better for this team
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <TrendingDown sx={{ fontSize: '1rem', color: '#DC2626' }} />
                        <Typography sx={{ 
                          fontFamily: 'serif',
                          fontSize: '0.85rem',
                          fontWeight: 700
                        }}>
                          Odds Moving Down
                        </Typography>
                      </Stack>
                      <Typography sx={{ 
                        fontFamily: 'serif',
                        fontSize: '0.75rem',
                        color: '#666',
                        pl: 3
                      }}>
                        Line is getting worse for this team
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Remove sx={{ fontSize: '1rem', color: '#666' }} />
                        <Typography sx={{ 
                          fontFamily: 'serif',
                          fontSize: '0.85rem',
                          fontWeight: 700
                        }}>
                          No Movement
                        </Typography>
                      </Stack>
                      <Typography sx={{ 
                        fontFamily: 'serif',
                        fontSize: '0.75rem',
                        color: '#666',
                        pl: 3
                      }}>
                        Odds unchanged since opening
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
