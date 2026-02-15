import { Box, Typography, Button } from '@mui/joy';
import { useParams, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import GamePostsView from '../components/Admin/GamePostsView';

export default function AdminContentGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileHeight = useMediaQuery('(max-height: 600px)');
  const isLandscapeMobile = isLandscape && isMobileHeight;

  const handleBack = () => {
    navigate('/admin/create-post');
  };

  if (!gameId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography level="h4">Invalid Game ID</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to Games
        </Button>
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
      <GamePostsView gameId={gameId} onBack={handleBack} />
    </Box>
  );
}

