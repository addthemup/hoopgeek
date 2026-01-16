import { Box, Typography } from '@mui/joy';
import AvatarBar from './AvatarBar';
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
  return (
    <AvatarBar
      items={games || []}
      isLoading={isLoading}
      selectedId={selectedGameId}
      onItemClick={onGameClick}
      getItemId={(game) => game.gameId}
      minItems={5}
      getBorderStyles={(game, index, hasData, isSelected) => {
        if (!hasData || !game) {
          return {
            border: '3px dashed',
            borderColor: 'text.primary',
            bgcolor: '#000000',
          };
        }

        const isFinal = game.gameStatus === 3;
        const isLive = game.gameStatus === 2;

        return {
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
          bgcolor: 'background.level1',
        };
      }}
      renderAvatar={(game, index, hasData) => {
        if (!hasData || !game) {
          return null; // Skeleton/blank avatar handled by AvatarBar
        }

        const isFinal = game.gameStatus === 3;
        const isLive = game.gameStatus === 2;

        return (
          <>
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
          </>
        );
      }}
    />
  );
}

