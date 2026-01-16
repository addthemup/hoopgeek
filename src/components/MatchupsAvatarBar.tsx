import { Box, Typography } from '@mui/joy';
import AvatarBar from './AvatarBar';

interface FantasyTeam {
  id: string;
  team_name: string;
  primary_color?: string;
  secondary_color?: string;
  wins?: number;
  losses?: number;
}

interface Matchup {
  id: string;
  week_number: number;
  status: string;
  fantasy_team1_id: string;
  fantasy_team2_id: string;
  fantasy_team1_score: number;
  fantasy_team2_score: number;
  team1?: FantasyTeam;
  team2?: FantasyTeam;
}

interface MatchupsAvatarBarProps {
  matchups: Matchup[];
  isLoading?: boolean;
  selectedMatchupId?: string | null;
  onMatchupClick?: (matchupId: string) => void;
}

export default function MatchupsAvatarBar({ 
  matchups, 
  isLoading = false,
  selectedMatchupId,
  onMatchupClick 
}: MatchupsAvatarBarProps) {
  // Filter to only show matchups with both teams
  const displayMatchups = matchups?.filter(m => m.team1 && m.team2) || [];

  return (
    <AvatarBar
      items={displayMatchups}
      isLoading={isLoading}
      selectedId={selectedMatchupId}
      onItemClick={onMatchupClick}
      getItemId={(matchup) => matchup.id}
      minItems={1}
      getBorderStyles={(matchup, index, hasData, isSelected) => {
        if (!hasData || !matchup) {
          return {
            border: '3px dashed',
            borderColor: 'text.primary',
            bgcolor: '#000000',
          };
        }

        const isFinal = matchup.status === 'completed';
        const isLive = matchup.status === 'in_progress';

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
      renderAvatar={(matchup, index, hasData) => {
        if (!hasData || !matchup) {
          return null;
        }

        const isFinal = matchup.status === 'completed';
        const isLive = matchup.status === 'in_progress';
        const team1Color = matchup.team1?.primary_color || '#3B82F6';
        const team2Color = matchup.team2?.primary_color || '#EF4444';

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
                bgcolor: team1Color,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '50%',
                height: '100%',
                bgcolor: team2Color,
              }}
            />
            
            {/* Team initials */}
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
              <Typography
                sx={{
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {matchup.team1?.team_name?.substring(0, 2).toUpperCase() || 'T1'}
              </Typography>
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
              <Typography
                sx={{
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {matchup.team2?.team_name?.substring(0, 2).toUpperCase() || 'T2'}
              </Typography>
            </Box>

            {/* Vertical divider line */}
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: '10%',
                bottom: '30%',
                width: '1px',
                bgcolor: 'rgba(255, 255, 255, 0.5)',
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
                {matchup.fantasy_team1_score.toFixed(0)}-{matchup.fantasy_team2_score.toFixed(0)}
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
              {isLive ? 'LIVE' : isFinal ? 'FINAL' : `WK ${matchup.week_number}`}
            </Box>
          </>
        );
      }}
    />
  );
}

