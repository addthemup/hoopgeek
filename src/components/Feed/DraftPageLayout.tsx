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
  Divider,
  IconButton,
  Typography,
  Alert,
} from '@mui/joy';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Logout from '@mui/icons-material/Logout';
import Google from '@mui/icons-material/Google';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import { useNavigate } from 'react-router-dom';
import PlayerTeamSearchBar from '../PlayerTeamSearchBar';
import { useAuth } from '../../hooks/useAuth';
import { useIsAdmin, useIsSuperAdmin } from '../../hooks/useIsAdmin';
import { supabase } from '../../utils/supabase';
import { CONTENT_MAX_WIDTH, INSET_DRAWER_CONTENT_SX } from '../../constants/layout';
import { DEFAULT_DRAFT_MODULES, useDraftModuleVisibility } from '../../hooks/useDraftModuleVisibility';
import DrawerProfileIdentityTrigger from './DrawerProfileIdentityTrigger';
import ProfileHubContent from './ProfileHubContent';
import AdminHubContent from './AdminHubContent';
import { SlipBuilderProvider } from '../../contexts/SlipBuilderContext';

const FEED_HEADER_BAR_HEIGHT = 52;

export interface DraftDrawerModule {
  name: string;
  content: React.ReactNode;
}

interface DraftPageLayoutProps {
  children: React.ReactNode;
  drawerModules?: DraftDrawerModule[];
}

export default function DraftPageLayout({ children, drawerModules = [] }: DraftPageLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProfileMode, setDrawerProfileMode] = useState(false);
  const [drawerHubTab, setDrawerHubTab] = useState<'profile' | 'admin'>('profile');
  const { user, signOut } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();

  const closeDrawer = () => {
    setDrawerProfileMode(false);
    setDrawerHubTab('profile');
    setDrawerOpen(false);
  };
  const { data: isAdmin } = useIsAdmin();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const { data: moduleVisibility } = useDraftModuleVisibility();
  const effectiveVisibility = moduleVisibility ?? DEFAULT_DRAFT_MODULES;

  const visibleModuleNames = Object.entries(effectiveVisibility)
    .filter(([, config]) => config.is_visible)
    .sort((a, b) => a[1].display_order - b[1].display_order)
    .map(([name]) => name);

  const modulesToRender = visibleModuleNames
    .map((name) => drawerModules.find((m) => m.name === name))
    .filter(Boolean) as DraftDrawerModule[];

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/feed` },
      });
      if (error) setGoogleError(error.message);
    } catch (err: unknown) {
      setGoogleError(err instanceof Error ? err.message : 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

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
          sx={{ color: '#f4f4f5' }}
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
              sx={{ color: '#f4f4f5', borderColor: 'rgba(255,255,255,0.35)' }}
            >
              Profile
            </Button>
            <Button
              size="sm"
              variant={drawerHubTab === 'admin' ? 'solid' : 'outlined'}
              color="neutral"
              onClick={() => setDrawerHubTab('admin')}
              sx={{ color: '#f4f4f5', borderColor: 'rgba(255,255,255,0.35)' }}
            >
              Admin
            </Button>
          </Box>
        ) : (
          <Typography level="title-lg" sx={{ flex: 1, color: '#f4f4f5' }}>
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
        className="dark"
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
        <DialogTitle sx={{ color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {profileDrawerHeader}
          {!user || !drawerProfileMode ? (
            user ? (
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <DrawerProfileIdentityTrigger
                  tone="draftDark"
                  user={user}
                  onOpenProfile={() => {
                    setDrawerHubTab('profile');
                    setDrawerProfileMode(true);
                    setDrawerOpen(true);
                  }}
                />
              </Box>
            ) : (
              'Draft'
            )
          ) : null}
        </DialogTitle>
        <ModalClose />

        {!user && (
          <Box sx={{ flexShrink: 0 }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Sign in to save your mock draft board.
            </Typography>
            {googleError && (
              <Alert color="danger" size="sm" sx={{ mb: 1.5 }}>
                {googleError}
              </Alert>
            )}
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={<Google />}
              onClick={handleGoogleSignIn}
              loading={googleLoading}
              fullWidth
            >
              Continue with Google
            </Button>
            <Divider sx={{ my: 2 }} />
          </Box>
        )}

        <DialogContent
          sx={{
            gap: 0,
            flex: 1,
            p: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: user && drawerProfileMode ? 'hidden' : 'auto',
          }}
        >
          {user && drawerProfileMode ? (
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
          ) : modulesToRender.length > 0 ? (
            modulesToRender.map((mod, index) => (
              <Box
                key={mod.name}
                sx={{
                  pt: index === 0 ? 0 : 3,
                  pb: 2,
                  borderBottom: index < modulesToRender.length - 1 ? '1px solid' : undefined,
                  borderColor: 'divider',
                }}
              >
                {mod.content}
              </Box>
            ))
          ) : (
            <Typography level="body-sm" sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
              No modules enabled. Turn on modules in Admin UI.
            </Typography>
          )}
        </DialogContent>

        {user && (
          <Box
            sx={{
              flexShrink: 0,
              borderTop: '1px solid',
              borderColor: 'divider',
              pt: 2,
              mt: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {isAdmin && (
              <Button
                variant="outlined"
                color="neutral"
                fullWidth
                startDecorator={<AdminPanelSettings />}
                onClick={() => {
                  setDrawerProfileMode(false);
                  setDrawerOpen(false);
                  navigate('/admin');
                }}
                sx={{ color: '#FFFFFF', '&:hover': { borderColor: 'primary.500', color: 'primary.500' } }}
              >
                Admin
              </Button>
            )}
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
          <IconButton variant="outlined" color="neutral" onClick={() => setDrawerOpen(true)} aria-label="Open drawer" sx={{ flexShrink: 0 }}>
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
          <Box
            className="dark"
            sx={{
              maxWidth: CONTENT_MAX_WIDTH,
              mx: 'auto',
              width: '100%',
              minHeight: '100%',
              boxSizing: 'border-box',
              bgcolor: '#0f0f10',
            }}
          >
            {children}
          </Box>
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
        <Button variant="outlined" color="neutral" startDecorator={<TuneRoundedIcon />} onClick={() => setDrawerOpen(true)} aria-label="Open drawer">
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
        <Box
          className="dark"
          sx={{
            maxWidth: CONTENT_MAX_WIDTH,
            mx: 'auto',
            width: '100%',
            minHeight: '100%',
            boxSizing: 'border-box',
            bgcolor: '#0f0f10',
          }}
        >
          {children}
        </Box>
      </Box>
      {insetDrawer}
    </Box>
  );
}
