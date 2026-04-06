/**
 * Full-page profile hub — same body as the profile drawer; deep link / bookmark friendly.
 */

import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/joy';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import { useAuth } from '../hooks/useAuth';
import { SlipBuilderProvider } from '../contexts/SlipBuilderContext';
import ProfileHubContent from '../components/Feed/ProfileHubContent';
import { CONTENT_MAX_WIDTH } from '../constants/layout';
import { profileDisplayLabel } from '../lib/profileLabel';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const slipRef = useRef<(() => void) | null>(null);

  if (!user) {
    return (
      <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', p: 3 }}>
        <Typography level="h3" sx={{ mb: 2 }}>
          Profile
        </Typography>
        <Typography level="body-md" sx={{ mb: 2, color: 'text.secondary' }}>
          Sign in to view your profile, saved posts, and tools.
        </Typography>
        <Button variant="solid" onClick={() => navigate('/feed')}>
          Back to feed
        </Button>
      </Box>
    );
  }

  const title = profileDisplayLabel(user);

  return (
    <SlipBuilderProvider onLegAddedRef={slipRef}>
      <Box
        sx={{
          maxWidth: CONTENT_MAX_WIDTH,
          mx: 'auto',
          width: '100%',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          pb: 4,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
            py: 2,
            px: { xs: 2, sm: 3 },
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.body',
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          <Button
            variant="plain"
            color="neutral"
            size="sm"
            startDecorator={<ArrowBackIosNewRounded sx={{ fontSize: 16 }} />}
            onClick={() => navigate('/feed')}
          >
            Feed
          </Button>
          <Typography level="h4" sx={{ flex: 1, minWidth: 0 }}>
            {title}
          </Typography>
        </Box>

        <ProfileHubContent variant="page" />
      </Box>
    </SlipBuilderProvider>
  );
}
