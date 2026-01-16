import { Box, Typography, Avatar } from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { getTeamColors } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';

interface TeamPlayer {
  player_id: string | null;
  nba_player_id: number;
  player_name: string;
  team: string;
  player_position: string;
  jersey_number: string;
  salary: number;
  avg_fantasy_points: number;
  games_played: number;
}

export default function MarginTeamOfWeek() {
  const { data: teamPlayers, isLoading } = useQuery<TeamPlayer[]>({
    queryKey: ['dfs-team-of-week'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dfs_team_of_week');

      if (error) {
        console.error('Error fetching team of week:', error);
        return [];
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', fontSize: '0.5rem' }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!teamPlayers || teamPlayers.length === 0) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', fontSize: '0.5rem' }}>
          No team data
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0.5 }}>
      <Typography 
        level="title-xs" 
        sx={{ 
          color: '#FFD700', 
          mb: 0.5, 
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.6rem',
          letterSpacing: '0.05em',
        }}
      >
        🏆 TEAM OF THE WEEK
      </Typography>

      {teamPlayers.slice(0, 5).map((player) => {
        const teamColors = getTeamColors(player.team);

        return (
          <Box
            key={player.player_id}
            sx={{
              mb: 0.4,
              p: 0.4,
              borderRadius: '3px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              gap: 0.4,
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              border: `1px solid rgba(255, 255, 255, 0.1)`,
              borderLeft: `2px solid ${teamColors.primary}`,
            }}
          >
            <Avatar
              src={getTeamLogoUrl(player.team)}
              alt={player.team}
              sx={{
                width: '16px',
                height: '16px',
                border: `1px solid ${teamColors.primary}`,
                fontSize: '0.4rem',
              }}
            >
              {player.team.charAt(0)}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                level="body-xs"
                sx={{
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.5rem',
                  lineHeight: 1.1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {player.player_name.split(' ').pop()}
              </Typography>
              <Typography
                level="body-xs"
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.45rem',
                  lineHeight: 1.1,
                }}
              >
                {player.player_position}
              </Typography>
            </Box>

            <Typography
              level="body-xs"
              sx={{
                color: '#FFD700',
                fontWeight: 600,
                fontSize: '0.5rem',
                minWidth: '28px',
                textAlign: 'right',
              }}
            >
              {player.avg_fantasy_points.toFixed(1)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

