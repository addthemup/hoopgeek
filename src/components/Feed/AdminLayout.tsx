/**
 * Admin layout: same look as /feed/ — fixed header bar with search + "More"
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
  ModalClose,
  IconButton,
  Typography,
} from '@mui/joy';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Logout from '@mui/icons-material/Logout';
import Add from '@mui/icons-material/Add';
import MonetizationOn from '@mui/icons-material/MonetizationOn';
import Analytics from '@mui/icons-material/Analytics';
import Dashboard from '@mui/icons-material/Dashboard';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PlayerTeamSearchBar from '../PlayerTeamSearchBar';
import { useAuth } from '../../hooks/useAuth';

const FEED_HEADER_BAR_HEIGHT = 52;

export interface AdminLayoutProps {
  children: React.ReactNode;
}

type AdminView = 'ui' | 'create-post' | 'dfs' | 'analytics';

const drawerBtnActiveSx = { bgcolor: '#FFC72C', color: '#000', '&:hover': { bgcolor: '#FFD700' } };
const drawerBtnInactiveSx = { color: '#FFFFFF', '&:hover': { borderColor: 'primary.500', color: 'primary.500' } };

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeView = (searchParams.get('view') as AdminView) || 'ui';
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { signOut } = useAuth();

  const insetDrawer = (
    <Drawer
      anchor="right"
      size="md"
      variant="plain"
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      slotProps={{
        root: { sx: { zIndex: 1300 } },
        content: {
          sx: {
            bgcolor: 'transparent',
            p: { xs: 0, sm: 0, md: 3 },
            boxShadow: 'none',
            '@media (max-width: 900px)': {
              width: '90vw',
              maxWidth: '90vw',
              '--Drawer-horizontalSize': '90vw',
            },
          },
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
        <DialogTitle>More</DialogTitle>
        <ModalClose />
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
            variant={activeView === 'ui' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Dashboard />}
            onClick={() => {
              setDrawerOpen(false);
              navigate('/admin');
            }}
            sx={activeView === 'ui' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            UI
          </Button>
          <Button
            variant={activeView === 'create-post' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Add />}
            onClick={() => {
              setDrawerOpen(false);
              navigate('/admin?view=create-post');
            }}
            sx={activeView === 'create-post' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            Create post
          </Button>
          <Button
            variant={activeView === 'dfs' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<MonetizationOn />}
            onClick={() => {
              setDrawerOpen(false);
              navigate('/admin?view=dfs');
            }}
            sx={activeView === 'dfs' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            Create pool
          </Button>
          <Button
            variant={activeView === 'analytics' ? 'solid' : 'outlined'}
            color="neutral"
            fullWidth
            startDecorator={<Analytics />}
            onClick={() => {
              setDrawerOpen(false);
              navigate('/admin?view=analytics');
            }}
            sx={activeView === 'analytics' ? drawerBtnActiveSx : drawerBtnInactiveSx}
          >
            View analytics
          </Button>
          <Box sx={{ flex: 1, minHeight: 16 }} />
          <Button
            variant="outlined"
            color="neutral"
            fullWidth
            startDecorator={<Logout />}
            onClick={async () => {
              setDrawerOpen(false);
              await signOut();
              navigate('/feed');
            }}
            sx={{ color: '#FFFFFF', '&:hover': { borderColor: 'primary.500', color: 'primary.500' } }}
          >
            Log out
          </Button>
        </Box>
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
          maxWidth: 1200,
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
        {children}
      </Box>
      {insetDrawer}
    </Box>
  );
}
