/**
 * Single /admin page: view switching via ?view= (ui | create-post | dfs | analytics).
 * Same layout as /feed/ with inset drawer (UI, Create post, Create pool, View analytics, Log out).
 */

import { useSearchParams } from 'react-router-dom';
import { Box, Alert, Typography, CircularProgress } from '@mui/joy';
import AdminLayout from '../components/Feed/AdminLayout';
import { useIsAdmin } from '../hooks/useIsAdmin';
import AdminFeed from './AdminFeed';
import PostCreator from './PostCreator';
import AdminDFS from './AdminDFS';
import AdminAnalytics from './AdminAnalytics';

export type AdminView = 'ui' | 'create-post' | 'dfs' | 'analytics';

function AdminContent() {
  const [searchParams] = useSearchParams();
  const view = (searchParams.get('view') as AdminView) || 'ui';
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  if (isAdminLoading) {
    return (
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 1.5, sm: 2, md: 3 },
          pt: { xs: 2, md: 3 },
          pb: 6,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 1.5, sm: 2, md: 3 },
          pt: { xs: 2, md: 3 },
          pb: 6,
        }}
      >
        <Alert color="danger">
          <Typography>You do not have permission to access this page.</Typography>
        </Alert>
      </Box>
    );
  }

  switch (view) {
    case 'create-post':
      return <PostCreator returnPath="/admin" />;
    case 'dfs':
      return <AdminDFS embedded />;
    case 'analytics':
      return <AdminAnalytics embedded />;
    case 'ui':
    default:
      return <AdminFeed />;
  }
}

export default function Admin() {
  return (
    <AdminLayout>
      <AdminContent />
    </AdminLayout>
  );
}
