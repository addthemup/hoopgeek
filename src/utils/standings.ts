/**
 * Standings Utility Functions
 * Provides easy access to standings data throughout the application
 */

import { useStandings, StandingsTeam } from '../hooks/useStandings';

export type Conference = 'East' | 'West';

export interface StandingsData {
  east: StandingsTeam[];
  west: StandingsTeam[];
}

/**
 * Get standings data (can be used in components)
 */
export function useStandingsData() {
  return useStandings();
}

/**
 * Get teams for a specific conference
 */
export function getConferenceTeams(
  standings: StandingsData | undefined,
  conference: Conference
): StandingsTeam[] {
  if (!standings) return [];
  return conference === 'East' ? standings.east || [] : standings.west || [];
}

/**
 * Get a specific team by abbreviation
 */
export function getTeamByAbbreviation(
  standings: StandingsData | undefined,
  abbreviation: string
): StandingsTeam | null {
  if (!standings) return null;
  
  const allTeams = [...(standings.east || []), ...(standings.west || [])];
  return allTeams.find(team => 
    team.team_abbreviation.toLowerCase() === abbreviation.toLowerCase()
  ) || null;
}

/**
 * Get team rank in conference
 */
export function getTeamConferenceRank(
  standings: StandingsData | undefined,
  abbreviation: string
): number | null {
  const team = getTeamByAbbreviation(standings, abbreviation);
  return team?.conference_rank || null;
}

/**
 * Get top N teams in a conference
 */
export function getTopTeams(
  standings: StandingsData | undefined,
  conference: Conference,
  count: number = 8
): StandingsTeam[] {
  const teams = getConferenceTeams(standings, conference);
  return teams.slice(0, count);
}

/**
 * Check if a team is in playoff position
 */
export function isPlayoffTeam(
  standings: StandingsData | undefined,
  abbreviation: string
): boolean {
  const rank = getTeamConferenceRank(standings, abbreviation);
  return rank !== null && rank <= 8;
}

