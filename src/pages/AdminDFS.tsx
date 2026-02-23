import { Box } from '@mui/joy';
import { useMediaQuery } from '@mui/material';
import DFSPoolManager from '../components/Admin/DFSPoolManager';

export interface AdminDFSProps {
  /** When true, rendered inside /admin with shared header; use compact top padding */
  embedded?: boolean;
}

export default function AdminDFS({ embedded }: AdminDFSProps = {}) {
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileHeight = useMediaQuery('(max-height: 600px)');
  const isLandscapeMobile = isLandscape && isMobileHeight;

  return (
    <Box sx={{
      maxWidth: { xs: '100%', sm: 805, md: 1035 },
      mx: 'auto',
      px: { xs: 2, md: 2 },
      pt: embedded ? { xs: 2, md: 3 } : { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
      pb: 4,
      bgcolor: '#ffffff',
      minHeight: embedded ? undefined : '100vh',
    }}>
      <DFSPoolManager />
    </Box>
  );
}







