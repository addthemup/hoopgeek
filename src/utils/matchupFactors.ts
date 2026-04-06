/**
 * Matchup factors for the Matchups tab: player offense (nba_daily_player_stats)
 * vs team defense (nba_daily_team_stats). Each factor has a 1:1 endpoint pair
 * so we can show "how good is this player at X" vs "how good is the opponent at defending X".
 *
 * Used for radial chart: one axis per factor; value = normalized player strength
 * (e.g. PPP or FG% scaled to 0–100), with optional opponent defense context.
 *
 * ---------------------------------------------------------------------------
 * DECLARED MEASURABLE VARIABLES (offense vs defense, plus rebounding)
 * ---------------------------------------------------------------------------
 * Every factor below is measured FOR (player offense) and AGAINST (opponent
 * team defense). Same endpoint names must exist in:
 *   - nba_daily_player_stats (offense)
 *   - nba_daily_team_stats (defense)
 *
 * OFFENSE (player) — nba_daily_player_stats endpoint_name + stat column
 * DEFENSE (opponent team) — nba_daily_team_stats endpoint_name + stat column
 * REBOUNDING — one factor: player OREB ability vs team DREB.
 *
 * Play-type factors (10): stat = PPP
 *   isolation_offense     ↔ isolation_defense
 *   transition_offense    ↔ transition_defense
 *   ball_handler_offense  ↔ ball_handler_defense
 *   roll_man_offense      ↔ roll_man_defense
 *   post_up_offense       ↔ post_up_defense
 *   spot_up_offense       ↔ spot_up_defense
 *   hand_off_offense      ↔ hand_off_defense
 *   cut_offense           ↔ cut_defense
 *   off_screen_offense    ↔ off_screen_defense
 *   putbacks_offense      ↔ putbacks_defense
 *
 * Dribble-based factors (5): stat = FG%
 *   catch_and_shoot       ↔ opponent_catch_and_shoot
 *   shots_1_dribble       ↔ opponent_shots_1_dribble
 *   shots_2_dribbles      ↔ opponent_shots_2_dribbles
 *   shots_3_6_dribbles    ↔ opponent_shots_3_6_dribbles
 *   shots_7plus_dribbles  ↔ opponent_shots_7plus_dribbles
 *
 * Rebounding (1): player OREB CHANCE% vs team DREB
 *   offensive_rebounding  ↔ defensive_rebounding
 *
 * Total: 16 factors (10 offense/defense play types + 5 dribble + 1 rebounding).
 * ---------------------------------------------------------------------------
 */

export interface MatchupFactor {
  /** Player offense endpoint in nba_daily_player_stats (e.g. isolation_offense). */
  playerOffenseEndpoint: string;
  /** Team defense endpoint in nba_daily_team_stats (e.g. isolation_defense). */
  teamDefenseEndpoint: string;
  /** Short label for radar axis (e.g. "Iso", "Transition"). */
  label: string;
  /** Primary column in player offense data for "how good" (e.g. PPP, FG%, PERCENTILE). */
  playerStatKey: string;
  /** Primary column in team defense data for opponent (e.g. PPP, FG%, DFG%). */
  teamStatKey: string;
  /** Higher player value = better; higher team value = worse D (more favorable). */
  higherPlayerBetter: boolean;
  higherTeamValueWorseDefense: boolean;
  /** Columns to show in the factor table for player (default [playerStatKey]). */
  playerDisplayColumns?: string[];
  /** Columns to show in the factor table for opponent team (default [teamStatKey]). */
  teamDisplayColumns?: string[];
}

/**
 * All matchup factors with a direct player-offense ↔ team-defense endpoint pair.
 * Order: play types first, then dribble-based, then rebounding.
 */
const PLAY_TYPE_COLUMNS = { player: ['PPP', 'FG%', 'FREQ%', 'PTS'], team: ['PPP', 'FG%'] };
const DRIBBLE_COLUMNS = { player: ['FG%', '3P%', 'EFG%'], team: ['FG%', '3P%'] };
const REB_COLUMNS = { player: ['OREB CHANCE%', 'OREB', 'OREB CHANCES'], team: ['DREB', 'DREB CHANCE%'] };

