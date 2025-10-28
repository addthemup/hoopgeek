import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
} from '@mui/joy';
import {
  ArrowBack,
} from '@mui/icons-material';
import DFSLineupBuilder from '../components/DFS/DFSLineupBuilder';

export default function DFSLineup() {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto', p: { xs: 1, sm: 2, md: 3 } }}>
      {/* Back Button */}
        <Button
          variant="plain"
          color="neutral"
          startDecorator={<ArrowBack />}
          onClick={() => navigate('/dfs')}
          size="sm"
          sx={{ mb: { xs: 1, sm: 2 }, fontSize: { xs: '0.8rem', sm: '1rem' } }}
        >
          Back to Contests
        </Button>

      {/* Lineup Builder */}
      <DFSLineupBuilder
        poolId={poolId}
        onSuccess={() => navigate('/dfs')}
        onPlayerClick={(nbaPlayerId) => navigate(`/player/${nbaPlayerId}`)}
      />
    </Box>
  );
}
