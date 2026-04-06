/**
 * Rulebook: bet_type → opposition data we use for prop predictions.
 * Single source of truth for:
 * - nba_daily_team_stats: which endpoint(s) and column(s) to use for the opposition team
 * - nba_daily_player_stats: which stat(s) to use for the opposition team (opponent context)
 *
 * Used by: Hit rate (last 10) is separate; this governs "team confidence" and "player confidence" tabs
 * and the eventual combined confidence formula.
 */

/** How a team stat value affects over/under confidence (from the perspective of the opposition team's stat). */
export type TeamStatInterpretation =
  | 'higher_favors_over'   // e.g. opposition allows more points → over on our player's points
  | 'lower_favors_over';   // e.g. opposition grabs fewer defensive rebounds → more rebounds available → over on our player's rebounds

/** One rule: which column(s) from an nba_daily_team_stats endpoint to use for this bet_type. */
export interface PropPredictionsTeamStatRule {
  /** endpoint_name in nba_daily_team_stats (e.g. defense_dash_overall, defensive_rebounding). */
  endpointName: string;
  /** Column key(s) in the endpoint's data rows (e.g. "DFG%", "DREB"). First is primary. */
  columns: string[];
  /** How to interpret the opposition team's value for over/under. */
  interpretation: TeamStatInterpretation;
  /** Human-readable description for the Rulebook tab. */
  description: string;
}

/**
 * Opposition player stats: what we look at in nba_daily_player_stats for the opposition team.
 * Schema of nba_daily_player_stats may be endpoint_name + data (like team stats) or flat columns.
 * This defines which stat key(s) or endpoint to use per bet_type.
 */
export interface PropPredictionsPlayerStatRule {
  /** If nba_daily_player_stats uses endpoint_name + data, the endpoint to use (e.g. "opponent_pts_allowed"). */
  endpointName?: string;
  /** Stat key(s) in the data (e.g. "PTS_ALLOWED", "REB_ALLOWED"). Matches boxscore-style or custom. */
  statKeys: string[];
  /** Human-readable description for the Rulebook tab. */
  description: string;
}

/** Full rulebook entry per bet_type (normalized key). */
export interface PropPredictionsRulebookEntry {
  /** Normalized bet_type key (e.g. "points", "rebounds", "threes"). */
  betType: string;
  /** Display label (e.g. "PTS", "REB", "3PM"). */
  label: string;
  teamStats: PropPredictionsTeamStatRule[];
  playerStats: PropPredictionsPlayerStatRule;
}

/** Normalize bet_type for rulebook lookup (lowercase, no spaces, underscores as-is or normalized). */
export function normalizeBetTypeForRulebook(betType: string): string {
  return betType
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '_')
    .replace(/\+/g, '_');
}

/**
 * Canonical list of bet types we support in the rulebook.
 * Order and keys should align with playerPropsCalculator and feed.
 */
