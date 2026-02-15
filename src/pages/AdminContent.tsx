import { Box, Button, Stack, Typography } from '@mui/joy';
import { useMediaQuery } from '@mui/material';
import { Add } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GamesWithPosts from '../components/Admin/GamesWithPosts';
import FeedContentManager from '../components/Admin/FeedContentManager';

export default function AdminContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const createMode = searchParams.get('create') === 'true';
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileHeight = useMediaQuery('(max-height: 600px)');
  const isLandscapeMobile = isLandscape && isMobileHeight;

  const handleCreateClick = () => {
    setSearchParams({ create: 'true' });
  };

  const handleBackFromCreate = () => {
    setSearchParams({});
  };

  if (createMode) {
    return (
      <Box sx={{
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        px: { xs: 2, md: 2 },
        pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
        pb: 4,
        bgcolor: '#ffffff',
        minHeight: '100vh',
      }}>
        <FeedContentManager initialView="form" onClose={handleBackFromCreate} />
      </Box>
    );
  }

  return (
    <Box sx={{
      maxWidth: { xs: '100%', sm: 805, md: 1035 },
      mx: 'auto',
      px: { xs: 2, md: 2 },
      pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
      pb: 4,
      bgcolor: '#ffffff',
      minHeight: '100vh',
    }}>
      {/* Header with Title and Create Buttons */}
      <Stack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography level="h3" sx={{ fontWeight: 700, color: '#000', fontFamily: 'serif' }}>
          Feed Content
        </Typography>
        <Stack direction="row" gap={1}>
          <Button
            size="md"
            variant="solid"
            color="primary"
            startDecorator={<Add />}
            onClick={() => navigate('/admin/create-post')}
            sx={{
              fontWeight: 600,
              fontFamily: 'serif',
            }}
          >
            New Post (V2)
          </Button>
          <Button
            size="md"
            variant="outlined"
            color="neutral"
            startDecorator={<Add />}
            onClick={handleCreateClick}
            sx={{
              fontWeight: 600,
              fontFamily: 'serif',
            }}
          >
            Legacy Create
          </Button>
        </Stack>
      </Stack>

      {/* Games Table */}
      <GamesWithPosts />
    </Box>
  );
}

