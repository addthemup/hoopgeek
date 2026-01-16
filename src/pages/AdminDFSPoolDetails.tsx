import { Box, Typography, Button } from '@mui/joy';
import { useParams, useNavigate } from 'react-router-dom';
import AdminPoolOverview from '../components/Admin/AdminPoolOverview';

export default function AdminDFSPoolDetails() {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/admin/dfs');
  };

  if (!poolId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography level="h4">Invalid Pool ID</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to Pools
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
      <AdminPoolOverview poolId={poolId} onBack={handleBack} />
    </Box>
  );
}

