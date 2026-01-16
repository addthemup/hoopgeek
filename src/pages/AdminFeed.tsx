import { Box, Typography, Card, CardContent, Alert } from '@mui/joy';
import { useMediaQuery } from '@mui/material';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { CircularProgress } from '@mui/joy';

export default function AdminFeed() {
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileHeight = useMediaQuery('(max-height: 600px)');
  const isLandscapeMobile = isLandscape && isMobileHeight;
  
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  if (isAdminLoading) {
    return (
      <Box sx={{
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        px: { xs: 2, md: 2 },
        pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
        pb: 4,
        bgcolor: '#000000',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={{
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        px: { xs: 2, md: 2 },
        pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
        pb: 4,
        bgcolor: '#000000',
        minHeight: '100vh',
      }}>
        <Alert color="danger">
          <Typography>You do not have permission to access this page.</Typography>
        </Alert>
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
      bgcolor: '#000000',
      minHeight: '100vh',
    }}>
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <Typography level="h2" sx={{ color: '#FFFFFF', mb: 1 }}>
              Feed Page Admin
            </Typography>
            <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
              This page is a placeholder. Feed management features will be available here in a future update.
            </Typography>
          </Box>

          <Alert color="warning" sx={{ bgcolor: '#3a2a1a', borderColor: '#5a4a3a' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              🚧 Under Construction - Feed management tools coming soon
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}

