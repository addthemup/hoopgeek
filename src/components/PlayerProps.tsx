import { Box, Typography, Card, CardContent, Chip, Stack, Alert } from '@mui/joy';
import { GameWithProps, PlayerProp } from '../utils/sportsGameOdds';

interface PlayerPropsProps {
  game: GameWithProps;
  playerName: string;
  teamTricode?: string | null;
  compact?: boolean; // For inline displays
}

export default function PlayerProps({ game, playerName, teamTricode, compact = false }: PlayerPropsProps) {
  if (!game.playerProps || game.playerProps.length === 0) {
    if (compact) return null;
    
    return (
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', mb: 3 }}>
        <CardContent>
          <Typography level="h4" sx={{ mb: 2, fontWeight: 'bold', color: '#FFFFFF' }}>
            Today's Game Props
          </Typography>
          <Alert color="warning" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              Player props not yet available for {playerName}'s game today
            </Typography>
          </Alert>
          <Box sx={{ mt: 2 }}>
            <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
              {game.awayTeam} @ {game.homeTeam}
            </Typography>
            {game.startsAt && (
              <Typography level="body-xs" sx={{ color: '#888888', mt: 0.5 }}>
                {new Date(game.startsAt).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Filter to only show game-level props (not quarter/half props)
  // Group props by bet type
  const propsByType: Record<string, typeof game.playerProps> = {};
  game.playerProps.forEach(prop => {
    // Only include game-level props (period === 'game' or undefined)
    const period = (prop as any).period || 'game';
    if (period !== 'game' && period !== 'reg') {
      return; // Skip quarter/half props
    }
    
    if (!propsByType[prop.betType]) {
      propsByType[prop.betType] = [];
    }
    propsByType[prop.betType].push(prop);
  });

  // Format odds display
  const formatOdds = (price?: string): string => {
    if (!price) return 'N/A';
    
    // Check if it's already in American odds format (starts with + or -)
    const trimmed = price.trim();
    if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
      // Already in American odds format, return as-is
      return trimmed;
    }
    
    // Try to parse as decimal and convert to American odds
    const decimal = parseFloat(price);
    if (isNaN(decimal)) return price;
    
    // Convert decimal to American odds
    if (decimal >= 2.0) {
      return `+${Math.round((decimal - 1) * 100)}`;
    } else if (decimal > 1.0) {
      return `-${Math.round(100 / (decimal - 1))}`;
    } else {
      return price; // Invalid decimal, return original
    }
  };

  // Format bet type name
  const formatBetType = (betType: string): string => {
    // Map common bet types to readable names
    const betTypeMap: Record<string, string> = {
      'points': 'Points',
      'point': 'Points',
      'pts': 'Points',
      'rebounds': 'Rebounds',
      'rebound': 'Rebounds',
      'reb': 'Rebounds',
      'assists': 'Assists',
      'assist': 'Assists',
      'ast': 'Assists',
      'steals': 'Steals',
      'steal': 'Steals',
      'stl': 'Steals',
      'blocks': 'Blocks',
      'block': 'Blocks',
      'blk': 'Blocks',
      'threes': '3-Pointers Made',
      'three': '3-Pointers Made',
      '3pt': '3-Pointers Made',
      '3-pointer': '3-Pointers Made',
      '3pm': '3-Pointers Made',
    };
    
    const lower = betType.toLowerCase();
    if (betTypeMap[lower]) {
      return betTypeMap[lower];
    }
    
    // Fallback: format the bet type
    return betType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get best prop: ALWAYS take the one with the HIGHEST line value
  const getBestProp = (props: PlayerProp[]) => {
    if (props.length === 0) return null;
    
    // Filter to props with valid lines
    const withLine = props.filter(p => p.line !== undefined && p.line !== null);
    if (withLine.length === 0) return props[0];
    
    // Sort by line value (descending - highest first) and return the first one
    withLine.sort((a, b) => {
      const lineA = parseFloat(a.line?.toString() || '0');
      const lineB = parseFloat(b.line?.toString() || '0');
      return lineB - lineA; // Descending order - highest first
    });
    
    return withLine[0];
  };

  // Compact display for inline use
  if (compact) {
    const pointsProps = propsByType['points'] || propsByType['point'] || propsByType['pts'] || [];
    const reboundsProps = propsByType['rebounds'] || propsByType['rebound'] || propsByType['reb'] || [];
    const assistsProps = propsByType['assists'] || propsByType['assist'] || propsByType['ast'] || [];
    
    const pointsBest = getBestProp(pointsProps);
    const reboundsBest = getBestProp(reboundsProps);
    const assistsBest = getBestProp(assistsProps);
    
    if (!pointsBest && !reboundsBest && !assistsBest) return null;
    
    return (
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
          {pointsBest && (
            <Chip
              variant="soft"
              color="primary"
              size="sm"
              sx={{
                bgcolor: '#1a1a1a',
                border: '1px solid #333333',
              }}
            >
              <Typography level="body-xs" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                PTS {pointsBest.line !== undefined && pointsBest.line !== null ? pointsBest.line : ''} ({formatOdds(pointsBest.price || (pointsBest as any).americanOdds)})
              </Typography>
            </Chip>
          )}
          {reboundsBest && (
            <Chip
              variant="soft"
              color="success"
              size="sm"
              sx={{
                bgcolor: '#1a1a1a',
                border: '1px solid #333333',
              }}
            >
              <Typography level="body-xs" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                REB {reboundsBest.line !== undefined && reboundsBest.line !== null ? reboundsBest.line : ''} ({formatOdds(reboundsBest.price || (reboundsBest as any).americanOdds)})
              </Typography>
            </Chip>
          )}
          {assistsBest && (
            <Chip
              variant="soft"
              color="warning"
              size="sm"
              sx={{
                bgcolor: '#1a1a1a',
                border: '1px solid #333333',
              }}
            >
              <Typography level="body-xs" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                AST {assistsBest.line !== undefined && assistsBest.line !== null ? assistsBest.line : ''} ({formatOdds(assistsBest.price || (assistsBest as any).americanOdds)})
              </Typography>
            </Chip>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
            Today's Game Props
          </Typography>
          {game.startsAt && (
            <Typography level="body-xs" sx={{ color: '#888888' }}>
              {new Date(game.startsAt).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                timeZoneName: 'short'
              })}
            </Typography>
          )}
        </Box>
        
        {/* Game Info */}
        <Box sx={{ mb: 3, pb: 2, borderBottom: '1px solid #333333' }}>
          <Typography level="body-md" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 0.5 }}>
            {game.awayTeam} @ {game.homeTeam}
          </Typography>
        </Box>

        {/* Player Props - Grouped by type */}
        <Stack spacing={2.5}>
          {Object.entries(propsByType).map(([betType, props]) => {
            const bestProp = getBestProp(props);
            const isPrimary = ['points', 'point', 'pts', 'rebounds', 'rebound', 'reb', 'assists', 'assist', 'ast'].includes(betType.toLowerCase());
            
            return (
              <Box key={betType}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography 
                    level="body-sm" 
                    sx={{ 
                      fontWeight: 'bold', 
                      color: isPrimary ? '#FFFFFF' : '#CCCCCC', 
                      textTransform: 'capitalize'
                    }}
                  >
                    {formatBetType(betType)}
                  </Typography>
                  {bestProp && bestProp.line !== undefined && bestProp.line !== null && (
                    <Typography level="body-xs" sx={{ color: '#888888' }}>
                      Line: {bestProp.line}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {props.slice(0, 5).map((prop, idx) => (
                    <Chip
                      key={`${prop.betTypeId}-${prop.bookmakerId}-${idx}`}
                      variant="outlined"
                      size="sm"
                      sx={{
                        bgcolor: '#000000',
                        borderColor: isPrimary ? '#555555' : '#333333',
                        color: '#FFFFFF',
                        '&:hover': {
                          borderColor: isPrimary ? '#777777' : '#555555',
                        },
                      }}
                    >
                      <Typography level="body-xs" sx={{ color: '#FFFFFF', fontWeight: isPrimary ? 'bold' : 'normal' }}>
                        {(() => {
                          // Determine if this is over or under based on betTypeId
                          const isOver = prop.betTypeId?.includes('-over') || prop.betTypeId?.endsWith('over');
                          const isUnder = prop.betTypeId?.includes('-under') || prop.betTypeId?.endsWith('under');
                          const sideLabel = isOver ? 'O' : isUnder ? 'U' : '';
                          
                          return (
                            <>
                              {sideLabel && `${sideLabel} `}
                              {prop.line !== undefined && prop.line !== null ? `${prop.line} ` : ''}
                              {formatOdds(prop.price || (prop as any).americanOdds)}
                            </>
                          );
                        })()}
                      </Typography>
                      <Typography 
                        level="body-xs" 
                        sx={{ 
                          ml: 0.5, 
                          color: '#888888',
                          fontSize: '0.65rem'
                        }}
                      >
                        {prop.bookmaker}
                      </Typography>
                    </Chip>
                  ))}
                  {props.length > 5 && (
                    <Chip
                      variant="plain"
                      size="sm"
                      sx={{ color: '#888888' }}
                    >
                      +{props.length - 5} more
                    </Chip>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

