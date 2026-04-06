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
  type: 'player'
}

export interface TeamSearchResult {
  id: string
  team_id: number
  abbreviation: string
  nickname: string
  city: string
  type: 'team'
}

export interface ProspectSearchResult {
  id: string
  name: string
  school_team: string | null
  position_primary: string | null
  draft_year: number
  image_url: string | null
  type: 'prospect'
}

export type SearchResult = PlayerSearchResult | TeamSearchResult | ProspectSearchResult

export function usePlayerSearch(searchQuery: string) {
  return useQuery({
    queryKey: ['player-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) {
        console.log('🔍 Search query too short, returning empty array')
        return []
      }

      console.log(`🔍 Searching for players and teams: "${searchQuery}"`)

      // Search players
      const { data: playersData, error: playersError } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, first_name, last_name, position, team_name, team_abbreviation')
        .or(`name.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .order('name')
        .limit(10)

      if (playersError) {
        console.error('❌ Error searching players:', playersError)
        throw new Error(`Failed to search players: ${playersError.message}`)
      }

      // Search teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('nba_teams')
        .select('id, team_id, abbreviation, nickname, city')
        .or(`nickname.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,abbreviation.ilike.%${searchQuery}%`)
        .order('nickname')
        .limit(10)

      if (teamsError) {
        console.error('❌ Error searching teams:', teamsError)
        throw new Error(`Failed to search teams: ${teamsError.message}`)
      }

      // Search draft prospects (name and school)
      const { data: prospectsData, error: prospectsError } = await supabase
        .from('draft_prospects')
        .select('id, player_name_full, school_team, position_primary, draft_year, image_url')
        .or(`player_name_full.ilike.%${searchQuery}%,school_team.ilike.%${searchQuery}%`)
        .order('draft_year', { ascending: false })
        .order('player_name_full')
        .limit(10)

      if (prospectsError) {
        console.error('❌ Error searching draft prospects:', prospectsError)
        throw new Error(`Failed to search draft prospects: ${prospectsError.message}`)
      }

      // Combine results with type indicators
      const players: PlayerSearchResult[] = (playersData || []).map(p => ({
        ...p,
        type: 'player' as const
      }))

      const teams: TeamSearchResult[] = (teamsData || []).map(t => ({
        ...t,
        type: 'team' as const
      }))

      const prospects: ProspectSearchResult[] = (prospectsData || []).map(p => ({
        id: p.id,
        name: p.player_name_full,
        school_team: p.school_team ?? null,
        position_primary: p.position_primary ?? null,
        draft_year: p.draft_year,
        image_url: p.image_url ?? null,
        type: 'prospect' as const
      }))

      const results: SearchResult[] = [...players, ...prospects, ...teams]

      console.log(`✅ Found ${players.length} players, ${prospects.length} prospects, and ${teams.length} teams matching "${searchQuery}"`)
      return results
    },
    enabled: searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

