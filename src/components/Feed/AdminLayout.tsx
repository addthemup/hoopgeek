/**
 * Admin layout: same look as /feed/ — fixed header bar with search + Home
 * button, inset drawer with quick actions (Create post, Create pool,
 * View analytics, Logout). Main content uses the same content wrapper as feed.
 */

import React, { useState } from 'react';
import { useMediaQuery } from '@mui/material';
import {
  Box,
  Button,
  Drawer,
  Sheet,
  DialogTitle,
  DialogContent,
  ModalClose,
  IconButton,
  Typography,
} from '@mui/joy';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import { HiOutlineHome } from 'react-icons/hi';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Logout from '@mui/icons-material/Logout';
import Add from '@mui/icons-material/Add';
import MonetizationOn from '@mui/icons-material/MonetizationOn';
import Analytics from '@mui/icons-material/Analytics';
import Dashboard from '@mui/icons-material/Dashboard';
import Person from '@mui/icons-material/Person';
import Groups from '@mui/icons-material/Groups';
import School from '@mui/icons-material/School';
import SportsBasketball from '@mui/icons-material/SportsBasketball';
import Home from '@mui/icons-material/Home';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import PlayerTeamSearchBar from '../PlayerTeamSearchBar';
import { useAuth } from '../../hooks/useAuth';
import { CONTENT_MAX_WIDTH, INSET_DRAWER_CONTENT_SX } from '../../constants/layout';
import DrawerProfileIdentityTrigger from './DrawerProfileIdentityTrigger';
import ProfileHubContent from './ProfileHubContent';
import AdminHubContent from './AdminHubContent';
import { SlipBuilderProvider } from '../../contexts/SlipBuilderContext';
import { useIsSuperAdmin } from '../../hooks/useIsAdmin';

const FEED_HEADER_BAR_HEIGHT = 52;

export interface AdminLayoutProps {
  children: React.ReactNode;
}

type AdminView =
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

