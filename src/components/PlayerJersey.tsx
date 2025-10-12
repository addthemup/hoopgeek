import { Box, Typography } from '@mui/joy';
import { getTeamColors } from '../utils/nbaTeamColors';

interface PlayerJerseyProps {
  playerName: string;
  jerseyNumber?: number | string;
  nbaTeam: string; // Team abbreviation (e.g., "LAL", "BOS")
  position?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function PlayerJersey({ 
  playerName, 
  jerseyNumber, 
  nbaTeam, 
  position,
  size = 'medium' 
}: PlayerJerseyProps) {
  const teamColors = getTeamColors(nbaTeam);
  
  // Size mappings
  const sizes = {
    small: { jersey: 50, number: '1.2rem', name: '0.65rem', position: '0.55rem', svg: 60 },
    medium: { jersey: 70, number: '1.8rem', name: '0.75rem', position: '0.6rem', svg: 80 },
    large: { jersey: 90, number: '2.2rem', name: '0.85rem', position: '0.65rem', svg: 100 }
  };
  
  const dimensions = sizes[size];
  
  // Get last name only
  const lastName = playerName.split(' ').pop() || playerName;
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      {/* Jersey SVG */}
      <Box
        sx={{
          position: 'relative',
          width: dimensions.svg,
          height: dimensions.svg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'scale(1.05)',
          }
        }}
      >
        {/* SVG Jersey Shape */}
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          style={{ 
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {/* Main jersey body */}
          <path
            d="M 30 15 L 20 25 L 25 35 L 25 85 L 35 95 L 65 95 L 75 85 L 75 35 L 80 25 L 70 15 L 65 20 L 55 15 L 45 15 L 35 20 Z"
            fill={teamColors.primary}
            stroke={teamColors.secondary}
            strokeWidth="2"
          />
          
          {/* Sleeves with gradient effect */}
          <path
            d="M 30 15 L 20 25 L 25 35 L 30 30 Z"
            fill={teamColors.secondary}
            opacity="0.7"
          />
          <path
            d="M 70 15 L 80 25 L 75 35 L 70 30 Z"
            fill={teamColors.secondary}
            opacity="0.7"
          />
          
          {/* Neckline */}
          <ellipse
            cx="50"
            cy="18"
            rx="8"
            ry="5"
            fill={teamColors.secondary}
          />
          
          {/* Collar trim */}
          <path
            d="M 42 18 Q 50 22 58 18"
            fill="none"
            stroke={teamColors.secondary}
            strokeWidth="2"
          />
          
          {/* Side stripes for detail */}
          <line
            x1="30"
            y1="40"
            x2="30"
            y2="85"
            stroke={teamColors.secondary}
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="70"
            y1="40"
            x2="70"
            y2="85"
            stroke={teamColors.secondary}
            strokeWidth="1.5"
            opacity="0.6"
          />
        </svg>

        {/* Jersey Number (on top of SVG) */}
        <Typography
          sx={{
            position: 'relative',
            zIndex: 10,
            fontSize: dimensions.number,
            fontWeight: 'bold',
            color: '#FFFFFF',
            textShadow: `2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px ${teamColors.secondary}`,
            lineHeight: 1,
            marginTop: '8px',
          }}
        >
          {jerseyNumber || '??'}
        </Typography>
        
        {/* Position Badge (if provided) */}
        {position && (
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              right: -4,
              bgcolor: 'background.surface',
              border: `2px solid ${teamColors.primary}`,
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
            }}
          >
            <Typography sx={{ fontSize: dimensions.position, fontWeight: 'bold', color: teamColors.primary }}>
              {position}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Player Name */}
      <Typography
        level="body-xs"
        sx={{
          fontWeight: 'bold',
          textAlign: 'center',
          fontSize: dimensions.name,
          color: '#000',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          maxWidth: dimensions.jersey + 20,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {lastName}
      </Typography>
      
      {/* Team Abbreviation */}
      <Typography
        level="body-xs"
        sx={{
          fontSize: dimensions.position,
          color: teamColors.primary,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {nbaTeam}
      </Typography>
    </Box>
  );
}