const RULEBOOK_ENTRIES: PropPredictionsRulebookEntry[] = [
  {
    betType: 'points',
    label: 'PTS',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%', 'DIFF%'],
        interpretation: 'higher_favors_over',
        description: 'Opposition team’s overall defense (DFG%, DIFF%). Higher allowed = more favorable for over on points.',
      },
    ],
    playerStats: {
      statKeys: ['pts_allowed_per_game'],
      description: 'Opposition team’s allowed points per game to opposing players (from nba_daily_player_stats).',
    },
  },
  {
    betType: 'rebounds',
    label: 'REB',
    teamStats: [
      {
        endpointName: 'defensive_rebounding',
        columns: ['DREB'],
        interpretation: 'lower_favors_over',
        description: 'Opposition team’s defensive rebounds (DREB). Lower = more boards available for our player → favor over.',
      },
    ],
    playerStats: {
      statKeys: ['reb_allowed_per_game'],
      description: 'Opposition team’s allowed rebounds per game to opposing players.',
    },
  },
  {
    betType: 'assists',
    label: 'AST',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%'],
        interpretation: 'higher_favors_over',
        description: 'Opposition defense (FG%). Higher allowed shooting can mean more assists for our player.',
      },
    ],
    playerStats: {
      statKeys: ['ast_allowed_per_game'],
      description: 'Opposition team’s allowed assists per game to opposing players.',
    },
  },
  {
    betType: 'threes',
    label: '3PM',
    teamStats: [
      {
        endpointName: 'isolation_defense',
        columns: ['FG%', 'PPP'],
        interpretation: 'higher_favors_over',
        description: 'Opposition isolation defense: higher FG%/PPP allowed = worse D = favor over on 3PM.',
      },
      {
        endpointName: 'opponent_shots_1_dribble',
        columns: ['3P%'],
        interpretation: 'higher_favors_over',
        description: 'Opponent 3P% allowed on 1-dribble shots. Higher = worse D = favor over on 3PM.',
      },
      {
        endpointName: 'opponent_catch_and_shoot',
        columns: ['3P%'],
        interpretation: 'higher_favors_over',
        description: 'Opponent catch-and-shoot 3P% allowed. Higher = worse D = favor over on 3PM.',
      },
      {
        endpointName: 'defense_dash_3pt',
        columns: ['DFG%', 'DIFF%'],
        interpretation: 'higher_favors_over',
        description: 'Opposition team’s 3PT defense (DFG%, DIFF%). Higher allowed = more favorable for over on threes.',
      },
    ],
    playerStats: {
      statKeys: ['fg3m_allowed_per_game'],
      description: 'Opposition team’s allowed 3PM per game to opposing players.',
    },
  },
  {
    betType: 'steals',
    label: 'STL',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFGA'],
        interpretation: 'higher_favors_over',
        description: 'Opposition FGA allowed; more attempts can mean more steal opportunities.',
      },
    ],
    playerStats: {
      statKeys: ['stl_allowed_per_game'],
      description: 'Opposition team’s allowed steals context (e.g. turnovers forced).',
    },
  },
  {
    betType: 'blocks',
    label: 'BLK',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFGA'],
        interpretation: 'higher_favors_over',
        description: 'Opposition FGA allowed; more attempts can mean more block opportunities.',
      },
    ],
    playerStats: {
      statKeys: ['blk_allowed_per_game'],
      description: 'Opposition team’s allowed blocks context.',
    },
  },
  {
    betType: 'turnovers',
    label: 'TOV',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%', 'DIFF%'],
        interpretation: 'lower_favors_over',
        description: 'Tighter defense can force more turnovers on our team; lower opposition DIFF% may favor over on our player’s TOV.',
      },
    ],
    playerStats: {
      statKeys: ['tov_forced_per_game'],
      description: 'Opposition team’s forced turnovers per game.',
    },
  },
  {
    betType: 'blocks_steals',
    label: 'STL+BLK',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFGA'],
        interpretation: 'higher_favors_over',
        description: 'Opposition FGA allowed; more attempts → more stocks opportunities.',
      },
    ],
    playerStats: {
      statKeys: ['stl_blk_allowed_per_game'],
      description: 'Opposition team’s combined steals/blocks context.',
    },
  },
  {
    betType: 'points_rebounds_assists',
    label: 'P+R+A',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%', 'DIFF%'],
        interpretation: 'higher_favors_over',
        description: 'Opposition overall defense; higher allowed favors over on PRA.',
      },
      {
        endpointName: 'defensive_rebounding',
        columns: ['DREB'],
        interpretation: 'lower_favors_over',
        description: 'Lower opposition DREB favors rebounds part of PRA.',
      },
    ],
    playerStats: {
      statKeys: ['pts_reb_ast_allowed_per_game'],
      description: 'Opposition team’s allowed PRA to opposing players.',
    },
  },
  {
    betType: 'points_rebounds',
    label: 'P+R',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%'],
        interpretation: 'higher_favors_over',
        description: 'Opposition defense; higher allowed favors points and reb opportunities.',
      },
      {
        endpointName: 'defensive_rebounding',
        columns: ['DREB'],
        interpretation: 'lower_favors_over',
        description: 'Lower opposition DREB favors over on rebounds.',
      },
    ],
    playerStats: {
      statKeys: ['pts_reb_allowed_per_game'],
      description: 'Opposition team’s allowed P+R to opposing players.',
    },
  },
  {
    betType: 'points_assists',
    label: 'P+A',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%', 'DIFF%'],
        interpretation: 'higher_favors_over',
        description: 'Opposition defense; higher allowed favors points and assists.',
      },
    ],
    playerStats: {
      statKeys: ['pts_ast_allowed_per_game'],
      description: 'Opposition team’s allowed P+A to opposing players.',
    },
  },
  {
    betType: 'rebounds_assists',
    label: 'R+A',
    teamStats: [
      {
        endpointName: 'defensive_rebounding',
        columns: ['DREB'],
        interpretation: 'lower_favors_over',
        description: 'Lower opposition DREB favors rebounds.',
      },
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%'],
        interpretation: 'higher_favors_over',
        description: 'Higher opposition FG% allowed favors assists.',
      },
    ],
    playerStats: {
      statKeys: ['reb_ast_allowed_per_game'],
      description: 'Opposition team’s allowed R+A to opposing players.',
    },
  },
  {
    betType: 'freethrowsmade',
    label: 'FTM',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%', 'FREQ'],
        interpretation: 'higher_favors_over',
        description: 'Opposition defense and frequency; more FTA context can favor FTM over.',
      },
    ],
    playerStats: {
      statKeys: ['ftm_allowed_per_game'],
      description: 'Opposition team’s allowed FTM to opposing players.',
    },
  },
  {
    betType: 'fieldgoalsmade',
    label: 'FGM',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFG%', 'DIFF%'],
        interpretation: 'higher_favors_over',
        description: 'Opposition overall defense; higher allowed favors over on FGM.',
      },
    ],
    playerStats: {
      statKeys: ['fgm_allowed_per_game'],
      description: 'Opposition team’s allowed FGM to opposing players.',
    },
  },
  {
    betType: 'fieldgoalsattempted',
    label: 'FGA',
    teamStats: [
      {
        endpointName: 'defense_dash_overall',
        columns: ['DFGA'],
        interpretation: 'higher_favors_over',
        description: 'Opposition FGA allowed; higher = more shot attempts for our player.',
      },
    ],
    playerStats: {
      statKeys: ['fga_allowed_per_game'],
      description: 'Opposition team’s allowed FGA to opposing players.',
    },
  },
  {
    betType: 'threepointersattempted',
    label: '3PA',
    teamStats: [
      {
        endpointName: 'defense_dash_3pt',
        columns: ['DFGA'],
        interpretation: 'higher_favors_over',
        description: 'Opposition 3PA allowed; higher = more 3PA for our player.',
      },
    ],
    playerStats: {
      statKeys: ['fg3a_allowed_per_game'],
      description: 'Opposition team’s allowed 3PA to opposing players.',
    },
  },
];

