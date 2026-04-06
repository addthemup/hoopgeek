/**
 * Renders the same admin view as /admin?view=… — used on the full Admin page
 * and embedded in the profile drawer Admin hub tabs.
 */

import { Box, Alert, Typography, CircularProgress } from '@mui/joy';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import AdminFeed from '../../pages/AdminFeed';
import AdminPlayer from '../../pages/AdminPlayer';
import AdminTeam from '../../pages/AdminTeam';
import AdminProspects from '../../pages/AdminProspects';
import AdminDraft from '../../pages/AdminDraft';
import AdminMockDraft from '../../pages/AdminMockDraft';
import AdminGame from '../../pages/AdminGame';
import PostCreator from '../../pages/PostCreator';
import AdminDFS from '../../pages/AdminDFS';
import AdminAnalytics from '../../pages/AdminAnalytics';
import AdminProfile from '../../pages/AdminProfile';

export type AdminView =
  | 'ui'
  | 'profile'
  | 'player'
  | 'team'
  | 'prospects'
  | 'draft'
  | 'mock-draft'
  | 'game'
  | 'create-post'
  | 'dfs'
  | 'analytics';

export interface AdminViewBodyProps {
  view: AdminView;
  /** When true, drawer embedding: constrain width and avoid full-page chrome assumptions */
  embedded?: boolean;
}

export function AdminViewBody({ view, embedded = false }: AdminViewBodyProps) {
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  const loading = (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4, minHeight: 120 }}>
      <CircularProgress />
    </Box>
  );

  const denied = (
    <Alert color="danger" sx={{ my: 1 }}>
      <Typography>You do not have permission to access this.</Typography>
    </Alert>
  );

  let body: React.ReactNode;

  if (isAdminLoading) {
    body = loading;
  } else if (!isAdmin) {
    body = denied;
  } else {
    switch (view) {
      case 'player':
        body = <AdminPlayer />;
        break;
      case 'team':
        body = <AdminTeam />;
        break;
      case 'prospects':
        body = <AdminProspects />;
        break;
      case 'draft':
        body = <AdminDraft />;
        break;
      case 'mock-draft':
        body = <AdminMockDraft />;
        break;
      case 'game':
        body = <AdminGame />;
        break;
      case 'create-post':
        body = <PostCreator returnPath="/admin" />;
        break;
      case 'dfs':
        body = <AdminDFS embedded />;
        break;
      case 'analytics':
        body = <AdminAnalytics embedded />;
        break;
      case 'profile':
        body = <AdminProfile />;
        break;
      case 'ui':
      default:
        body = <AdminFeed />;
        break;
    }
  }

  if (!embedded) {
    return <>{body}</>;
  }

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        '& .MuiBox-root': { maxWidth: '100%' },
      }}
    >
      {body}
    </Box>
  );
}
