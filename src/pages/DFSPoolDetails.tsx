import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Stack,
} from '@mui/joy';
import { ArrowBack } from '@mui/icons-material';
import { useMediaQuery } from '@mui/material';
import PoolDetailsTab from '../components/DFS/PoolDetailsTab';

export default function DFSPoolDetails() {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get view and entryId from URL params
  const view = (searchParams.get('view') || 'details') as 'details' | 'leaderboard' | 'entry' | 'lineup-builder';
  const entryId = searchParams.get('entryId');

  // Detect landscape mobile orientation to adjust padding
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isLandscapeMobile = isMobile && isLandscape;

  const handleBack = () => {
    navigate('/dfs');
  };

  return (
    <Box sx={{ 
      bgcolor: '#000000',
      minHeight: '100vh',
      overflowX: 'hidden',
      width: '100%',
    }}>
      {/* Main Container */}
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        minWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        pt: isLandscapeMobile 
          ? '60px'
          : { xs: '113px', md: '132px' },
        pb: 2,
        px: { xs: 0, sm: 2, md: 2 },
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <Stack spacing={4} sx={{ px: { xs: 2, sm: 0 } }}>
          {/* Back Button */}
          <Box>
            <Button
              variant="plain"
              color="neutral"
              startDecorator={<ArrowBack />}
              onClick={handleBack}
              size="sm"
              sx={{ 
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              Back to DFS
            </Button>
          </Box>

          {/* Pool Details Tab */}
          <PoolDetailsTab
            poolId={poolId || null}
            initialView={view}
            entryId={entryId || null}
            onBack={handleBack}
          />
        </Stack>
      </Box>
    </Box>
  );
}