const drawerBtnActiveSx = { bgcolor: '#FFC72C', color: '#000', '&:hover': { bgcolor: '#FFD700' } };
const drawerBtnInactiveSx = { color: '#FFFFFF', '&:hover': { borderColor: 'primary.500', color: 'primary.500' } };

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeView = (searchParams.get('view') as AdminView) || 'create-post';
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [drawerOpen, setDrawerOpen] = useState(
    () => (location.state as { openDrawer?: boolean })?.openDrawer === true
  );
  const [drawerProfileMode, setDrawerProfileMode] = useState(false);
  const [drawerHubTab, setDrawerHubTab] = useState<'profile' | 'admin'>('profile');
  const { signOut, user } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();

  const closeDrawer = () => {
    setDrawerProfileMode(false);
    setDrawerHubTab('profile');
    setDrawerOpen(false);
  };

  // When navigating from /feed with state.openDrawer, keep the drawer open on /admin
  React.useEffect(() => {
    if ((location.state as { openDrawer?: boolean })?.openDrawer === true) {
      setDrawerOpen(true);
    }
  }, [location.key]);

  const profileDrawerHeader =
    user && drawerProfileMode ? (
      <>
        <IconButton
          variant="plain"
          color="neutral"
          size="sm"
          onClick={() => {
            setDrawerHubTab('profile');
            setDrawerProfileMode(false);
          }}
          aria-label="Back to drawer"
          sx={{ color: 'text.primary' }}
        >
          <ArrowBackIosNewRounded sx={{ fontSize: 18 }} />
        </IconButton>
        {isSuperAdmin ? (
          <Box
            role="group"
            aria-label="Profile or Admin"
            sx={{
              display: 'flex',
              flex: 1,
              minWidth: 0,
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 0.5,
              flexWrap: 'wrap',
            }}
          >
            <Button
              size="sm"
              variant={drawerHubTab === 'profile' ? 'solid' : 'outlined'}
              color="neutral"
              onClick={() => setDrawerHubTab('profile')}
            >
              Profile
            </Button>
            <Button
              size="sm"
              variant={drawerHubTab === 'admin' ? 'solid' : 'outlined'}
              color="neutral"
              onClick={() => setDrawerHubTab('admin')}
            >
              Admin
            </Button>
          </Box>
        ) : (
          <Typography level="title-lg" sx={{ flex: 1, minWidth: 0 }}>
            Profile
          </Typography>
        )}
      </>
    ) : null;

  const insetDrawer = (
    <Drawer
      anchor="right"
      size="md"
      variant="plain"
      open={drawerOpen}
      onClose={closeDrawer}
      slotProps={{
        root: { sx: { zIndex: 1300 } },
        content: {
          sx: INSET_DRAWER_CONTENT_SX,
        },
      }}
    >
      <Sheet
        sx={(theme) => ({
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          height: '100%',
          overflow: 'hidden',
          bgcolor: 'background.surface',
          [theme.breakpoints.down('md')]: { borderRadius: 'var(--joy-radius-md) 0 0 var(--joy-radius-md)' },
          [theme.breakpoints.up('md')]: { borderRadius: 'md' },
        })}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {profileDrawerHeader}
          {!user || !drawerProfileMode ? (
            user ? (
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <DrawerProfileIdentityTrigger
                  user={user}
                  onOpenProfile={() => {
                    setDrawerHubTab('profile');
                    setDrawerProfileMode(true);
                    setDrawerOpen(true);
                  }}
                />
              </Box>
            ) : (
              'Home'
            )
          ) : null}
        </DialogTitle>
        <ModalClose />
        {user && drawerProfileMode ? (
          <>
            <DialogContent
              sx={{
                flex: 1,
                p: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  px: 2,
                  pt: 1,
                  pb: 2,
                }}
              >
                {isSuperAdmin && drawerHubTab === 'admin' ? (
                  <AdminHubContent variant="drawer" />
                ) : (
                  <SlipBuilderProvider>
                    <ProfileHubContent variant="drawer" />
                  </SlipBuilderProvider>
                )}
              </Box>
            </DialogContent>
            <Button
              variant="outlined"
              color="neutral"
              fullWidth
              startDecorator={<Logout />}
              onClick={async () => {
                await signOut();
                closeDrawer();
                navigate('/feed');
              }}
              sx={{ color: '#FFFFFF', '&:hover': { borderColor: 'primary.500', color: 'primary.500' } }}
            >
              Log out
            </Button>
          </>
        ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            flex: 1,
            minHeight: 0,
          }}
        >
          <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Quick actions
          </Typography>
          <Button
            variant="outlined"
            color="neutral"
            fullWidth
            startDecorator={<Home />}
            onClick={() => {
              navigate('/feed', { state: { openDrawer: true } });
            }}
            sx={drawerBtnInactiveSx}
          >
            Home
          </Button>
          <Button
            variant={activeView === 'create-post' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Add />}
            onClick={() => navigate('/admin?view=create-post')}
            sx={activeView === 'create-post' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            Create post
          </Button>
          <Button
            variant={activeView === 'dfs' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<MonetizationOn />}
            onClick={() => navigate('/admin?view=dfs')}
            sx={activeView === 'dfs' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            Create pool
          </Button>
          <Button
            variant={activeView === 'analytics' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Analytics />}
            onClick={() => navigate('/admin?view=analytics')}
            sx={activeView === 'analytics' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            View analytics
          </Button>
          <Button
            variant={activeView === 'ui' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Dashboard />}
            onClick={() => navigate('/admin?view=ui')}
            sx={activeView === 'ui' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            FEED UI
          </Button>
          <Button
            variant={activeView === 'profile' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Person />}
            onClick={() => navigate('/admin?view=profile')}
            sx={activeView === 'profile' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            PROFILE UI
          </Button>
          <Button
            variant={activeView === 'player' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Person />}
            onClick={() => navigate('/admin?view=player')}
            sx={activeView === 'player' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            PLAYER UI
          </Button>
          <Button
            variant={activeView === 'team' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Groups />}
            onClick={() => navigate('/admin?view=team')}
            sx={activeView === 'team' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            TEAM UI
          </Button>
          <Button
            variant={activeView === 'prospects' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<School />}
            onClick={() => navigate('/admin?view=prospects')}
            sx={activeView === 'prospects' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            PROSPECTS UI
          </Button>
          <Button
            variant={activeView === 'draft' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<SportsBasketball />}
            onClick={() => navigate('/admin?view=draft')}
            sx={activeView === 'draft' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            DRAFT UI
          </Button>
          <Button
            variant={activeView === 'mock-draft' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<SportsBasketball />}
            onClick={() => navigate('/admin?view=mock-draft')}
            sx={activeView === 'mock-draft' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            MOCK DRAFT
          </Button>
          <Button
            variant={activeView === 'game' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<SportsBasketball />}
            onClick={() => navigate('/admin?view=game')}
            sx={activeView === 'game' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            GAME UI
          </Button>
          <Box sx={{ flex: 1, minHeight: 16 }} />
          <Button
            variant="outlined"
            color="neutral"
            fullWidth
            startDecorator={<Logout />}
            onClick={async () => {
              await signOut();
              closeDrawer();
              navigate('/feed');
            }}
            sx={{ color: '#FFFFFF', '&:hover': { borderColor: 'primary.500', color: 'primary.500' } }}
          >
            Log out
          </Button>
        </Box>
        )}
      </Sheet>
    </Drawer>
  );

  if (isMobile) {
    return (
      <Box sx={{ width: '100%', flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 0,
            minHeight: FEED_HEADER_BAR_HEIGHT,
            px: 1.5,
            py: 1,
            bgcolor: 'background.body',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }} />
          <PlayerTeamSearchBar compact maxWidth={280} sx={{ width: 280, minWidth: 0, flexShrink: 0 }} />
          <IconButton
            variant="outlined"
            color="neutral"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open drawer"
            sx={{ flexShrink: 0 }}
          >
            <TuneRoundedIcon />
          </IconButton>
        </Box>
        <Box sx={{ flexShrink: 0, height: FEED_HEADER_BAR_HEIGHT, minHeight: FEED_HEADER_BAR_HEIGHT }} aria-hidden />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
          }}
        >
          {children}
        </Box>
        {insetDrawer}
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          maxWidth: CONTENT_MAX_WIDTH,
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 0,
          minHeight: FEED_HEADER_BAR_HEIGHT,
          px: 3,
          py: 1,
          bgcolor: 'background.body',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }} />
        <PlayerTeamSearchBar compact maxWidth={360} sx={{ width: 360, minWidth: 0, flexShrink: 0 }} />
        <Button
          variant="outlined"
          color="neutral"
          startDecorator={<TuneRoundedIcon />}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open drawer"
        >
          More
        </Button>
      </Box>
      <Box sx={{ flexShrink: 0, height: FEED_HEADER_BAR_HEIGHT, minHeight: FEED_HEADER_BAR_HEIGHT }} aria-hidden />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        }}
      >
        <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', width: '100%' }}>
          {children}
        </Box>
      </Box>
      {insetDrawer}
    </Box>
  );
}
