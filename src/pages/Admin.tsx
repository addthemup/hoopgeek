/**
 * Single /admin page: view switching via ?view= (ui | create-post | dfs | analytics).
 * Same layout as /feed/ with inset drawer (UI, Create post, Create pool, View analytics, Log out).
 */

import { useSearchParams } from 'react-router-dom';
import { Box } from '@mui/joy';
import AdminLayout from '../components/Feed/AdminLayout';
import { CONTENT_MAX_WIDTH } from '../constants/layout';
import { AdminViewBody, type AdminView } from '../components/Admin/AdminViewBody';

export type { AdminView };

function AdminContent() {
  const [searchParams] = useSearchParams();
  const view = (searchParams.get('view') as AdminView) || 'create-post';

  return (
    <Box
      sx={{
        maxWidth: CONTENT_MAX_WIDTH,
        mx: 'auto',
        px: { xs: 1.5, sm: 2, md: 3 },
        pt: { xs: 2, md: 3 },
        pb: 6,
      }}
    >
      <AdminViewBody view={view} />
    </Box>
  );
}

export default function Admin() {
  return (
    <AdminLayout>
      <AdminContent />
    </AdminLayout>
  );
}
