import { Box } from '@mui/joy';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth';
import { AttachMoney, Add } from '@mui/icons-material';
import { getIconByName } from '../utils/dfsPoolIcons';
import AvatarBar from './AvatarBar';
import { format } from 'date-fns';
import { useDFSUserGroups } from '../hooks/useDFSGroups';

// Helper function to get icon component by name
function getIconComponent(iconName: string | null | undefined) {
  if (!iconName) return null;
  return getIconByName(iconName);
}

interface DFSPool {
  pool_id: string;
  name: string;
  entry_fee: number;
  prize_pool: number;
  current_entries: number;
  max_entries: number;
  difficulty_tier: 'elite' | 'pro' | 'standard';
  status: string;
  lock_time: string;
  slate_date?: string;
  seconds_until_lock: number;
  is_featured?: boolean;
  is_guaranteed?: boolean;
  icon_name?: string | null;
  html_color_primary?: string | null;
  html_color_secondary?: string | null;
}

interface DFSPoolsAvatarBarProps {
  selectedPoolId?: string | null;
  onPoolClick?: (poolId: string) => void;
  onCreateGroupPool?: () => void;
}

export default function DFSPoolsAvatarBar({ 
  selectedPoolId,
  onPoolClick,
  onCreateGroupPool
}: DFSPoolsAvatarBarProps) {
  const { user } = useAuth();
  const { data: userGroups } = useDFSUserGroups(user?.id);

  // Fetch available pools (today's contests)
  const { data: availablePools, isLoading: availableLoading } = useQuery<DFSPool[]>({
    queryKey: ['dfs-todays-contests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_todays_contests')
        .select('*')
        .order('lock_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch user's entered pools
  const { data: userPools, isLoading: userPoolsLoading } = useQuery<DFSPool[]>({
    queryKey: ['dfs-user-pools', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: entries, error } = await supabase
        .from('dfs_entries')
        .select(`
          pool_id,
          is_submitted,
          dfs_pools (
            id,
            name,
            entry_fee,
            prize_pool,
            status,
            lock_time,
            slate_date,
            difficulty_tier,
            max_entries,
            icon_name,
            html_color_primary,
            html_color_secondary
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      // Filter to only show live and upcoming entries (not past/completed)
      const liveAndUpcomingEntries = (entries || []).filter((e: any) => {
        const status = e.dfs_pools?.status;
        return status === 'live' || status === 'scheduled';
      });

      // Get unique pool IDs
      const uniquePoolIds = [...new Set(liveAndUpcomingEntries.map((e: any) => e.pool_id))];

      // Get current entry counts for each pool
      const poolsWithCounts = await Promise.all(
        uniquePoolIds.map(async (poolId) => {
          const entry = liveAndUpcomingEntries.find((e: any) => e.pool_id === poolId);
          if (!entry || !entry.dfs_pools) return null;

          const { count } = await supabase
            .from('dfs_entries')
            .select('*', { count: 'exact', head: true })
            .eq('pool_id', poolId)
            .eq('is_submitted', true);

          return {
            pool_id: poolId,
            name: entry.dfs_pools.name,
            entry_fee: entry.dfs_pools.entry_fee,
            prize_pool: entry.dfs_pools.prize_pool,
            current_entries: count || 0,
            max_entries: entry.dfs_pools.max_entries,
            difficulty_tier: entry.dfs_pools.difficulty_tier,
            status: entry.dfs_pools.status,
            lock_time: entry.dfs_pools.lock_time,
            slate_date: entry.dfs_pools.slate_date,
            seconds_until_lock: 0,
            icon_name: entry.dfs_pools.icon_name,
            html_color_primary: entry.dfs_pools.html_color_primary,
            html_color_secondary: entry.dfs_pools.html_color_secondary,
          };
        })
      );

      return poolsWithCounts.filter((p): p is DFSPool => p !== null);
    },
    enabled: !!user?.id,
  });

  const isLoading = availableLoading || userPoolsLoading;
  
  // Memoize allPools to preserve icon data during re-renders
  // This is critical to prevent icon data loss when pools are selected
  const allPools = useMemo(() => {
    const available = availablePools || [];
    const user = userPools || [];
    
    // Create a map of pool_id -> pool with icon data for quick lookup
    const availableMap = new Map(available.map(p => [p.pool_id, p]));
    const userMap = new Map(user.map(p => [p.pool_id, p]));
    
    // Merge pools, prioritizing available pools, then user pools
    const merged = [
      ...available,
      ...user.filter(up => !availableMap.has(up.pool_id))
    ];
    
    // Ensure icon data is always preserved by merging from source maps
    return merged.map(pool => {
      // Always prefer icon data from available pools first, then user pools
      const availablePool = availableMap.get(pool.pool_id);
      const userPool = userMap.get(pool.pool_id);
      
      // Merge icon data from the best source
      const iconData = availablePool?.icon_name 
        ? { 
            icon_name: availablePool.icon_name,
            html_color_primary: availablePool.html_color_primary,
            html_color_secondary: availablePool.html_color_secondary
          }
        : (userPool?.icon_name 
            ? { 
                icon_name: userPool.icon_name,
                html_color_primary: userPool.html_color_primary,
                html_color_secondary: userPool.html_color_secondary
              }
            : (pool.icon_name 
                ? { 
                    icon_name: pool.icon_name,
                    html_color_primary: pool.html_color_primary,
                    html_color_secondary: pool.html_color_secondary
                  }
                : {}));
      
      // Merge pool data with icon data, ensuring icon data takes precedence
      return { ...pool, ...iconData };
    });
  }, [availablePools, userPools]);

  // Add create group pool button as first item if user has groups
  const itemsWithCreateButton = useMemo(() => {
    const items: Array<DFSPool | { pool_id: 'create-group-pool'; isCreateButton: true }> = [];
    
    // Add create button if user has groups and callback is provided
    if (userGroups && userGroups.length > 0 && onCreateGroupPool) {
      items.push({ pool_id: 'create-group-pool', isCreateButton: true } as any);
    }
    
    // Add all pools
    items.push(...allPools);
    
    return items;
  }, [allPools, userGroups, onCreateGroupPool]);

  const getDifficultyColor = (tier: string) => {
    switch (tier) {
      case 'elite': return '#ef4444';
      case 'pro': return '#f59e0b';
      case 'standard': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatMoney = (amount: number) => {
    if (amount === 0) return 'FREE';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  // Helper to get pool with icon data
  const getPoolWithIcon = (pool: DFSPool | null | undefined) => {
    if (!pool) return null;
    const poolFromAvailable = availablePools?.find(ap => ap.pool_id === pool.pool_id);
    const poolFromUser = userPools?.find(up => up.pool_id === pool.pool_id);
    
    return poolFromAvailable?.icon_name 
      ? poolFromAvailable 
      : (poolFromUser?.icon_name 
          ? poolFromUser 
          : pool);
  };

  return (
    <AvatarBar
      items={itemsWithCreateButton || []}
      isLoading={isLoading}
      selectedId={selectedPoolId}
      onItemClick={(id) => {
        if (id === 'create-group-pool' && onCreateGroupPool) {
          onCreateGroupPool();
        } else if (onPoolClick) {
          onPoolClick(id);
        }
      }}
      getItemId={(item) => {
        if (item && 'isCreateButton' in item && item.isCreateButton) {
          return 'create-group-pool';
        }
        return (item as DFSPool)?.pool_id || '';
      }}
      minItems={isLoading && (!itemsWithCreateButton || itemsWithCreateButton.length === 0) ? 5 : 0}
      getBorderStyles={(item, index, hasData, isSelected) => {
        // Create button styling
        if (item && 'isCreateButton' in item && item.isCreateButton) {
          return {
            border: '3px dashed',
            borderColor: '#FFC72C',
            bgcolor: '#1a1a1a',
          };
        }

        if (!hasData || !item) {
          return {
            border: '3px dashed',
            borderColor: 'text.primary',
            bgcolor: '#000000',
          };
        }

        const pool = item as DFSPool;
        const poolWithIcon = getPoolWithIcon(pool);
        const isLocked = pool.status === 'live' || pool.status === 'completed';
        const primaryColor = poolWithIcon?.html_color_primary || pool?.html_color_primary || getDifficultyColor(pool?.difficulty_tier);
        const secondaryColor = poolWithIcon?.html_color_secondary || pool?.html_color_secondary || '#000000';

        return {
          border: isLocked
            ? '3px dashed'
            : isSelected
              ? '3px solid'
              : '3px dashed',
          borderColor: isLocked
            ? 'text.primary'
            : isSelected
              ? secondaryColor
              : primaryColor,
          bgcolor: primaryColor,
        };
      }}
      renderAvatar={(item, index, hasData) => {
        // Render create button
        if (item && 'isCreateButton' in item && item.isCreateButton) {
          return (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <Add
                sx={{
                  fontSize: { xs: 40, md: 48 },
                  color: '#FFC72C',
                }}
              />
            </Box>
          );
        }

        if (!hasData || !item) {
          return null;
        }

        const pool = item as DFSPool;
        const poolWithIcon = getPoolWithIcon(pool);
        const isSelected = selectedPoolId === pool.pool_id;
        const isUserPool = userPools?.some(up => up.pool_id === pool.pool_id);
        const isLocked = pool.status === 'live' || pool.status === 'completed';

        // Get icon data
        const iconName = poolWithIcon?.icon_name || 
                        availablePools?.find(ap => ap.pool_id === pool.pool_id)?.icon_name || 
                        userPools?.find(up => up.pool_id === pool.pool_id)?.icon_name || 
                        pool?.icon_name;
        
        const IconComponent = getIconComponent(iconName);
        
        const secondaryColor = poolWithIcon?.html_color_secondary || 
                               availablePools?.find(ap => ap.pool_id === pool.pool_id)?.html_color_secondary || 
                               userPools?.find(up => up.pool_id === pool.pool_id)?.html_color_secondary || 
                               pool?.html_color_secondary || 
                               '#000000';
        
        const iconColor = isSelected 
          ? (poolWithIcon?.html_color_secondary || pool?.html_color_secondary || '#000000')
          : secondaryColor;

        return (
          <>
            {/* Pool Icon or Money Icon Fallback - Centered */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              {IconComponent && iconName ? (
                <IconComponent
                  size={isSelected ? 40 : 36}
                  color={iconColor}
                  style={{
                    filter: isSelected ? 'drop-shadow(0 0 8px rgba(255,215,0,0.5))' : 'none',
                  }}
                />
              ) : (
                <AttachMoney
                  sx={{
                    fontSize: { xs: 32, md: 36 },
                    color: iconColor,
                  }}
                />
              )}
            </Box>

            {/* Status Badge */}
            {isLocked && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '8%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: pool.status === 'live' ? '#ef4444' : '#6b7280',
                  color: '#fff',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  fontSize: '0.5rem',
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  border: '2px solid',
                  borderColor: 'background.body',
                  zIndex: 2,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {pool.status === 'live' ? 'LIVE' : 'LOCKED'}
              </Box>
            )}

            {/* User Entry Indicator */}
            {isUserPool && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '8%',
                  right: '8%',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: '#10b981',
                  border: '2px solid',
                  borderColor: 'background.body',
                  zIndex: 2,
                }}
              />
            )}

            {/* Entry Fee Banner at top of circle */}
            {pool.entry_fee !== undefined && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '8%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: '#FFC72C',
                  color: '#000',
                  px: 1,
                  py: 0.25,
                  borderRadius: '6px',
                  fontSize: { xs: '0.7rem', md: '0.75rem' },
                  fontWeight: 'bold',
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  border: '2px solid',
                  borderColor: 'background.body',
                  zIndex: 2,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {formatMoney(pool.entry_fee)}
              </Box>
            )}

            {/* Date Display - Above status badge when locked, otherwise at bottom */}
            {pool.slate_date && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: isLocked ? '20%' : '20%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#fff',
                  fontSize: { xs: '0.55rem', md: '0.6rem' },
                  fontWeight: 'bold',
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  zIndex: 2,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {format(new Date(pool.slate_date), 'MMM d')}
              </Box>
            )}

            {/* Entries Count - At bottom when not locked, above status badge when locked */}
            {!isLocked && pool.max_entries !== undefined && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '8%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#fff',
                  fontSize: { xs: '0.55rem', md: '0.6rem' },
                  fontWeight: 'bold',
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  zIndex: 2,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                /{pool.max_entries}
              </Box>
            )}
          </>
        );
      }}
    />
  );
}

