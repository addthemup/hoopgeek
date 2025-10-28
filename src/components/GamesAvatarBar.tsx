import { Box, Typography, Skeleton } from '@mui/joy';
import { useRef } from 'react';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { getTeamPrimaryColor } from '../utils/nbaTeamColors';

interface NBAGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  awayTeam: {
    id: number;
    name: string;
    abbreviation: string;
    points: number;
  };
  homeTeam: {
    id: number;
    name: string;
    abbreviation: string;
    points: number;
  };
}

interface GamesAvatarBarProps {
  games: NBAGame[];
  isLoading?: boolean;
  selectedGameId?: string | null;
  onGameClick?: (gameId: string) => void;
}

export default function GamesAvatarBar({ 
  games, 
  isLoading = false,
  selectedGameId,
  onGameClick 
}: GamesAvatarBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: { xs: '49px', md: '57px' },
          left: 0,
          right: 0,
          zIndex: 1050,
          borderBottom: { xs: '3px solid', md: 'none' },
          borderColor: 'divider',
          pt: { xs: 1.5, md: 1.5 },
          pb: { xs: 1, md: 1 },
          bgcolor: 'background.body',
          boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
        }}
      >
        <Box
          sx={{
            maxWidth: { xs: '100%', sm: 805, md: 1035 }, // 15% wider, matching feed
            minWidth: { xs: '100%', sm: 805, md: 1035 }, // Fixed width
            mx: 'auto',
            px: { xs: 2, md: 2 },
          }}
        >
          {/* Scrollable Skeleton Avatars Container */}
          <Box
            sx={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              pb: 0.5,
              '&::-webkit-scrollbar': {
                height: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'var(--joy-palette-neutral-600)',
                borderRadius: '4px',
              },
            }}
          >
            {/* Show 5 skeleton avatars */}
            {[...Array(5)].map((_, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 'fit-content',
                }}
              >
                {/* Skeleton Circle */}
                <Skeleton
                  variant="circular"
                  width={{ xs: 77, md: 83 }}
                  height={{ xs: 77, md: 83 }}
                  sx={{
                    bgcolor: 'background.level1',
                    border: '3px solid',
                    borderColor: 'text.primary',
                  }}
                />
                
                {/* Skeleton Text */}
                <Skeleton
                  variant="text"
                  width={{ xs: 60, md: 70 }}
                  height={16}
                  sx={{
                    bgcolor: 'background.level1',
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  if (!games || games.length === 0) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: { xs: '49px', md: '57px' },
          left: 0,
          right: 0,
          zIndex: 1050,
          borderBottom: { xs: '3px solid', md: 'none' },
          borderColor: 'divider',
          pt: { xs: 1.5, md: 1.5 },
          pb: { xs: 1, md: 1 },
          bgcolor: 'background.body',
          boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
        }}
      >
        <Box
          sx={{
            maxWidth: { xs: '100%', sm: 805, md: 1035 }, // 15% wider, matching feed
            minWidth: { xs: '100%', sm: 805, md: 1035 }, // Fixed width
            mx: 'auto',
            px: { xs: 2, md: 2 },
            textAlign: 'center',
          }}
        >
          <Typography
            level="body-sm"
            sx={{
              py: 1,
              px: 2,
              fontFamily: 'serif',
              color: 'text.secondary',
            }}
          >
            No games scheduled today
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: { xs: '49px', md: '57px' },
        left: 0,
        right: 0,
        zIndex: 1050,
        borderBottom: { xs: '3px solid', md: 'none' },
        borderColor: 'divider',
        pt: { xs: 1.5, md: 1.5 },
        pb: { xs: 1, md: 1 },
        bgcolor: 'background.body',
        boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
      }}
    >
      <Box
        sx={{
          maxWidth: { xs: '100%', sm: 805, md: 1035 }, // 15% wider, matching feed
          minWidth: { xs: '100%', sm: 805, md: 1035 }, // Fixed width
          mx: 'auto',
          px: { xs: 2, md: 2 },
        }}
      >
        {/* Scrollable Game Avatars Container */}
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            pb: 0.5,
            position: 'relative',
            '&::-webkit-scrollbar': {
              height: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'var(--joy-palette-neutral-600)',
              borderRadius: '4px',
            },
          }}
        >
          {/* Game Avatars */}
          {games.map((game) => {
            const isFinal = game.gameStatus === 3;
            const isLive = game.gameStatus === 2;
            const isSelected = selectedGameId === game.gameId;
            
            return (
              <Box
                key={game.gameId}
                onClick={() => onGameClick?.(game.gameId)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 'fit-content',
                  cursor: onGameClick ? 'pointer' : 'default',
                  position: 'relative',
                  zIndex: isSelected ? 10 : 2,
                }}
              >
                {/* Game Avatar Circle */}
                <Box
                  sx={{
                    width: { xs: 77, md: 83 },
                    height: { xs: 77, md: 83 },
                    border: isFinal 
                      ? '3px dashed'
                      : isLive
                        ? '3px solid #FFC72C'
                        : '3px solid',
                    borderColor: isSelected 
                      ? '#FFC72C'
                      : isFinal 
                        ? 'text.primary'
                        : isLive
                          ? '#FFC72C'
                          : 'text.primary',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    bgcolor: 'background.level1',
                    position: 'relative',
                    transition: 'all 0.2s',
                    cursor: onGameClick ? 'pointer' : 'default',
                    boxShadow: isSelected ? '0 0 16px rgba(255,215,0,0.5)' : 'none',
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
                      bgcolor: getTeamPrimaryColor(game.awayTeam.abbreviation),
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: '50%',
                      height: '100%',
                      bgcolor: getTeamPrimaryColor(game.homeTeam.abbreviation),
                    }}
                  />
                  
                  {/* Team logos */}
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
                      src={getTeamLogoUrl(game.awayTeam.abbreviation)}
                      alt={game.awayTeam.abbreviation}
                      sx={{
                        width: { xs: 28, md: 32 },
                        height: { xs: 28, md: 32 },
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
                      src={getTeamLogoUrl(game.homeTeam.abbreviation)}
                      alt={game.homeTeam.abbreviation}
                      sx={{
                        width: { xs: 28, md: 32 },
                        height: { xs: 28, md: 32 },
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
                  {(isFinal || isLive) && (
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
                        fontSize: { xs: '0.7rem', md: '0.75rem' },
                        fontFamily: '"Libre Baskerville", Georgia, serif',
                        border: '2px solid',
                        borderColor: 'background.body',
                        zIndex: 2,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {game.awayTeam.points}-{game.homeTeam.points}
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
                    {isLive ? 'LIVE' : isFinal ? 'FINAL' : game.gameStatusText}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

