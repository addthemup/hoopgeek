import { supabase } from './supabase'
import { League, LeagueMember } from '../types'

export const fetchUserLeagues = async (): Promise<League[]> => {
  const { data, error } = await supabase
    .from('league_members')
    .select(`
      *,
      leagues (
        id,
        name,
        description,
        commissioner_id,
        max_teams,
        draft_date,
        draft_status,
        created_at,
        updated_at,
        scoring_type,
        lineup_frequency,
        salary_cap_enabled,
        salary_cap_amount
      )
    `)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error('Supabase Fetch Error:', error)
    throw new Error(`Error fetching user leagues: ${error.message}`)
  }

  // Transform the data to match our League interface
  return data.map((member: any) => ({
    id: member.leagues.id,
    name: member.leagues.name,
    description: member.leagues.description,
    commissioner_id: member.leagues.commissioner_id,
    max_teams: member.leagues.max_teams,
    draft_date: member.leagues.draft_date,
    draft_status: member.leagues.draft_status || 'scheduled',
    created_at: member.leagues.created_at,
    updated_at: member.leagues.updated_at,
    // Additional fields for display
    team_name: member.team_name,
    is_commissioner: member.is_commissioner,
    joined_at: member.joined_at,
    scoring_type: member.leagues.scoring_type,
    lineup_frequency: member.leagues.lineup_frequency,
    salary_cap_enabled: member.leagues.salary_cap_enabled,
    salary_cap_amount: member.leagues.salary_cap_amount
  }))
}

export const fetchLeagueDetails = async (leagueId: string): Promise<League> => {
  const { data, error } = await supabase
    .from('leagues')
    .select(`
      *,
      league_members (
        id,
        user_id,
        team_name,
        is_commissioner,
        joined_at
      )
    `)
    .eq('id', leagueId)
    .single()

  if (error) {
    console.error('Supabase Fetch Error:', error)
    throw new Error(`Error fetching league details: ${error.message}`)
  }

  return data
}

export const fetchLeagueMembers = async (leagueId: string): Promise<LeagueMember[]> => {
  const { data, error } = await supabase
    .from('league_members')
    .select(`
      *,
      users (
        id,
        email
      )
    `)
    .eq('league_id', leagueId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('Supabase Fetch Error:', error)
    throw new Error(`Error fetching league members: ${error.message}`)
  }

  return data.map((member: any) => ({
    id: member.id,
    league_id: member.league_id,
    user_id: member.user_id,
    team_name: member.team_name,
    joined_at: member.joined_at,
    is_commissioner: member.is_commissioner,
    user_email: member.users?.email || 'Unknown'
  }))
}
