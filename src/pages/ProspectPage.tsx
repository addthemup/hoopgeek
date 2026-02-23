import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Avatar, Stack } from '@mui/joy';
import { ArrowBack } from '@mui/icons-material';
import IconButton from '@mui/joy/IconButton';
import { supabase } from '../utils/supabase';

interface ProspectData {
  id: string;
  draft_year: number;
  player_name_full: string;
  player_slug: string;
  school_team: string | null;
  position_primary: string | null;
  position_secondary: string | null;
  height_ft_in: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
}

export default function ProspectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: prospect, isLoading, error } = useQuery({
    queryKey: ['prospect', id],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('draft_prospects')
        .select('id, draft_year, player_name_full, player_slug, school_team, position_primary, position_secondary, height_ft_in, height_inches, weight_lbs')
        .eq('id', id!)
        .single();
      if (e) throw e;
      return data as ProspectData;
    },
    enabled: !!id,
  });

  if (!id) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Invalid prospect.</Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  if (error || !prospect) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Prospect not found.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton
          variant="plain"
          color="neutral"
          onClick={() => navigate(-1)}
          sx={{ '--IconButton-size': '40px' }}
        >
          <ArrowBack />
        </IconButton>
        <Avatar
          size="lg"
          sx={{ bgcolor: 'neutral.700', width: 64, height: 64 }}
        />
        <Box>
          <Typography level="h3" sx={{ fontWeight: 700 }}>
            {prospect.player_name_full}
          </Typography>
          <Typography level="body-md" sx={{ color: 'text.secondary' }}>
            {prospect.school_team || '—'} • {prospect.position_primary || 'N/A'}
            {prospect.draft_year ? ` • ${prospect.draft_year} Draft` : ''}
          </Typography>
        </Box>
      </Stack>
      {/* Placeholder for future content (rankings, stats, avatars, etc.) */}
    </Box>
  );
}
