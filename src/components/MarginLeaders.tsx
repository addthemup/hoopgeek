import { Box, Typography, Sheet, Avatar } from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { getTeamColors } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';

interface Leader {
  id: string;
  player_id: string;
  nba_player_id: number;
  team_id: number | null;
  category: string;
  value: number;
  rank: number;
  season: string;
  games_played: number;
  player_name?: string;
  team_abbreviation?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'PTS': 'PTS',
  'REB': 'REB',
  'AST': 'AST',
  'STL': 'STL',
  'BLK': 'BLK',
  'FG_PCT': 'FG%',
  'FG3_PCT': '3P%',
  'FT_PCT': 'FT%',
};

export default function MarginLeaders() {
  const { data: leaders, isLoading } = useQuery<Leader[]>({
    queryKey: ['nba-leaders'],
    queryFn: async () => {
      // Get current season
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const season = month >= 10 
        ? `${year}-${(year + 1).toString().slice(-2)}`
        : `${year - 1}-${year.toString().slice(-2)}`;

      // Fetch top 3 leaders for each category
      const categories = ['PTS', 'REB', 'AST', 'STL', 'BLK'];
      const allLeaders: Leader[] = [];

      for (const category of categories) {
        // First get leaders
        const { data: leadersData, error: leadersError } = await supabase
          .from('nba_leaders')
          .select('*')
          .eq('season', season)
          .eq('category', category)
          .order('rank', { ascending: true })
          .limit(3);

        if (leadersError) {
          console.error(`Error fetching ${category} leaders:`, leadersError);
          continue;
        }

        if (!leadersData || leadersData.length === 0) {
          continue;
        }

        // Then fetch player info for each leader
        const playerIds = leadersData.map(l => l.player_id);
        const { data: playersData, error: playersError } = await supabase
          .from('nba_players')
          .select('id, name, team_abbreviation')
          .in('id', playerIds);

        if (playersError) {
          console.error(`Error fetching players for ${category}:`, playersError);
          continue;
        }

        // Map players by id
        const playersMap = new Map(playersData?.map(p => [p.id, p]) || []);

        // Combine leaders with player data
        allLeaders.push(...leadersData.map((l: any) => {
          const player = playersMap.get(l.player_id);
          return {
            ...l,
            player_name: player?.name,
            team_abbreviation: player?.team_abbreviation,
            value: typeof l.value === 'string' ? parseFloat(l.value) : l.value, // Ensure value is a number
          };
        }));
      }

      return allLeaders;
    },
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', fontSize: '0.5rem' }}>
          Loading leaders...
        </Typography>
      </Box>
    );
  }

  if (!leaders || leaders.length === 0) {
    return (
      <Box sx={{ p: 1 }}>
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
          LEADERS
        </Typography>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', fontSize: '0.5rem' }}>
          No leaders data available
        </Typography>
      </Box>
    );
  }

  // Group by category
  const leadersByCategory: Record<string, Leader[]> = {};
  leaders.forEach(leader => {
    if (!leadersByCategory[leader.category]) {
      leadersByCategory[leader.category] = [];
    }
    leadersByCategory[leader.category].push(leader);
  });

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
        LEADERS
      </Typography>

      {Object.entries(leadersByCategory).map(([category, categoryLeaders]) => (
        <Box key={category} sx={{ mb: 0.75 }}>
          <Typography 
            level="body-xs" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.6)', 
              mb: 0.25,
              fontSize: '0.55rem',
              fontWeight: 600,
            }}
          >
            {CATEGORY_LABELS[category] || category}
          </Typography>
          
          {categoryLeaders.map((leader) => {
            const teamColors = leader.team_abbreviation 
              ? getTeamColors(leader.team_abbreviation)
              : { primary: '#666666', secondary: '#999999' };

            return (
              <Sheet
                key={leader.id}
                sx={{
                  mb: 0.15,
                  p: 0.4,
                  borderRadius: '3px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.4,
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid rgba(255, 255, 255, 0.1)`,
                  borderLeft: `2px solid ${teamColors.primary}`,
                }}
              >
                <Typography
                  level="body-xs"
                  sx={{
                    color: teamColors.primary,
                    fontWeight: 700,
                    minWidth: '12px',
                    fontSize: '0.5rem',
                  }}
                >
                  {leader.rank}
                </Typography>

                {leader.team_abbreviation && (
                  <Avatar
                    src={getTeamLogoUrl(leader.team_abbreviation)}
                    alt={leader.team_abbreviation}
                    sx={{
                      width: '12px',
                      height: '12px',
                      border: `1px solid ${teamColors.primary}`,
                      fontSize: '0.4rem',
                    }}
                  >
                    {leader.team_abbreviation.charAt(0)}
                  </Avatar>
                )}

                <Typography
                  level="body-xs"
                  sx={{
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.5rem',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {leader.player_name?.split(' ').pop() || 'N/A'}
                </Typography>

                <Typography
                  level="body-xs"
                  sx={{
                    color: '#FFD700',
                    fontWeight: 600,
                    fontSize: '0.5rem',
                    minWidth: '24px',
                    textAlign: 'right',
                  }}
                >
                  {category.includes('PCT') 
                    ? leader.value.toFixed(1) 
                    : leader.value.toFixed(0)}
                </Typography>
              </Sheet>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