export const MATCHUP_FACTORS: MatchupFactor[] = [
  // Play type: *_offense (player) ↔ *_defense (team)
  { playerOffenseEndpoint: 'isolation_offense',    teamDefenseEndpoint: 'isolation_defense',    label: 'Iso',       playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'transition_offense',  teamDefenseEndpoint: 'transition_defense',  label: 'Transition', playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'ball_handler_offense', teamDefenseEndpoint: 'ball_handler_defense', label: 'Ball handler', playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'roll_man_offense',    teamDefenseEndpoint: 'roll_man_defense',    label: 'Roll man',   playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'post_up_offense',     teamDefenseEndpoint: 'post_up_defense',     label: 'Post up',    playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'spot_up_offense',     teamDefenseEndpoint: 'spot_up_defense',    label: 'Spot up',    playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'hand_off_offense',    teamDefenseEndpoint: 'hand_off_defense',   label: 'Hand off',   playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'cut_offense',        teamDefenseEndpoint: 'cut_defense',        label: 'Cut',        playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'off_screen_offense',  teamDefenseEndpoint: 'off_screen_defense', label: 'Off screen', playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  { playerOffenseEndpoint: 'putbacks_offense',    teamDefenseEndpoint: 'putbacks_defense',   label: 'Putbacks',   playerStatKey: 'PPP', teamStatKey: 'PPP', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: PLAY_TYPE_COLUMNS.player, teamDisplayColumns: PLAY_TYPE_COLUMNS.team },
  // Dribble-based
  { playerOffenseEndpoint: 'catch_and_shoot',     teamDefenseEndpoint: 'opponent_catch_and_shoot', label: 'Catch & shoot', playerStatKey: 'FG%', teamStatKey: 'FG%', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: DRIBBLE_COLUMNS.player, teamDisplayColumns: DRIBBLE_COLUMNS.team },
  { playerOffenseEndpoint: 'shots_1_dribble',    teamDefenseEndpoint: 'opponent_shots_1_dribble', label: '1 dribble',  playerStatKey: 'FG%', teamStatKey: 'FG%', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: DRIBBLE_COLUMNS.player, teamDisplayColumns: DRIBBLE_COLUMNS.team },
  { playerOffenseEndpoint: 'shots_2_dribbles',   teamDefenseEndpoint: 'opponent_shots_2_dribbles', label: '2 dribbles', playerStatKey: 'FG%', teamStatKey: 'FG%', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: DRIBBLE_COLUMNS.player, teamDisplayColumns: DRIBBLE_COLUMNS.team },
  { playerOffenseEndpoint: 'shots_3_6_dribbles', teamDefenseEndpoint: 'opponent_shots_3_6_dribbles', label: '3–6 dribbles', playerStatKey: 'FG%', teamStatKey: 'FG%', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: DRIBBLE_COLUMNS.player, teamDisplayColumns: DRIBBLE_COLUMNS.team },
  { playerOffenseEndpoint: 'shots_7plus_dribbles', teamDefenseEndpoint: 'opponent_shots_7plus_dribbles', label: '7+ dribbles', playerStatKey: 'FG%', teamStatKey: 'FG%', higherPlayerBetter: true,  higherTeamValueWorseDefense: true, playerDisplayColumns: DRIBBLE_COLUMNS.player, teamDisplayColumns: DRIBBLE_COLUMNS.team },
  // Rebounding
  { playerOffenseEndpoint: 'offensive_rebounding', teamDefenseEndpoint: 'defensive_rebounding', label: 'OReb vs D', playerStatKey: 'OREB CHANCE%', teamStatKey: 'DREB', higherPlayerBetter: true, higherTeamValueWorseDefense: false, playerDisplayColumns: REB_COLUMNS.player, teamDisplayColumns: REB_COLUMNS.team },
];

/** All team defense endpoints used by matchup factors (for fetching nba_daily_team_stats). */
export function getMatchupTeamDefenseEndpoints(): string[] {
  return [...new Set(MATCHUP_FACTORS.map((f) => f.teamDefenseEndpoint))];
}

/** All player offense endpoints used by matchup factors (for fetching nba_daily_player_stats). */
export function getMatchupPlayerOffenseEndpoints(): string[] {
  return [...new Set(MATCHUP_FACTORS.map((f) => f.playerOffenseEndpoint))];
}
