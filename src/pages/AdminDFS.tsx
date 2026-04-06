import { Box, Stack, Typography, IconButton } from '@mui/joy';
import { useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowBack, Home } from '@mui/icons-material';
import DFSPoolManager from '../components/Admin/DFSPoolManager';

export interface AdminDFSProps {
  /** When true, rendered inside /admin with shared header; use compact top padding */
  embedded?: boolean;
}

export default function AdminDFS({ embedded }: AdminDFSProps = {}) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileHeight = useMediaQuery('(max-height: 600px)');
  const isLandscapeMobile = isLandscape && isMobileHeight;

  return (
    <Box sx={{
      maxWidth: 900,
      mx: 'auto',
      px: { xs: 2, md: 3 },
      pt: embedded ? { xs: 2, md: 3 } : { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
      pb: 8,
      minHeight: '100vh',
      bgcolor: '#ffffff',
      color: '#000',
      '--joy-palette-text-primary': '#000',
      '--joy-palette-text-secondary': '#333',
      '--joy-palette-text-tertiary': '#666',
      '--joy-palette-neutral-plainColor': '#000',
      '& .MuiFormLabel-root': { color: '#000' },
      '& .MuiFormHelperText-root': { color: '#666' },
      '& .MuiInput-input': { color: '#000' },
      '& .MuiSelect-select': { color: '#000' },
    }}>
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 3, color: '#000' }}>
        <IconButton variant="plain" onClick={() => navigate('/admin')} sx={{ color: '#000' }}>
          <ArrowBack />
        </IconButton>
        <Typography level="h3" sx={{ fontWeight: 700, fontFamily: 'serif', color: '#000' }}>Create pool</Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton variant="plain" onClick={() => navigate('/feed')} aria-label="Home" sx={{ color: '#000' }}>
          <Home />
        </IconButton>
      </Stack>
      <DFSPoolManager />
    </Box>
  );
}







