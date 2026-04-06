/**
 * Draft prospect page — same format as PlayerPage: search bar + top nav (ProspectPageLayout),
 * then prospect header (back, avatar, name, school/position/draft year) and posts linked to this prospect below.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  CircularProgress,
} from '@mui/joy';
import { ArrowBack } from '@mui/icons-material';
import { supabase } from '../utils/supabase';
import { CONTENT_MAX_WIDTH } from '../constants/layout';
import ProspectPageLayout from '../components/Feed/ProspectPageLayout';
import ProspectRankingOverTimeModule from '../components/Feed/ProspectRankingOverTimeModule';
import { FeedCard } from './Highlights';
import type { FeedPost } from '../types/feed';

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
  image_url: string | null;
}

export default function ProspectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: prospect, isLoading, error } = useQuery({
    queryKey: ['prospect', id],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('draft_prospects')
        .select('id, draft_year, player_name_full, player_slug, school_team, position_primary, position_secondary, height_ft_in, height_inches, weight_lbs, image_url')
        .eq('id', id!)
        .single();
      if (e) throw e;
      return data as ProspectData;
    },
    enabled: !!id,
  });

  const { data: prospectFeedPosts, isLoading: feedPostsLoading } = useQuery<FeedPost[]>({
    queryKey: ['prospect-feed-posts', id],
    queryFn: async () => {
      if (!id) return [];
      try {
        const { data, error: feedErr } = await supabase
          .from('feed_posts')
          .select('*')
          .eq('status', 'published')
          .contains('draft_prospect_ids', [id])
          .order('published_at', { ascending: false })
          .limit(50);
        if (feedErr) {
          console.error('Error fetching prospect feed posts:', feedErr);
          return [];
        }
        return (data ?? []) as FeedPost[];
      } catch (e) {
        console.error('Prospect feed posts query failed (run migration 20260311000000_feed_posts_draft_prospect_ids if needed):', e);
        return [];
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });

  if (!id) {
    return (
      <ProspectPageLayout>
        <Box sx={{ p: 3 }}>
          <Typography>Invalid prospect.</Typography>
        </Box>
      </ProspectPageLayout>
    );
  }

  if (isLoading) {
    return (
      <ProspectPageLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size="lg" sx={{ '--CircularProgress-trackColor': '#222', '--CircularProgress-progressColor': '#FFC72C' }} />
        </Box>
      </ProspectPageLayout>
    );
  }

  if (error || !prospect) {
    return (
      <ProspectPageLayout>
        <Box sx={{ p: 3 }}>
          <Typography>Prospect not found.</Typography>
        </Box>
      </ProspectPageLayout>
    );
  }

  const onBack = () => navigate(-1);

  const drawerModules = [
    { name: 'ranking_over_time', content: <ProspectRankingOverTimeModule prospectId={id} /> },
  ];

  const drawerHeaderContent = (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 'md',
        bgcolor: '#111318',
        border: '1px solid #2A2D33',
        color: '#FFFFFF',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          component="img"
          src={prospect.image_url ?? undefined}
          alt={prospect.player_name_full}
          sx={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #3B3F47',
            bgcolor: '#1C2027',
            flexShrink: 0,
          }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography level="title-md" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
              {prospect.player_name_full}
            </Typography>
            {prospect.position_primary && (
              <Chip
                size="sm"
                variant="soft"
                sx={{
                  bgcolor: '#21252D',
                  border: '1px solid #3B3F47',
                  color: '#E8EAF0',
                  fontWeight: 700,
                }}
              >
                {prospect.position_primary}
              </Chip>
            )}
          </Box>
          <Typography level="body-sm" sx={{ color: '#B9BEC9' }}>
            {[prospect.school_team, prospect.draft_year ? `${prospect.draft_year} Draft` : null]
              .filter(Boolean)
              .join(' • ') || 'Prospect'}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, mt: 1.1, flexWrap: 'wrap' }}>
        {prospect.height_ft_in && (
          <Typography level="body-sm" sx={{ color: '#E8EAF0' }}>
            <Box component="span" sx={{ fontWeight: 700, color: '#FFC72C' }}>{prospect.height_ft_in}</Box> HT
          </Typography>
        )}
        {prospect.weight_lbs && (
          <Typography level="body-sm" sx={{ color: '#E8EAF0' }}>
            <Box component="span" sx={{ fontWeight: 700, color: '#60D394' }}>{prospect.weight_lbs}</Box> WT
          </Typography>
        )}
        {prospect.position_secondary && (
          <Typography level="body-sm" sx={{ color: '#E8EAF0' }}>
            <Box component="span" sx={{ fontWeight: 700, color: '#FFB347' }}>{prospect.position_secondary}</Box> SEC POS
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <ProspectPageLayout drawerModules={drawerModules} drawerHeaderContent={drawerHeaderContent}>
      <Box
        sx={{
          bgcolor: '#ffffff',
          minHeight: '100vh',
          overflowX: 'hidden',
          width: '100%',
        }}
      >
        <Box
          sx={{
            maxWidth: CONTENT_MAX_WIDTH,
            minWidth: 0,
            mx: 'auto',
            pt: { xs: '12px', md: '16px' },
            pb: 2,
            px: 2,
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden',
          }}
        >
          {/* Prospect Header: Back + Avatar left, details right (match PlayerPage) */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: { xs: 1.5, md: 2 },
              mb: 0.5,
              px: { xs: 2, sm: 0 },
            }}
          >
            <IconButton
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={onBack}
              sx={{
                minWidth: 'auto',
                width: { xs: 28, md: 32 },
                height: { xs: 28, md: 32 },
                borderColor: '#333333',
                color: '#333333',
                flexShrink: 0,
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.06)' },
              }}
              title="Back"
            >
              <ArrowBack sx={{ fontSize: { xs: '1rem', md: '1.125rem' } }} />
            </IconButton>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, position: 'relative', flexShrink: 0 }}>
              <Box
                sx={{
                  position: 'relative',
                  width: { xs: 77, md: 83 },
                  height: { xs: 77, md: 83 },
                  borderRadius: '50%',
                  border: '3px solid',
                  borderColor: 'neutral.400',
                  bgcolor: 'neutral.200',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <Avatar
                  src={prospect.image_url ?? undefined}
                  alt={prospect.player_name_full}
                  sx={{ width: '100%', height: '100%', bgcolor: 'neutral.700' }}
                />
              </Box>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', textAlign: 'left' }}>
              <Box sx={{ mb: 1, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography
                    level="h1"
                    sx={{
                      fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' },
                      fontWeight: 'bold',
                      lineHeight: 1.2,
                      m: 0,
                      p: 0,
                      color: '#1a1a1a',
                    }}
                  >
                    {prospect.player_name_full}
                  </Typography>
                  {prospect.position_primary && (
                    <Chip
                      variant="soft"
                      size="sm"
                      sx={{
                        fontWeight: 'bold',
                        fontSize: { xs: '0.75rem', md: '0.875rem' },
                        color: '#333333',
                        bgcolor: 'rgba(0, 0, 0, 0.08)',
                        borderColor: 'rgba(0, 0, 0, 0.12)',
                      }}
                    >
                      {prospect.position_primary}
                    </Chip>
                  )}
                </Box>
              </Box>
              <Typography level="body-md" sx={{ color: '#555555', fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
                {[prospect.school_team, prospect.draft_year ? `${prospect.draft_year} Draft` : null].filter(Boolean).join(' • ') || '—'}
              </Typography>
            </Box>
          </Box>

          {/* Prospect Posts Feed (same as PlayerPage) */}
          <Box sx={{ mt: 2, px: { xs: 2, sm: 0 } }}>
            {feedPostsLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size="lg" sx={{ '--CircularProgress-trackColor': '#222', '--CircularProgress-progressColor': '#FFC72C' }} />
              </Box>
            )}

            {!feedPostsLoading && (!prospectFeedPosts || prospectFeedPosts.length === 0) && (
              <Box sx={{ textAlign: 'center', py: 8, px: 4 }}>
                <Typography level="h3" sx={{ color: '#1a1a1a', fontFamily: '"Libre Baskerville", serif', mb: 1 }}>
                  No stories yet
                </Typography>
                <Typography level="body-md" sx={{ color: '#555555', maxWidth: 400, mx: 'auto' }}>
                  Stories featuring {prospect.player_name_full} will appear here.
                </Typography>
              </Box>
            )}

            {!feedPostsLoading && prospectFeedPosts && prospectFeedPosts.length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                  gap: { xs: 2, md: 2.5 },
                }}
              >
                {prospectFeedPosts.map((post) => (
                  <FeedCard key={post.id} post={post} onClick={() => navigate(`/feed/${post.slug}`)} />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </ProspectPageLayout>
  );
}
