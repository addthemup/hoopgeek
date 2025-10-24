import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface PlayerSearchResult {
  id: string
  nba_player_id: number
  name: string
  first_name: string
  last_name: string
  position: string | null
  team_name: string | null
  team_abbreviation: string | null
}

export function usePlayerSearch(searchQuery: string) {
  return useQuery({
    queryKey: ['player-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) {
        console.log('🔍 Search query too short, returning empty array')
        return []
      }

      console.log(`🔍 Searching for players: "${searchQuery}"`)

      const { data, error } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, first_name, last_name, position, team_name, team_abbreviation')
        .or(`name.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .order('name')
        .limit(10)

      if (error) {
        console.error('❌ Error searching players:', error)
        throw new Error(`Failed to search players: ${error.message}`)
      }

      console.log(`✅ Found ${data?.length || 0} players matching "${searchQuery}"`, data)
      return data || []
    },
    enabled: searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

