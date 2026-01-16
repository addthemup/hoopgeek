import { Box, Typography, Skeleton } from '@mui/joy';
import { Add } from '@mui/icons-material';
import { useRef } from 'react';

interface League {
  id: string;
  name: string;
  team_name?: string;
  is_commissioner?: boolean;
}

interface LeagueAvatarBarProps {
  leagues: League[];
  isLoading?: boolean;
  selectedLeagueId?: string | null;
  onLeagueClick?: (leagueId: string) => void;
  onCreateClick?: () => void;
}

export default function LeagueAvatarBar({ 
  leagues, 
  isLoading = false,
  selectedLeagueId,
  onLeagueClick,
  onCreateClick
}: LeagueAvatarBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Get initials from league name
  const getLeagueInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  // Generate a color based on league name
  const getLeagueColor = (name: string) => {
    const colors = [
      '#1D4ED8', // Blue
      '#7C3AED', // Purple
      '#DC2626', // Red
      '#059669', // Green
      '#D97706', // Orange
      '#DB2777', // Pink
      '#0891B2', // Cyan
      '#4F46E5', // Indigo
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: { xs: '59px', md: 'calc((100vh - 40px) / 16)' }, // 10px below top nav on mobile to avoid overlap
          left: 0,
          right: 0,
          zIndex: 1200, // Above TopNavigation (1100) for overlay effect
          borderBottom: { xs: '3px solid', md: 'none' },
          borderColor: 'divider',
          pt: 0, // No padding-top to eliminate gap with nav bar
          pb: { xs: 1, md: 1 },
          bgcolor: 'background.body',
          boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
          overflowY: 'hidden',
        }}
      >
        <Box
          sx={{
            maxWidth: { xs: '100%', sm: 805, md: 1035 },
            minWidth: { xs: '100%', sm: 805, md: 1035 },
            mx: 'auto',
            px: { xs: 2, md: 2 },
            overflowY: 'hidden',
          }}
        >
          {/* Scrollable Skeleton Avatars Container */}
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
            {/* Show skeleton avatars */}
            {[...Array(4)].map((_, index) => (
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

  return (
      <Box
        sx={{
          position: 'fixed',
          top: { xs: '59px', md: 'calc((100vh - 40px) / 16)' }, // 10px below top nav on mobile to avoid overlap
          left: 0,
          right: 0,
          zIndex: 1200, // Above TopNavigation (1100) for overlay effect
          borderBottom: { xs: '3px solid', md: 'none' },
          borderColor: 'divider',
          pt: 0, // No padding-top to eliminate gap with nav bar
          pb: { xs: 1, md: 1 },
          bgcolor: 'background.body',
          boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
          overflowY: 'hidden',
        }}
      >
      <Box
        sx={{
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          minWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto',
          px: { xs: 2, md: 2 },
          overflowY: 'hidden',
        }}
      >
        {/* Scrollable League Avatars Container */}
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            overflowY: 'hidden',
            pb: 0,
            position: 'relative',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        >
          {/* Create League Avatar */}
          <Box
            onClick={onCreateClick}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 'fit-content',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {/* Create Avatar Circle */}
            <Box
              sx={{
                width: { xs: 77, md: 83 },
                height: { xs: 77, md: 83 },
                border: '3px dashed',
                borderColor: '#FFC72C',
                borderRadius: '50%',
                bgcolor: 'rgba(255, 199, 44, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(255, 199, 44, 0.2)',
                  borderColor: '#FFD700',
                },
              }}
            >
              <Add sx={{ fontSize: { xs: 40, md: 44 }, color: '#FFC72C' }} />
            </Box>
          </Box>

          {/* League Avatars */}
          {leagues?.map((league) => {
            const isSelected = selectedLeagueId === league.id;
            const leagueColor = getLeagueColor(league.name);
            const initials = getLeagueInitials(league.name);
            
            return (
              <Box
                key={league.id}
                onClick={() => onLeagueClick?.(league.id)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 'fit-content',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: isSelected ? 10 : 2,
                }}
              >
                {/* League Avatar Circle */}
                <Box
                  sx={{
                    width: { xs: 77, md: 83 },
                    height: { xs: 77, md: 83 },
                    border: '3px solid',
                    borderColor: isSelected ? '#FFC72C' : 'text.primary',
                    borderRadius: '50%',
                    bgcolor: leagueColor,
                    position: 'relative',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSelected ? '0 0 16px rgba(255,215,0,0.5)' : 'none',
                    '&:hover': {
                      boxShadow: '0 0 12px rgba(255,199,44,0.4)',
                    },
                  }}
                >
                  {/* League Initials */}
                  <Typography
                    sx={{
                      color: '#fff',
                      fontSize: { xs: '1.5rem', md: '1.75rem' },
                      fontWeight: 900,
                      fontFamily: 'serif',
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    {initials}
                  </Typography>

                  {/* Commissioner Badge */}
                  {league.is_commissioner && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: '5%',
                        right: '5%',
                        bgcolor: '#FFD700',
                        color: '#000',
                        width: { xs: 20, md: 22 },
                        height: { xs: 20, md: 22 },
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: { xs: '0.75rem', md: '0.85rem' },
                        border: '2px solid',
                        borderColor: 'background.body',
                        zIndex: 2,
                      }}
                    >
                      🛡️
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}

          {/* No leagues message */}
          {(!leagues || leagues.length === 0) && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                ml: 2,
              }}
            >
              <Typography
                level="body-sm"
                sx={{
                  color: 'text.secondary',
                  fontFamily: 'serif',
                  fontStyle: 'italic',
                }}
              >
                No leagues yet. Create your first one! →
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

