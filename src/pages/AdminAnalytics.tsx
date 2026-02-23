import { Box, Sheet, Typography } from '@mui/joy';
import { useMediaQuery } from '@mui/material';
import InvestorDashboard from './InvestorDashboard';
import { userSettingsStyles } from '../styles/userSettingsStyles';

export interface AdminAnalyticsProps {
  /** When true, rendered inside /admin with shared header; use compact top padding */
  embedded?: boolean;
}

export default function AdminAnalytics({ embedded }: AdminAnalyticsProps = {}) {
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
      bgcolor: '#f8f9fa',
      minHeight: embedded ? undefined : '100vh',
    }}>
      <Sheet sx={userSettingsStyles.card}>
        <Box sx={userSettingsStyles.analyticsCardHeader}>
          <Typography sx={userSettingsStyles.cardHeaderTitle}>
            📊 Analytics Dashboard
          </Typography>
        </Box>
        <Box sx={userSettingsStyles.cardBody}>
          <InvestorDashboard />
        </Box>
      </Sheet>
    </Box>
  );
}







