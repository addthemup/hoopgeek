import React from 'react';
import { Box, Typography, Card, CardContent, Avatar } from '@mui/joy';
import { getTeamColors } from '../utils/nbaTeamColors';

interface CourtPlayer {
  id: string;
  name: string;
  position: string;
  jersey_number?: string;
  team_abbreviation: string;
}

interface BasketballCourtMatchupProps {
  homeTeam: {
    name: string;
    abbreviation: string;
    starters: CourtPlayer[];
    bench: CourtPlayer[];
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    starters: CourtPlayer[];
    bench: CourtPlayer[];
  };
  weekNumber: number;
}

export default function BasketballCourtMatchup({
  homeTeam,
  awayTeam,
  weekNumber
}: BasketballCourtMatchupProps) {
  
  const homeColors = getTeamColors(homeTeam.abbreviation);
  const awayColors = getTeamColors(awayTeam.abbreviation);

  const renderJersey = (player: CourtPlayer, colors: any, side: 'home' | 'away') => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          position: 'relative',
        }}
      >
        {/* Jersey */}
        <Box
          sx={{
            width: 60,
            height: 60,
            borderRadius: '8px',
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            border: '2px solid',
            borderColor: colors.secondary,
            position: 'relative',
          }}
        >
          {/* Jersey Number */}
          <Typography
            sx={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#FFFFFF',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            {player.jersey_number || '??'}
          </Typography>
          
          {/* Position Badge */}
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: 'background.surface',
              border: '2px solid',
              borderColor: colors.primary,
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 'bold', color: colors.primary }}>
              {player.position}
            </Typography>
          </Box>
        </Box>

        {/* Player Name */}
        <Typography
          level="body-xs"
          sx={{
            fontWeight: 'bold',
            textAlign: 'center',
            maxWidth: 80,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {player.name.split(' ').pop()}
        </Typography>
      </Box>
    );
  };

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography level="h4" sx={{ fontWeight: 'bold' }}>
            🏀 Week {weekNumber} Matchup
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
                {homeTeam.name}
              </Typography>
              <Typography level="body-sm" color="neutral">
                Home
              </Typography>
            </Box>
            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'neutral.500' }}>
              VS
            </Typography>
            <Box sx={{ textAlign: 'left' }}>
              <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
                {awayTeam.name}
              </Typography>
              <Typography level="body-sm" color="neutral">
                Away
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Basketball Court */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            minHeight: 600,
            background: 'linear-gradient(180deg, #d4a373 0%, #c4935a 100%)', // Court color
            borderRadius: '8px',
            border: '4px solid #8B4513',
            padding: 3,
            display: 'flex',
            gap: 4,
          }}
        >
          {/* Left Side - Starters */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography
              level="h6"
              sx={{
                fontWeight: 'bold',
                textAlign: 'center',
                color: 'white',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                mb: 2,
              }}
            >
              STARTERS
            </Typography>

            {/* Home Starters */}
            <Box>
              <Typography
                level="body-sm"
                sx={{
                  fontWeight: 'bold',
                  color: homeColors.primary,
                  textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                  mb: 1,
                  textAlign: 'center',
                }}
              >
                {homeTeam.abbreviation}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 2,
                  justifyItems: 'center',
                }}
              >
                {homeTeam.starters.slice(0, 5).map((player) => (
                  <React.Fragment key={player.id}>
                    {renderJersey(player, homeColors, 'home')}
                  </React.Fragment>
                ))}
              </Box>
            </Box>

            {/* Center Line */}
            <Box
              sx={{
                height: 2,
                bgcolor: 'white',
                opacity: 0.5,
                my: 2,
              }}
            />

            {/* Away Starters */}
            <Box>
              <Typography
                level="body-sm"
                sx={{
                  fontWeight: 'bold',
                  color: awayColors.primary,
                  textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                  mb: 1,
                  textAlign: 'center',
                }}
              >
                {awayTeam.abbreviation}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 2,
                  justifyItems: 'center',
                }}
              >
                {awayTeam.starters.slice(0, 5).map((player) => (
                  <React.Fragment key={player.id}>
                    {renderJersey(player, awayColors, 'away')}
                  </React.Fragment>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Vertical Divider */}
          <Box
            sx={{
              width: 2,
              bgcolor: 'white',
              opacity: 0.5,
            }}
          />

          {/* Right Side - Bench/Rotation */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography
              level="h6"
              sx={{
                fontWeight: 'bold',
                textAlign: 'center',
                color: 'white',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                mb: 2,
              }}
            >
              ROTATION
            </Typography>

            {/* Home Bench */}
            <Box>
              <Typography
                level="body-sm"
                sx={{
                  fontWeight: 'bold',
                  color: homeColors.primary,
                  textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                  mb: 1,
                  textAlign: 'center',
                }}
              >
                {homeTeam.abbreviation}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 2,
                  justifyItems: 'center',
                }}
              >
                {homeTeam.bench.slice(0, 6).map((player) => (
                  <React.Fragment key={player.id}>
                    {renderJersey(player, homeColors, 'home')}
                  </React.Fragment>
                ))}
              </Box>
            </Box>

            {/* Center Line */}
            <Box
              sx={{
                height: 2,
                bgcolor: 'white',
                opacity: 0.5,
                my: 2,
              }}
            />

            {/* Away Bench */}
            <Box>
              <Typography
                level="body-sm"
                sx={{
                  fontWeight: 'bold',
                  color: awayColors.primary,
                  textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                  mb: 1,
                  textAlign: 'center',
                }}
              >
                {awayTeam.abbreviation}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 2,
                  justifyItems: 'center',
                }}
              >
                {awayTeam.bench.slice(0, 6).map((player) => (
                  <React.Fragment key={player.id}>
                    {renderJersey(player, awayColors, 'away')}
                  </React.Fragment>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Matchup Stats Placeholder */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-around', gap: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography level="h3" sx={{ fontWeight: 'bold', color: homeColors.primary }}>
              0.0
            </Typography>
            <Typography level="body-sm" color="neutral">
              Projected Points
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'neutral.500' }}>
              VS
            </Typography>
            <Typography level="body-sm" color="neutral">
              Week {weekNumber}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography level="h3" sx={{ fontWeight: 'bold', color: awayColors.primary }}>
              0.0
            </Typography>
            <Typography level="body-sm" color="neutral">
              Projected Points
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

