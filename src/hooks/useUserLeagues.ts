import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchUserLeagues, fetchLeagueDetails, fetchLeagueMembers } from '../utils/leagueApi'
import { League, LeagueMember } from '../types'

export const useUserLeagues = () => {
  return useQuery<League[], Error>({
    queryKey: ['userLeagues'],
    queryFn: fetchUserLeagues,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export const useLeagueDetails = (leagueId: string) => {
  return useQuery<League, Error>({
    queryKey: ['leagueDetails', leagueId],
    queryFn: () => fetchLeagueDetails(leagueId),
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export const useLeagueMembers = (leagueId: string) => {
  return useQuery<LeagueMember[], Error>({
    queryKey: ['leagueMembers', leagueId],
    queryFn: () => fetchLeagueMembers(leagueId),
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export const useRefreshLeagues = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      // Invalidate and refetch user leagues
      await queryClient.invalidateQueries({ queryKey: ['userLeagues'] })
    },
  })
}
