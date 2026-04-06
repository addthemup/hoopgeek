/**
 * Player page layout using the same MUI Joy inset drawer pattern as /feed/.
 *
 * Main area: player header + player posts feed. A button top-right opens an
 * inset drawer containing all player modules (game logs, props, stats, info,
 * injuries, awards). Which modules appear in the drawer is controlled by
 * /admin?view=player (Player Page Modules).
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
  Divider,
  IconButton,
  Typography,
  Alert,
} from '@mui/joy';
import { HiOutlineHome } from 'react-icons/hi';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Logout from '@mui/icons-material/Logout';
import Google from '@mui/icons-material/Google';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import { useNavigate } from 'react-router-dom';
import PlayerTeamSearchBar from '../PlayerTeamSearchBar';
import { useAuth } from '../../hooks/useAuth';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { supabase } from '../../utils/supabase';
import {
  usePlayerModuleVisibility,
  DEFAULT_PLAYER_MODULES,
  PLAYER_MODULE_DEFINITIONS,
} from '../../hooks/usePlayerModuleVisibility';
import { CONTENT_MAX_WIDTH, INSET_DRAWER_CONTENT_SX } from '../../constants/layout';

const FEED_HEADER_BAR_HEIGHT = 52;

export interface PlayerDrawerModule {
  name: string;
  content: React.ReactNode;
}

interface PlayerPageLayoutProps {
  children: React.ReactNode;
  drawerModules: PlayerDrawerModule[];
  drawerHeaderContent?: React.ReactNode;
}

const MODULE_LABELS: Record<string, string> = {
  game_logs: 'Game Logs',
  props: 'Props',
  stats: 'Stats',
  info: 'Info',
  injuries: 'Injuries',
  awards: 'Awards',
};

export default function PlayerPageLayout({
  children,
  drawerModules,
  drawerHeaderContent = null,
}: PlayerPageLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

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

  const { data: moduleVisibility } = usePlayerModuleVisibility();
  const effectiveVisibility = moduleVisibility ?? DEFAULT_PLAYER_MODULES;

  const visibleModuleNames = Object.entries(effectiveVisibility)
    .filter(([, config]) => config.is_visible)
    .sort((a, b) => a[1].display_order - b[1].display_order)
    .map(([name]) => name);

  const modulesToRender = visibleModuleNames
    .map((name) => drawerModules.find((m) => m.name === name))
    .filter(Boolean) as PlayerDrawerModule[];

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
          [theme.breakpoints.down('md')]: {
            borderRadius: 'var(--joy-radius-md) 0 0 var(--joy-radius-md)',
          },
          [theme.breakpoints.up('md')]: { borderRadius: 'md' },
        })}
      >
        {!drawerHeaderContent && <DialogTitle>Home</DialogTitle>}
        <ModalClose />
        {drawerHeaderContent && (
          <>
            <Box sx={{ flexShrink: 0 }}>{drawerHeaderContent}</Box>
            <Divider />
          </>
        )}

        {!user && (
          <Box sx={{ flexShrink: 0 }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Sign in to save favorites and get personalized content.
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

        <DialogContent sx={{ gap: 0, flex: 1, overflow: 'auto', p: 0, minHeight: 0 }}>
          {modulesToRender.map(({ name, content }, index) => {
            const label = MODULE_LABELS[name] ?? name.replace(/_/g, ' ');
            return (
              <Box
                key={name}
                sx={{
                  pt: index === 0 ? 0 : 3,
                  pb: 2,
                  borderBottom:
                    index < modulesToRender.length - 1
                      ? '1px solid'
                      : undefined,
                  borderColor: 'divider',
                }}
              >
                <Typography
                  level="title-sm"
                  sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.primary' }}
                >
                  {label}
                </Typography>
                {content}
              </Box>
            );
          })}
          {modulesToRender.length === 0 && (
            <Typography level="body-sm" sx={{ color: '#888', py: 4, textAlign: 'center' }}>
              No modules enabled
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
                  setDrawerOpen(false);
                  navigate('/admin');
                }}
                sx={{
                  color: '#FFFFFF',
                  '&:hover': { borderColor: 'primary.500', color: 'primary.500' },
                }}
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
                setDrawerOpen(false);
                navigate('/feed');
              }}
              sx={{
                color: '#FFFFFF',
                '&:hover': { borderColor: 'primary.500', color: 'primary.500' },
              }}
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
      <Box
        sx={{
          width: '100%',
          flex: 1,
          height: '100vh',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 950,
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
          <Button
            variant="plain"
            color="warning"
            onClick={() => navigate('/feed')}
            sx={{
              flexShrink: 0,
              fontWeight: 800,
              textTransform: 'lowercase',
              letterSpacing: '-0.02em',
              px: 0.75,
              minHeight: 32,
            }}
          >
            geek
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, ml: 'auto' }}>
            <PlayerTeamSearchBar
              compact
              maxWidth={280}
              sx={{ width: 280, minWidth: 0, flexShrink: 0 }}
            />
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
        </Box>
        <Box
          sx={{
            flexShrink: 0,
            height: FEED_HEADER_BAR_HEIGHT,
            minHeight: FEED_HEADER_BAR_HEIGHT,
          }}
          aria-hidden
        />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            bgcolor: '#ffffff',
          }}
        >
          {children}
        </Box>
        {insetDrawer}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100vh',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 950,
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
        <Button
          variant="plain"
          color="warning"
          onClick={() => navigate('/feed')}
          sx={{
            flexShrink: 0,
            fontWeight: 800,
            textTransform: 'lowercase',
            letterSpacing: '-0.02em',
            px: 0.75,
            minHeight: 32,
          }}
        >
          geek
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, ml: 'auto' }}>
          <PlayerTeamSearchBar
            compact
            maxWidth={360}
            sx={{ width: 360, minWidth: 0, flexShrink: 0 }}
          />
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
      </Box>
      <Box
        sx={{
          flexShrink: 0,
          height: FEED_HEADER_BAR_HEIGHT,
          minHeight: FEED_HEADER_BAR_HEIGHT,
        }}
        aria-hidden
      />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          bgcolor: '#ffffff',
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
