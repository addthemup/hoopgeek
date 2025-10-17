import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import { useTeams } from './useTeams';

export function useChatMentions(leagueId: string) {
  const { user } = useAuth();
  const { data: teams } = useTeams(leagueId);
  
  // Find user's team
  const userTeam = teams?.find(team => team.user_id === user?.id);
  
  return useQuery({
    queryKey: ['chat-mentions', leagueId, userTeam?.id],
    queryFn: async () => {
      if (!userTeam || !leagueId) return 0;

      // Get the last time the user viewed the chat (we'll store this in localStorage for now)
      const lastViewedKey = `chat-last-viewed-${leagueId}-${userTeam.id}`;
      const lastViewed = localStorage.getItem(lastViewedKey);
      const lastViewedTime = lastViewed ? new Date(lastViewed) : new Date(0);

      // Query for messages that mention this team since last viewed
      const { data: messages, error } = await supabase
        .from('fantasy_draft_chat_messages')
        .select('id, message, created_at, fantasy_teams!inner(team_name)')
        .eq('league_id', leagueId)
        .gte('created_at', lastViewedTime.toISOString())
        .neq('fantasy_team_id', userTeam.id) // Don't count own messages
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching chat mentions:', error);
        return 0;
      }

      // Count messages that mention this team
      const mentionCount = messages?.filter(msg => {
        // Check if message contains @team_name or @Team Name
        const teamName = userTeam.team_name;
        if (!teamName) return false;
        
        // Create regex patterns for different variations of the team name
        const patterns = [
          new RegExp(`@${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
          new RegExp(`@${teamName.replace(/\s+/g, '\\s+')}\\b`, 'i'), // Handle spaces
        ];
        
        return patterns.some(pattern => pattern.test(msg.message));
      }).length || 0;

      return mentionCount;
    },
    enabled: !!userTeam && !!leagueId,
    refetchInterval: 5000, // Check every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
  });
}

// Helper function to mark chat as viewed
export function markChatAsViewed(leagueId: string, teamId: string) {
  const lastViewedKey = `chat-last-viewed-${leagueId}-${teamId}`;
  localStorage.setItem(lastViewedKey, new Date().toISOString());
}
