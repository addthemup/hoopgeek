import { Avatar, CircularProgress, Box } from '@mui/joy';
import { useState, useEffect } from 'react';

interface LoadingAvatarProps {
  src?: string;
  alt?: string;
  nbaPlayerId?: number;
  playerName?: string;
  size?: number | string;
  sx?: any;
  teamColors?: { primary: string; secondary: string };
  onError?: () => void;
  onClick?: () => void;
}

export default function LoadingAvatar({
  src,
  alt,
  nbaPlayerId,
  playerName,
  size = 40,
  sx = {},
  teamColors,
  onError,
  onClick,
}: LoadingAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Construct image URL if nbaPlayerId is provided
  const imageUrl = src || (nbaPlayerId && !imageError
    ? `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaPlayerId}.png`
    : undefined);

  // Reset loading state when imageUrl changes
  useEffect(() => {
    if (imageUrl && !imageError) {
      setIsLoading(true);
      setImageError(false);
      
      // Create a new image to test if it loads
      const testImg = new Image();
      testImg.onload = () => {
        setIsLoading(false);
      };
      testImg.onerror = () => {
        setImageError(true);
        setIsLoading(false);
        if (onError) onError();
      };
      testImg.src = imageUrl;
      
      return () => {
        testImg.onload = null;
        testImg.onerror = null;
      };
    } else {
      setIsLoading(false);
    }
  }, [imageUrl, imageError, onError]);

  // Get background color from team colors or default
  const bgColor = teamColors?.primary 
    ? `rgba(${parseInt(teamColors.primary.slice(1, 3), 16)}, ${parseInt(teamColors.primary.slice(3, 5), 16)}, ${parseInt(teamColors.primary.slice(5, 7), 16)}, 0.15)`
    : 'rgba(184, 134, 11, 0.15)';

  const borderColor = teamColors?.primary 
    ? `rgba(${parseInt(teamColors.primary.slice(1, 3), 16)}, ${parseInt(teamColors.primary.slice(3, 5), 16)}, ${parseInt(teamColors.primary.slice(5, 7), 16)}, 0.4)`
    : 'rgba(184, 134, 11, 0.4)';

  const progressColor = teamColors?.primary || '#B8860B';

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
      }}
    >
      <Avatar
        src={imageUrl}
        alt={alt || playerName || 'Avatar'}
        onClick={onClick}
        onError={() => {
          setImageError(true);
          setIsLoading(false);
          if (onError) onError();
        }}
        onLoad={() => {
          setIsLoading(false);
        }}
        sx={{
          width: size,
          height: size,
          border: `1px solid ${borderColor}`,
          fontSize: typeof size === 'number' ? `${size * 0.4}px` : '0.65rem',
          bgcolor: imageError || !imageUrl ? bgColor : 'transparent',
          cursor: onClick ? 'pointer' : 'default',
          '& img': {
            objectFit: 'cover',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.2s',
          },
          ...sx,
        }}
      >
        {(!imageUrl || imageError) && (playerName?.charAt(0) || '?')}
      </Avatar>
      {isLoading && imageUrl && !imageError && (
        <CircularProgress
          size="sm"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: progressColor,
            zIndex: 1,
          }}
        />
      )}
    </Box>
  );
}

