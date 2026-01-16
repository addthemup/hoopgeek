import { useMemo, useRef, useState } from 'react';
import { Box, Typography, Skeleton } from '@mui/joy';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos';
import { supabase } from '../../utils/supabase';
import { PlayerHighlight } from '../../hooks/usePlayerHighlights';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, EffectCoverflow } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import { useMediaQuery } from '@mui/material';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-coverflow';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

interface PlayerHighlightsCarouselProps {
  highlights: PlayerHighlight[];
  teamAbbreviation?: string;
  isLoading?: boolean;
}

export default function PlayerHighlightsCarousel({ 
  highlights, 
  teamAbbreviation,
  isLoading = false 
}: PlayerHighlightsCarouselProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const navigationPrevRef = useRef<HTMLDivElement>(null);
  const navigationNextRef = useRef<HTMLDivElement>(null);
  const [swiperInstance, setSwiperInstance] = useState<SwiperType | null>(null);
  
  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1976d2';

  // Extract unique game IDs from highlights to fetch game data
  const gameIds = useMemo(() => {
    const ids = highlights
      .map(h => h.game_id)
      .filter(Boolean) as string[];
    return Array.from(new Set(ids));
  }, [highlights]);

  // Fetch game data (team tricodes and scores) from nba_games table
  const gameDataQuery = useQuery({
    queryKey: ['player-highlights-games', gameIds],
    queryFn: async () => {
      if (gameIds.length === 0) return new Map();
      
      const { data, error } = await supabase
        .from('nba_games')
        .select('game_id, away_team_tricode, home_team_tricode, away_team_score, home_team_score')
        .in('game_id', gameIds);
      
      if (error) {
        console.error('Error fetching game data:', error);
        return new Map();
      }
      
      const results = new Map<string, { 
        awayTricode: string; 
        homeTricode: string; 
        awayScore: number; 
        homeScore: number;
      }>();
      if (data) {
        data.forEach((game: any) => {
          results.set(game.game_id, {
            awayTricode: game.away_team_tricode || '',
            homeTricode: game.home_team_tricode || '',
            awayScore: game.away_team_score || 0,
            homeScore: game.home_team_score || 0,
          });
        });
      }
      
      return results;
    },
    enabled: gameIds.length > 0,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  const gameDataMap = useMemo(() => {
    return gameDataQuery.data || new Map();
  }, [gameDataQuery.data]);

  const formatDateHeader = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ width: '100%', position: 'relative', px: { xs: 0, md: 6 }, pt: '5px', pb: '5px' }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 2, px: { xs: 2, md: 0 } }}>
          <Skeleton variant="text" width={200} height={32} sx={{ bgcolor: '#1a1a1a' }} />
        </Box>

        {/* Skeleton Swiper Carousel */}
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 2, md: 3 },
              overflow: 'hidden',
              px: { xs: 2, md: 0 },
            }}
          >
            {/* Render skeleton slides based on screen size */}
            {Array.from({ length: isMobile ? 1 : 5 }).map((_, index) => (
              <Box
                key={index}
                sx={{
                  flex: isMobile ? '0 0 100%' : '0 0 calc(20% - 24px)',
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    bgcolor: '#000000',
                    border: '3px solid',
                    borderColor: '#333333',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Avatar Section Skeleton - Match exact padding */}
                  <Box
                    sx={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      p: { xs: 2, md: 2.5 },
                      bgcolor: '#000000',
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: 120, md: 140 },
                        height: { xs: 120, md: 140 },
                        border: '3px dashed',
                        borderColor: '#FFFFFF',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        bgcolor: '#1a1a1a',
                        position: 'relative',
                        flexShrink: 0,
                      }}
                    >
                      <Skeleton
                        variant="rectangular"
                        width="100%"
                        height="100%"
                        sx={{
                          bgcolor: '#1a1a1a',
                          borderRadius: '50%',
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Content Section Skeleton - Match exact padding and gap */}
                  <Box sx={{ p: { xs: 1.5, md: 2 }, pt: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {/* Fantasy Points Skeleton - Match typography structure */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Skeleton 
                        variant="text" 
                        width={20} 
                        height={14}
                        sx={{ 
                          bgcolor: '#1a1a1a',
                        }} 
                      />
                      <Skeleton 
                        variant="text" 
                        width={35} 
                        height={20}
                        sx={{ 
                          bgcolor: '#1a1a1a',
                        }} 
                      />
                    </Box>

                    {/* Game Stats Grid Skeleton - Match exact structure */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Box key={i} sx={{ textAlign: 'center' }}>
                          <Skeleton 
                            variant="text" 
                            width="100%" 
                            height={10.4}
                            sx={{ 
                              mb: 0,
                              bgcolor: '#1a1a1a',
                            }} 
                          />
                          <Skeleton 
                            variant="text" 
                            width="100%" 
                            height={14}
                            sx={{ 
                              bgcolor: '#1a1a1a',
                            }} 
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  if (highlights.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography sx={{ color: '#CCCCCC' }}>
          No highlights available for this player yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', position: 'relative', px: { xs: 0, md: 1 }, pt: '5px', pb: '5px' }}>
      {/* Swiper Carousel */}
      <Box sx={{ position: 'relative' }}>
        <Swiper
          effect={isMobile ? "slide" : "coverflow"}
          grabCursor={true}
          centeredSlides={true}
          loop={highlights.length > (isMobile ? 1 : 3)}
          coverflowEffect={isMobile ? undefined : {
            rotate: 30,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: true,
          }}
          pagination={isMobile ? { clickable: true } : false}
          navigation={{
            prevEl: navigationPrevRef.current,
            nextEl: navigationNextRef.current,
          }}
          modules={[EffectCoverflow, Pagination, Navigation]}
          className="player-highlights-swiper"
          onSwiper={setSwiperInstance}
          onBeforeInit={(swiper) => {
            if (swiper.params.navigation && typeof swiper.params.navigation !== 'boolean') {
              swiper.params.navigation.prevEl = navigationPrevRef.current;
              swiper.params.navigation.nextEl = navigationNextRef.current;
            }
          }}
          onInit={(swiper) => {
            if (swiper.params.navigation && typeof swiper.params.navigation !== 'boolean') {
              swiper.params.navigation.prevEl = navigationPrevRef.current;
              swiper.params.navigation.nextEl = navigationNextRef.current;
              swiper.navigation.init();
              swiper.navigation.update();
            }
          }}
          breakpoints={{
            100: {
              slidesPerView: 1,
              spaceBetween: 20,
            },
            900: {
              slidesPerView: 3,
              spaceBetween: 30,
            },
            1200: {
              slidesPerView: 5,
              spaceBetween: 30,
            },
          }}
        >
          {highlights.map((highlight) => {
            const postId = highlight.id;
            const gameData = highlight.game_id ? gameDataMap.get(highlight.game_id) : null;
            const awayTricode = gameData?.awayTricode || '';
            const homeTricode = gameData?.homeTricode || '';
            const awayScore = gameData?.awayScore ?? null;
            const homeScore = gameData?.homeScore ?? null;
            const hasGameData = awayTricode && homeTricode;

          return (
              <SwiperSlide key={highlight.id}>
                <Box
                  onClick={() => navigate(`/?postId=${postId}`)}
              sx={{
                bgcolor: '#000000',
                    border: '3px solid',
                borderColor: '#333333',
                    borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                    overflow: 'hidden',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
                  borderColor: primaryColor,
                },
              }}
            >
                  {/* Avatar Section - Keep size, more condensed */}
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                      p: { xs: 2, md: 2.5 },
                    bgcolor: '#000000',
                  }}
                >
                      <Box
                        sx={{
                          width: { xs: 120, md: 140 },
                          height: { xs: 120, md: 140 },
                          border: '3px dashed',
                          borderColor: 'text.primary',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          bgcolor: 'background.level1',
                          position: 'relative',
                          transition: 'all 0.2s',
                        flexShrink: 0,
                        }}
                      >
                        {/* Split background with team colors */}
                        {hasGameData ? (
                          <>
                            <Box
                              sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '50%',
                                height: '100%',
                                bgcolor: getTeamPrimaryColor(awayTricode) || '#1a1a1a',
                              }}
                            />
                            <Box
                              sx={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                width: '50%',
                                height: '100%',
                                bgcolor: getTeamPrimaryColor(homeTricode) || '#1a1a1a',
                              }}
                            />
                          </>
                        ) : (
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              bgcolor: 'background.level1',
                            }}
                          />
                        )}
                        
                        {/* Team logos */}
                        {hasGameData ? (
                          <>
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
                                src={getTeamLogoUrl(awayTricode)}
                                alt={awayTricode}
                                sx={{
                                  width: { xs: 40, md: 48 },
                                  height: { xs: 40, md: 48 },
                                  objectFit: 'contain',
                                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </Box>
                            
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
                                src={getTeamLogoUrl(homeTricode)}
                                alt={homeTricode}
                                sx={{
                                  width: { xs: 40, md: 48 },
                                  height: { xs: 40, md: 48 },
                                  objectFit: 'contain',
                                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </Box>
                          </>
                        ) : null}

                        {/* Vertical divider line */}
                        {hasGameData && (
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
                        )}
                        
                        {/* Score Badge at bottom */}
                        {hasGameData && awayScore != null && homeScore != null && (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: '8%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              bgcolor: '#FFC72C',
                              color: '#000',
                              px: 1,
                              py: 0.25,
                              borderRadius: '6px',
                              fontWeight: 'bold',
                              fontSize: { xs: '0.75rem', md: '0.85rem' },
                              fontFamily: '"Libre Baskerville", Georgia, serif',
                              border: '2px solid',
                              borderColor: 'background.body',
                              zIndex: 2,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {awayScore}-{homeScore}
                          </Box>
                        )}

                        {/* Date at top */}
                        {highlight.game_date && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '8%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              bgcolor: 'rgba(0,0,0,0.75)',
                              color: '#fff',
                              px: 0.75,
                              py: 0.25,
                              borderRadius: '4px',
                              fontSize: { xs: '0.55rem', md: '0.6rem' },
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
                            {formatDateHeader(highlight.game_date)}
                          </Box>
                        )}
                      </Box>
                </Box>

                  {/* Content - Condensed Stats */}
                {highlight.fantasy_points !== undefined && highlight.game_stats && (
                    <Box sx={{ p: { xs: 1.5, md: 2 }, pt: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {/* Fantasy Points - Compact */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                        <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>
                          FP
                      </Typography>
                      <Typography
                          level="body-md"
                        sx={{ fontWeight: 'bold', color: primaryColor }}
                      >
                        {highlight.fantasy_points.toFixed(1)}
                      </Typography>
                    </Box>

                      {/* Game Stats - Compact Grid */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC', fontSize: '0.65rem' }}>PTS</Typography>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF', fontSize: '0.875rem' }}>
                            {highlight.game_stats.pts}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC', fontSize: '0.65rem' }}>REB</Typography>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF', fontSize: '0.875rem' }}>
                            {highlight.game_stats.reb}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC', fontSize: '0.65rem' }}>AST</Typography>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF', fontSize: '0.875rem' }}>
                            {highlight.game_stats.ast}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC', fontSize: '0.65rem' }}>MIN</Typography>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF', fontSize: '0.875rem' }}>
                            {highlight.game_stats.min}
                          </Typography>
                        </Box>
                      </Box>
                  </Box>
                )}
                </Box>
              </SwiperSlide>
          );
        })}
        </Swiper>

        {/* Navigation Buttons - Mobile: Left/Right, Desktop: Custom styled */}
        {isMobile ? (
          <>
            <Box
              ref={navigationPrevRef}
              onClick={() => swiperInstance?.slidePrev()}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                border: '2px solid',
                borderColor: '#333333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.9)',
                  borderColor: primaryColor,
                  transform: 'translateY(-50%) scale(1.1)',
                },
              }}
            >
              <NavigateBeforeIcon sx={{ color: '#FFFFFF', fontSize: '1.5rem' }} />
            </Box>
            <Box
              ref={navigationNextRef}
              onClick={() => swiperInstance?.slideNext()}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                border: '2px solid',
                borderColor: '#333333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.9)',
                  borderColor: primaryColor,
                  transform: 'translateY(-50%) scale(1.1)',
                },
              }}
            >
              <NavigateNextIcon sx={{ color: '#FFFFFF', fontSize: '1.5rem' }} />
            </Box>
          </>
        ) : (
          <>
            <Box
              ref={navigationPrevRef}
              onClick={() => swiperInstance?.slidePrev()}
          sx={{
                position: 'absolute',
                left: -20,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                border: '2px solid',
            borderColor: '#333333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                '&:hover': {
                  bgcolor: '#FFFFFF',
                  borderColor: primaryColor,
                  transform: 'translateY(-50%) scale(1.1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            },
          }}
        >
              <NavigateBeforeIcon sx={{ color: '#000000', fontSize: '1.5rem' }} />
            </Box>
            <Box
              ref={navigationNextRef}
              onClick={() => swiperInstance?.slideNext()}
          sx={{
                position: 'absolute',
                right: -20,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                border: '2px solid',
            borderColor: '#333333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                '&:hover': {
                  bgcolor: '#FFFFFF',
                  borderColor: primaryColor,
                  transform: 'translateY(-50%) scale(1.1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            },
          }}
        >
              <NavigateNextIcon sx={{ color: '#000000', fontSize: '1.5rem' }} />
            </Box>
          </>
        )}
      </Box>

      {/* Custom Swiper Styles */}
      <style>{`
        .player-highlights-swiper {
          padding: 20px 0 0 0 !important;
        }
        .player-highlights-swiper .swiper-slide {
          height: auto;
        }
        .player-highlights-swiper .swiper-pagination {
          bottom: 10px !important;
        }
        .player-highlights-swiper .swiper-pagination-bullet {
          background: #FFFFFF;
          opacity: 0.5;
        }
        .player-highlights-swiper .swiper-pagination-bullet-active {
          opacity: 1;
          background: ${primaryColor};
        }
      `}</style>
    </Box>
  );
}