const BY_NORMALIZED_BET_TYPE = new Map<string, PropPredictionsRulebookEntry>();
for (const entry of RULEBOOK_ENTRIES) {
  BY_NORMALIZED_BET_TYPE.set(normalizeBetTypeForRulebook(entry.betType), entry);
}
// Aliases for common variants
BY_NORMALIZED_BET_TYPE.set('pts', RULEBOOK_ENTRIES[0]);
BY_NORMALIZED_BET_TYPE.set('reb', RULEBOOK_ENTRIES[1]);
BY_NORMALIZED_BET_TYPE.set('ast', RULEBOOK_ENTRIES[2]);
BY_NORMALIZED_BET_TYPE.set('fg3m', RULEBOOK_ENTRIES[3]);
BY_NORMALIZED_BET_TYPE.set('stl', RULEBOOK_ENTRIES[4]);
BY_NORMALIZED_BET_TYPE.set('blk', RULEBOOK_ENTRIES[5]);
BY_NORMALIZED_BET_TYPE.set('tov', RULEBOOK_ENTRIES[6]);
BY_NORMALIZED_BET_TYPE.set('par', RULEBOOK_ENTRIES[8]);
BY_NORMALIZED_BET_TYPE.set('ftm', RULEBOOK_ENTRIES[11]);
BY_NORMALIZED_BET_TYPE.set('fgm', RULEBOOK_ENTRIES[12]);
BY_NORMALIZED_BET_TYPE.set('fga', RULEBOOK_ENTRIES[13]);
BY_NORMALIZED_BET_TYPE.set('fg3a', RULEBOOK_ENTRIES[14]);

/**
 * Get the rulebook entry for a bet_type (uses normalized lookup + aliases).
 */
export function getRulebookEntry(betType: string): PropPredictionsRulebookEntry | undefined {
  const normalized = normalizeBetTypeForRulebook(betType);
  return BY_NORMALIZED_BET_TYPE.get(normalized);
}

/**
 * All rulebook entries (for Rulebook tab display).
 */
export function getAllRulebookEntries(): PropPredictionsRulebookEntry[] {
  return [...RULEBOOK_ENTRIES];
}

/**
 * All nba_daily_team_stats endpoint names referenced by the rulebook.
 */
export function getRulebookTeamStatEndpoints(): string[] {
  const set = new Set<string>();
  for (const entry of RULEBOOK_ENTRIES) {
    for (const rule of entry.teamStats) {
      set.add(rule.endpointName);
    }
  }
  return Array.from(set);
}
