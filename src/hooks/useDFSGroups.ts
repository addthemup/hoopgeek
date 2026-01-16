import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DFSGroup {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  is_open: boolean;
  max_members: number | null;
  avatar_url: string | null;
  icon_name: string | null;
  icon_color_primary: string;
  icon_color_secondary: string;
  member_count: number;
  pool_count: number;
  total_entries: number;
  created_by: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface DFSGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  nickname: string | null;
  total_entries: number;
  total_wins: number;
  total_points: number;
  is_active: boolean;
  joined_at: string;
}

export interface DFSGroupPool {
  id: string;
  group_id: string;
  pool_id: string;
  created_by: string;
  created_at: string;
  pool: {
    id: string;
    name: string;
    status: string;
    lock_time: string;
    slate_date: string;
  };
}

// Fetch user's groups
export function useDFSUserGroups(userId: string | undefined) {
  return useQuery<DFSGroup[]>({
    queryKey: ['dfs-user-groups', userId],
    queryFn: async () => {
      if (!userId) return [];

      // First get the group IDs the user is a member of
      const { data: memberships, error: membershipsError } = await supabase
        .from('dfs_group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (membershipsError) throw membershipsError;

      if (!memberships || memberships.length === 0) return [];

      // Then fetch the groups
      const groupIds = memberships.map(m => m.group_id);
      const { data: groups, error: groupsError } = await supabase
        .from('dfs_groups')
        .select('*')
        .in('id', groupIds);

      if (groupsError) throw groupsError;

      return groups || [];
    },
    enabled: !!userId,
  });
}

// Fetch group details
export function useDFSGroup(groupId: string | undefined) {
  return useQuery<DFSGroup | null>({
    queryKey: ['dfs-group', groupId],
    queryFn: async () => {
      if (!groupId) return null;

      const { data, error } = await supabase
        .from('dfs_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });
}

// Fetch group by slug
export function useDFSGroupBySlug(slug: string | undefined) {
  return useQuery<DFSGroup | null>({
    queryKey: ['dfs-group-slug', slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from('dfs_groups')
        .select('*')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;
    },
    enabled: !!slug,
  });
}

// Fetch group members
export function useDFSGroupMembers(groupId: string | undefined) {
  return useQuery<DFSGroupMember[]>({
    queryKey: ['dfs-group-members', groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from('dfs_group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('total_points', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId,
  });
}

// Fetch group pools
export function useDFSGroupPools(groupId: string | undefined) {
  return useQuery<DFSGroupPool[]>({
    queryKey: ['dfs-group-pools', groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from('dfs_group_pools')
        .select(`
          *,
          dfs_pools (
            id,
            name,
            status,
            lock_time,
            slate_date
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        pool: item.dfs_pools,
      }));
    },
    enabled: !!groupId,
  });
}

// Create group mutation
export function useCreateDFSGroup() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, {
    name: string;
    description?: string;
    slug?: string;
    is_public?: boolean;
    is_open?: boolean;
    max_members?: number;
    avatar_url?: string;
    icon_name?: string;
    icon_color_primary?: string;
    icon_color_secondary?: string;
  }>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.rpc('create_dfs_group', {
        p_name: params.name,
        p_description: params.description || null,
        p_slug: params.slug || null,
        p_is_public: params.is_public || false,
        p_is_open: params.is_open ?? true,
        p_max_members: params.max_members || null,
        p_avatar_url: params.avatar_url || null,
        p_icon_name: params.icon_name || null,
        p_icon_color_primary: params.icon_color_primary || '#FFC72C',
        p_icon_color_secondary: params.icon_color_secondary || '#000000',
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: ['dfs-user-groups'] });
      queryClient.invalidateQueries({ queryKey: ['dfs-group', groupId] });
    },
  });
}

// Join group mutation
export function useJoinDFSGroup() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, { groupId: string; invitationToken?: string }>({
    mutationFn: async ({ groupId, invitationToken }) => {
      const { data, error } = await supabase.rpc('join_dfs_group', {
        p_group_id: groupId,
        p_invitation_token: invitationToken || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dfs-user-groups'] });
      queryClient.invalidateQueries({ queryKey: ['dfs-group', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-group-members', variables.groupId] });
    },
  });
}

// Leave group mutation
export function useLeaveDFSGroup() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, { groupId: string }>({
    mutationFn: async ({ groupId }) => {
      const { data, error } = await supabase.rpc('leave_dfs_group', {
        p_group_id: groupId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dfs-user-groups'] });
      queryClient.invalidateQueries({ queryKey: ['dfs-group', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-group-members', variables.groupId] });
    },
  });
}

// Link pool to group mutation
export function useLinkPoolToGroup() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, { groupId: string; poolId: string }>({
    mutationFn: async ({ groupId, poolId }) => {
      const { data, error } = await supabase.rpc('link_pool_to_group', {
        p_group_id: groupId,
        p_pool_id: poolId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dfs-group-pools', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-group', variables.groupId] });
    },
  });
}

