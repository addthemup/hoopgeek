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
    <Box sx={{ maxWidth: 1600, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Back Button */}
        <Button
          variant="plain"
          color="neutral"
          startDecorator={<ArrowBack />}
          onClick={() => navigate('/dfs')}
          sx={{ mb: 2 }}
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
