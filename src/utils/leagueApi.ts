import { supabase } from './supabase'
import { League, LeagueMember } from '../types'

export const fetchUserLeagues = async (): Promise<League[]> => {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Use the function to get user leagues
  const { data, error } = await supabase.rpc('get_user_leagues', {
    user_id_param: user.id
  });

  if (error) {
    console.error('Supabase Fetch Error:', error);
    throw new Error(`Error fetching user leagues: ${error.message}`);
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Failed to fetch user leagues');
  }

  // The function returns JSON array in data.data
  const leagues = data.data || [];
  
  // Transform the data to match our League interface
  return leagues.map((league: any) => ({
    id: league.id,
    name: league.name,
    description: league.description,
    commissioner_id: league.commissioner_id,
    max_teams: league.max_teams,
    draft_date: league.draft_date,
    draft_status: league.draft_status || 'scheduled',
    created_at: league.created_at,
    updated_at: league.updated_at,
    // Additional fields for display
    team_name: league.team_name,
    is_commissioner: league.is_commissioner,
    joined_at: league.joined_at,
    scoring_type: league.scoring_type,
    lineup_frequency: league.lineup_frequency,
    salary_cap_enabled: league.salary_cap_enabled,
    salary_cap_amount: league.salary_cap_amount
  }));
}

export const fetchLeagueDetails = async (leagueId: string): Promise<League> => {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Get league with active season and user's team
  const { data, error } = await supabase
    .from('fantasy_leagues')
    .select(`
      *,
      fantasy_league_seasons!inner (
        id,
        season_year,
        draft_date,
        draft_status,
        salary_cap_amount,
        is_active
      ),
      fantasy_teams (
        id,
        user_id,
        team_name,
        is_commissioner,
        created_at
      )
    `)
    .eq('id', leagueId)
    .eq('fantasy_league_seasons.is_active', true)
    .single()

  if (error) {
    console.error('Supabase Fetch Error:', error)
    throw new Error(`Error fetching league details: ${error.message}`)
  }

  // Find user's team in this league
  const userTeam = data.fantasy_teams?.find((team: any) => team.user_id === user.id);
  
  return {
    ...data,
    // Add season-specific fields
    draft_date: data.fantasy_league_seasons?.[0]?.draft_date,
    draft_status: data.fantasy_league_seasons?.[0]?.draft_status || 'scheduled',
    salary_cap_amount: data.fantasy_league_seasons?.[0]?.salary_cap_amount,
    // Add user's team info
    team_name: userTeam?.team_name,
    is_commissioner: userTeam?.is_commissioner || false,
    joined_at: userTeam?.created_at
  }
}

export const fetchLeagueMembers = async (leagueId: string): Promise<LeagueMember[]> => {
  // Get active season for this league
  const { data: seasonData, error: seasonError } = await supabase
    .from('fantasy_league_seasons')
    .select('id')
    .eq('league_id', leagueId)
    .eq('is_active', true)
    .single()

  if (seasonError || !seasonData) {
    throw new Error(`Error fetching active season: ${seasonError?.message || 'No active season found'}`)
  }

  // Get teams for the active season
  const { data, error } = await supabase
    .from('fantasy_teams')
    .select(`
      *,
      users (
        id,
        email
      )
    `)
    .eq('season_id', seasonData.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Supabase Fetch Error:', error)
    throw new Error(`Error fetching league members: ${error.message}`)
  }

  return data.map((member: any) => ({
    id: member.id,
    league_id: leagueId,
    user_id: member.user_id,
    team_name: member.team_name,
    joined_at: member.created_at,
    is_commissioner: member.is_commissioner,
    user_email: member.users?.email || 'Unknown'
  }))
}
