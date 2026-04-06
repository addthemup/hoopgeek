/**
 * DFS Pools module for the feed inset drawer.
 * Shows upcoming/public pools; when not logged in, prompts to sign in for personalized data.
 * Header links to /dfs (DFS page with stats, pools, user entries).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Chip, Button } from '@mui/joy';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import MonetizationOn from '@mui/icons-material/MonetizationOn';
import Schedule from '@mui/icons-material/Schedule';

interface DFSModuleProps {
  navigate: (path: string) => void;
}

export default function DFSModule({ navigate }: DFSModuleProps) {
  const { user } = useAuth();

  const { data: pools, isLoading } = useQuery({
    queryKey: ['dfs-drawer-pools', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_pools')
        .select('id, name, status, lock_time, slate_date')
        .eq('is_public', true)
        .order('lock_time', { ascending: true })
        .limit(25);
      if (error) throw error;
      const allowedStatuses = new Set(['scheduled', 'live', 'ongoing', 'in progress', 'in_progress']);
      return (data || [])
        .filter((pool: any) => allowedStatuses.has(String(pool.status || '').toLowerCase()))
        .slice(0, 10);
    },
    enabled: true,
  });

  if (!user) {
    return (
      <Card variant="outlined" sx={{ bgcolor: 'background.level1', borderColor: 'divider' }}>
        <CardContent>
          <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 1.5 }}>
            Log in for personalized data — your entries, groups, and stats.
          </Typography>
          <Button
            variant="soft"
            size="sm"
            startDecorator={<MonetizationOn />}
            onClick={() => navigate('/dfs')}
          >
            Browse DFS
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography level="body-sm" color="neutral">
          Loading…
        </Typography>
      </Box>
    );
  }

  if (!pools || pools.length === 0) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography level="body-sm" color="neutral">
          No upcoming pools. Create one in Admin or check back later.
        </Typography>
        <Button
          variant="outlined"
          size="sm"
          sx={{ mt: 1 }}
          onClick={() => navigate('/dfs')}
        >
          Go to DFS
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {pools.map((pool: any) => (
        <Card
          key={pool.id}
          variant="outlined"
          sx={{
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.500', bgcolor: 'background.level1' },
          }}
          onClick={() => navigate(`/dfs?pool=${pool.id}`)}
        >
          <CardContent sx={{ py: 1, px: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography level="body-sm" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
                {pool.name}
              </Typography>
              <Chip size="sm" variant="soft" color={pool.status === 'scheduled' ? 'neutral' : 'success'}>
                {pool.status === 'scheduled' ? (
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Schedule sx={{ fontSize: 14 }} />
                    Upcoming
                  </Box>
                ) : (
                  'Live'
                )}
              </Chip>
            </Box>
            {pool.lock_time && (
              <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.25 }}>
                Locks {new Date(pool.lock_time).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}
      <Button variant="plain" size="sm" onClick={() => navigate('/dfs')} sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
        View all →
      </Button>
    </Box>
  );
}
