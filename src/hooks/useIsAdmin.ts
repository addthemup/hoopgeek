import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface AdminUser {
  user_id: string;
  role: 'super_admin' | 'content_admin' | 'pool_admin' | 'moderator' | 'readonly_admin';
  is_active: boolean;
  created_at?: string;
  last_login_at?: string;
}

export function useIsAdmin() {
  const { user } = useAuth();

  return useQuery<boolean>({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      console.log('🔍 Checking admin status for user:', user?.id);
      
      if (!user) {
        console.log('❌ No user logged in');
        return false;
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error) {
        console.log('❌ Not an admin:', error.message);
        return false;
      }

      console.log('✅ Admin status:', data);
      return !!data && data.is_active;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on failure
  });
}

export function useAdminUser() {
  const { user } = useAuth();

  return useQuery<AdminUser | null>({
    queryKey: ['admin-user', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error) return null;

      return data as AdminUser;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

