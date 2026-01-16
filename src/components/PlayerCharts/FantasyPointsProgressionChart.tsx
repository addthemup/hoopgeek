import { useMemo, useRef, useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Skeleton, IconButton } from '@mui/joy';
import { LineChart } from '@mui/x-charts/LineChart';
import { useNavigate } from 'react-router-dom';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos';
import { PlayerHighlight } from '../../hooks/usePlayerHighlights';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useMediaQuery } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

interface FantasyPointsProgressionChartProps {
  highlights: PlayerHighlight[];
  teamAbbreviation?: string;
  isLoading?: boolean;
  playerId?: string; // UUID of the player to fetch their team for each game
}

interface GameData {
  awayTricode: string;
  homeTricode: string;
  awayScore: number;
  homeScore: number;
  opponentTricode?: string;
}

export default function FantasyPointsProgressionChart({
  highlights,
  teamAbbreviation,
  isLoading = false,
  playerId,
}: FantasyPointsProgressionChartProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);
  const [chartHeight, setChartHeight] = useState(400);
  const [avatarPositions, setAvatarPositions] = useState<Array<{ x: number; y: number; highlight: PlayerHighlight }>>([]);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1976d2';

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        const tooltipElement = document.getElementById('fantasy-points-chart-tooltip');
        if (tooltipElement && !tooltipElement.contains(event.target as Node)) {
          setTooltipOpen(false);
        }
      }
    };

    if (tooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tooltipOpen]);

  const handleToggleTooltip = () => {
    setTooltipOpen(!tooltipOpen);
  };

  // Extract unique game IDs from highlights to fetch game data
  const gameIds = useMemo(() => {
    const ids = highlights
      .map((h) => h.game_id)
      .filter(Boolean) as string[];
    return Array.from(new Set(ids));
  }, [highlights]);

  // Fetch game data (team tricodes and scores) from nba_games table
  // Also fetch player's team for each game to determine opponent
  const gameDataQuery = useQuery({
    queryKey: ['player-highlights-games', gameIds, highlights],
    queryFn: async () => {
      if (gameIds.length === 0) return new Map<string, GameData & { playerTeam?: string; opponentTricode?: string }>();

      // Fetch game data
      const { data: gameData, error: gameError } = await supabase
        .from('nba_games')
        .select('game_id, away_team_tricode, home_team_tricode, away_team_score, home_team_score')
        .in('game_id', gameIds);

      if (gameError) {
        console.error('Error fetching game data:', gameError);
        return new Map();
      }

      // Fetch player's team for each game from boxscores
      let playerTeamMap = new Map<string, string>();
      
      if (playerId && gameIds.length > 0) {
        // Fetch boxscores to get player's team for each game
        const { data: boxscoreData, error: boxscoreError } = await supabase
          .from('nba_boxscores')
          .select('game_id, team_abbreviation, team_tricode')
          .eq('player_id', playerId)
          .in('game_id', gameIds);

        if (!boxscoreError && boxscoreData) {
          boxscoreData.forEach((boxscore: any) => {
            const team = boxscore.team_abbreviation || boxscore.team_tricode || '';
            if (team) {
              playerTeamMap.set(boxscore.game_id, team);
            }
          });
        }
      }

      const results = new Map<string, GameData & { playerTeam?: string; opponentTricode?: string }>();
      if (gameData) {
        gameData.forEach((game: any) => {
          const awayTricode = game.away_team_tricode || '';
          const homeTricode = game.home_team_tricode || '';
          
          // Determine opponent: get player's team from boxscore data or use teamAbbreviation prop
          const playerTeam = playerTeamMap.get(game.game_id) || teamAbbreviation || '';
          let opponentTricode = '';
          
          if (playerTeam) {
            // Check if player's team matches away or home
            if (playerTeam === awayTricode) {
              opponentTricode = homeTricode;
            } else if (playerTeam === homeTricode) {
              opponentTricode = awayTricode;
            } else {
              // Player team doesn't match either, use home as fallback
              opponentTricode = homeTricode;
            }
          } else {
            // No player team info, use home team as fallback
            opponentTricode = homeTricode;
          }
          
          results.set(game.game_id, {
            awayTricode,
            homeTricode,
            awayScore: game.away_team_score || 0,
            homeScore: game.home_team_score || 0,
            opponentTricode,
          });
        });
      }

      return results;
    },
    enabled: gameIds.length > 0,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  const gameDataMap = useMemo(() => {
    return gameDataQuery.data || new Map<string, GameData>();
  }, [gameDataQuery.data]);

  // Sort highlights by game_date ascending for progression
  const sortedHighlights = useMemo(() => {
    return [...highlights].sort((a, b) => {
      const dateA = new Date(a.game_date || a.published_at).getTime();
      const dateB = new Date(b.game_date || b.published_at).getTime();
      return dateA - dateB;
    });
  }, [highlights]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (sortedHighlights.length === 0) return { fantasyPoints: [], gameNumbers: [], dates: [] };

    const fantasyPoints = sortedHighlights.map((h) => h.fantasy_points || 0);
    const gameNumbers = sortedHighlights.map((_, index) => index + 1);
    const dates = sortedHighlights.map((h) => {
      const date = new Date(h.game_date || h.published_at);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    return { fantasyPoints, gameNumbers, dates };
  }, [sortedHighlights]);

  // Removed preloading logic - let images load naturally like GamesAvatarBar

  // Update chart dimensions - make it wide enough for all games with horizontal scrolling
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Calculate width based on number of games (minimum 120px per game for better spacing)
        // This ensures the chart is wide enough to show all games with proper spacing
        const minWidthPerGame = 120;
        const calculatedWidth = Math.max(
          containerWidth, // At least as wide as container
          sortedHighlights.length * minWidthPerGame // Width for all games
        );
        setChartWidth(calculatedWidth);
        setChartHeight(isMobile ? 300 : 400);
      }
    };

    const timeoutId = setTimeout(updateDimensions, 0);
    window.addEventListener('resize', updateDimensions);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [sortedHighlights, isMobile]);

  // Auto-scroll to the right (most recent games) when chart loads
  useEffect(() => {
    if (containerRef.current && sortedHighlights.length > 0) {
      // Wait for chart to render, then scroll to the right
      const scrollTimeout = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        }
      }, 300); // Wait for chart to fully render

      return () => clearTimeout(scrollTimeout);
    }
  }, [sortedHighlights, chartWidth]);

  // Calculate avatar positions after chart renders
  useEffect(() => {
    if (!chartRef.current || chartData.fantasyPoints.length === 0) {
      setAvatarPositions([]);
      return;
    }

    // Wait for chart to render, then calculate positions
    const timeoutId = setTimeout(() => {
      const chartElement = chartRef.current;
      if (!chartElement) return;

      // Find the SVG element
      const svg = chartElement.querySelector('svg');
      if (!svg) return;

      // Get chart container position
      const chartRect = chartElement.getBoundingClientRect();

      // Find all circle elements (markers) - MUI X Charts creates these even when showMarkers is false
      // We'll calculate positions based on the data instead
      const positions: Array<{ x: number; y: number; highlight: PlayerHighlight }> = [];

      // Get the min/max values for scaling
      const minFP = Math.min(...chartData.fantasyPoints);
      const maxFP = Math.max(...chartData.fantasyPoints);
      const fpRange = maxFP - minFP || 1; // Avoid division by zero

      // MUI X Charts default margins (approximate)
      const marginLeft = 70;
      const marginRight = 30;
      const marginTop = 30;
      const marginBottom = 70;

      const plotWidth = chartWidth - marginLeft - marginRight;
      const plotHeight = chartHeight - marginTop - marginBottom;

      chartData.fantasyPoints.forEach((fp, index) => {
        // X position: evenly spaced across games (0 to plotWidth)
        const xRatio = chartData.gameNumbers.length > 1 
          ? index / (chartData.gameNumbers.length - 1)
          : 0.5; // Center if only one point
        const x = marginLeft + xRatio * plotWidth;

        // Y position: based on fantasy points value
        // In SVG, y=0 is at top, so we need to invert
        const yRatio = (fp - minFP) / fpRange;
        const y = marginTop + (1 - yRatio) * plotHeight; // Invert for SVG coordinates

        positions.push({
          x: x,
          y: y,
          highlight: sortedHighlights[index],
        });
      });

      setAvatarPositions(positions);
    }, 200); // Increased timeout to ensure chart is fully rendered

    return () => clearTimeout(timeoutId);
  }, [chartData, chartWidth, chartHeight, sortedHighlights]);

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Skeleton variant="rectangular" width="100%" height={400} />
        </CardContent>
      </Card>
    );
  }

  if (sortedHighlights.length === 0) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Typography sx={{ color: '#FFFFFF', textAlign: 'center', py: 4 }}>
            No highlights available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const handleAvatarClick = (highlight: PlayerHighlight) => {
    navigate(`/?postId=${highlight.id}`);
  };

  return (
    <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333', position: 'relative' }}>
      <CardContent>
        {/* Tooltip Button */}
        <IconButton
          ref={buttonRef}
          size="sm"
          variant="plain"
          onClick={handleToggleTooltip}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            color: 'rgba(255, 255, 255, 0.6)',
            '&:hover': {
              color: '#FFFFFF',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <InfoOutlined sx={{ fontSize: 18 }} />
        </IconButton>
        {tooltipOpen && (
          <Card
            id="fantasy-points-chart-tooltip"
            variant="soft"
            sx={{
              position: 'absolute',
              top: 40,
              right: 8,
              zIndex: 20,
              maxWidth: 280,
              bgcolor: '#1a1a1a',
              borderColor: '#333333',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Box sx={{ p: 2 }}>
              <Typography level="body-sm" sx={{ mb: 1, fontWeight: 600, color: '#FFFFFF' }}>
                Fantasy Points Progression
              </Typography>
              <Typography level="body-xs" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.8)' }}>
                This chart shows the player's fantasy points performance across all games this season.
              </Typography>
              <Typography level="body-xs" sx={{ color: '#FFC72C', fontWeight: 500 }}>
                💡 Click on any avatar to view the highlight reel for that game.
              </Typography>
            </Box>
          </Card>
        )}
        <Box
          ref={containerRef}
          sx={{
            width: '100%',
            position: 'relative',
            bgcolor: '#000000',
            overflowX: 'auto',
            overflowY: 'hidden',
            '&::-webkit-scrollbar': {
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#1a1a1a',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#555',
              borderRadius: '4px',
              '&:hover': {
                background: '#777',
              },
            },
          }}
        >
          {/* Line Chart - Expands based on number of games for horizontal scrolling */}
          <Box 
            ref={chartRef} 
            sx={{ 
              width: chartWidth,
              minWidth: chartWidth, // Ensure chart is wide enough for all games
              position: 'relative',
              flexShrink: 0, // Prevent shrinking
            }}
          >
            <LineChart
              width={chartWidth}
              height={chartHeight}
              margin={{ left: 70, right: 30, top: 30, bottom: 70 }}
              series={[
                {
                  data: chartData.fantasyPoints,
                  label: 'Fantasy Points',
                  id: 'fantasy-points',
                  color: primaryColor,
                  showMarkers: false, // We'll use custom avatars instead
                  curve: 'natural',
                },
              ]}
              xAxis={[
                {
                  data: chartData.gameNumbers, // Use numeric indices for positioning
                  label: 'Date',
                  labelStyle: { fill: '#FFFFFF' },
                  tickLabelStyle: { fill: '#FFFFFF', fontSize: 12 },
                  valueFormatter: (value) => {
                    // Map numeric index to date string
                    const index = Number(value) - 1; // gameNumbers are 1-based
                    if (index >= 0 && index < chartData.dates.length) {
                      const dateStr = chartData.dates[index];
                      return dateStr || String(value); // Fallback to number if date is empty
                    }
                    return String(value);
                  },
                  tickMinStep: 1,
                },
              ]}
              yAxis={[
                {
                  label: 'Fantasy Points',
                  labelStyle: { fill: '#FFFFFF' },
                  tickLabelStyle: { fill: '#FFFFFF', fontSize: 12 },
                },
              ]}
              grid={{ vertical: true, horizontal: true }}
              sx={{
                width: '100%',
                maxWidth: '100%',
                bgcolor: '#000000',
                '& .MuiChartsGrid-line': {
                  stroke: '#333333',
                  strokeWidth: 1,
                },
                '& .MuiChartsLegend-root': {
                  color: '#FFFFFF',
                },
                '& .MuiLineElement-root': {
                  strokeWidth: 3,
                },
              }}
            />

            {/* Custom Avatar Markers Overlay */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none', // Allow clicks to pass through to chart
              }}
            >
              {avatarPositions.map((pos, index) => {
                const highlight = pos.highlight;
                const gameData = highlight.game_id ? gameDataMap.get(highlight.game_id) : null;
                const opponentTricode = gameData?.opponentTricode || '';
                const hasOpponent = !!opponentTricode;
                const avatarSize = isMobile ? 30 : 40; // 50% smaller than before (was 60/80)

                return (
                  <Box
                    key={highlight.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAvatarClick(highlight);
                    }}
                    sx={{
                      position: 'absolute',
                      left: pos.x,
                      top: pos.y,
                      transform: 'translate(-50%, -50%)',
                      width: avatarSize,
                      height: avatarSize,
                      pointerEvents: 'auto', // Enable pointer events for this avatar
                      cursor: 'pointer',
                      zIndex: 10,
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translate(-50%, -50%) scale(1.2)',
                        zIndex: 20,
                      },
                    }}
                  >
                    {/* Avatar Circle - Show only opponent team */}
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        border: '2px solid', // Thinner border for smaller avatars
                        borderColor: '#FFC72C',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                        bgcolor: hasOpponent ? getTeamPrimaryColor(opponentTricode) : '#1a1a1a', // Full circle with opponent color
                      }}
                    >
                      {/* Opponent team logo or tricode text fallback */}
                      {hasOpponent ? (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1,
                            pointerEvents: 'auto',
                          }}
                        >
                          {/* Try to show logo first, fallback to text on error */}
                          <Box
                            component="img"
                            src={getTeamLogoUrl(opponentTricode)}
                            alt={opponentTricode}
                            loading="eager"
                            className={`opponent-logo-${highlight.id}`}
                            sx={{
                              width: { xs: 18, md: 22 }, // Larger since it's the only logo
                              height: { xs: 18, md: 22 },
                              objectFit: 'contain',
                              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                              display: 'block',
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              // Show text fallback when image fails
                              const textElement = document.getElementById(`opponent-text-${highlight.id}`);
                              if (textElement) {
                                textElement.style.display = 'flex';
                              }
                            }}
                          />
                          {/* Text fallback - hidden by default, shown via onError handler */}
                          <Typography
                            id={`opponent-text-${highlight.id}`}
                            level="body-xs"
                            sx={{
                              display: 'none', // Hidden by default, shown if logo fails
                              color: '#FFFFFF',
                              fontWeight: 'bold',
                              fontSize: isMobile ? '0.5rem' : '0.6rem',
                              textAlign: 'center',
                              lineHeight: 1,
                              position: 'absolute',
                              width: '100%',
                              height: '100%',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {opponentTricode}
                          </Typography>
                        </Box>
                      ) : null}

                      {/* Score overlay (optional - can show fantasy points or score) */}
                      {highlight.fantasy_points !== undefined && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 2,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 3, // Above logos
                            bgcolor: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '4px',
                            px: 0.5,
                            py: 0.25,
                          }}
                        >
                          <Typography
                            level="body-xs"
                            sx={{
                              color: '#FFFFFF',
                              fontWeight: 'bold',
                              fontSize: isMobile ? '0.5rem' : '0.6rem', // Smaller font for smaller avatars
                              lineHeight: 1,
                            }}
                          >
                            {highlight.fantasy_points.toFixed(1)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

