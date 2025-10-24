// NBA Team ID to Team Name and Tricode mappings
export const NBA_TEAM_ID_MAP: Record<string, { name: string; tricode: string; city: string }> = {
  '1610612737': { name: 'Hawks', tricode: 'ATL', city: 'Atlanta' },
  '1610612738': { name: 'Celtics', tricode: 'BOS', city: 'Boston' },
  '1610612751': { name: 'Nets', tricode: 'BKN', city: 'Brooklyn' },
  '1610612766': { name: 'Hornets', tricode: 'CHA', city: 'Charlotte' },
  '1610612741': { name: 'Bulls', tricode: 'CHI', city: 'Chicago' },
  '1610612739': { name: 'Cavaliers', tricode: 'CLE', city: 'Cleveland' },
  '1610612742': { name: 'Mavericks', tricode: 'DAL', city: 'Dallas' },
  '1610612743': { name: 'Nuggets', tricode: 'DEN', city: 'Denver' },
  '1610612765': { name: 'Pistons', tricode: 'DET', city: 'Detroit' },
  '1610612744': { name: 'Warriors', tricode: 'GSW', city: 'Golden State' },
  '1610612745': { name: 'Rockets', tricode: 'HOU', city: 'Houston' },
  '1610612754': { name: 'Pacers', tricode: 'IND', city: 'Indiana' },
  '1610612746': { name: 'Clippers', tricode: 'LAC', city: 'LA' },
  '1610612747': { name: 'Lakers', tricode: 'LAL', city: 'Los Angeles' },
  '1610612763': { name: 'Grizzlies', tricode: 'MEM', city: 'Memphis' },
  '1610612748': { name: 'Heat', tricode: 'MIA', city: 'Miami' },
  '1610612749': { name: 'Bucks', tricode: 'MIL', city: 'Milwaukee' },
  '1610612750': { name: 'Timberwolves', tricode: 'MIN', city: 'Minnesota' },
  '1610612740': { name: 'Pelicans', tricode: 'NOP', city: 'New Orleans' },
  '1610612752': { name: 'Knicks', tricode: 'NYK', city: 'New York' },
  '1610612760': { name: 'Thunder', tricode: 'OKC', city: 'Oklahoma City' },
  '1610612753': { name: 'Magic', tricode: 'ORL', city: 'Orlando' },
  '1610612755': { name: '76ers', tricode: 'PHI', city: 'Philadelphia' },
  '1610612756': { name: 'Suns', tricode: 'PHX', city: 'Phoenix' },
  '1610612757': { name: 'Trail Blazers', tricode: 'POR', city: 'Portland' },
  '1610612758': { name: 'Kings', tricode: 'SAC', city: 'Sacramento' },
  '1610612759': { name: 'Spurs', tricode: 'SAS', city: 'San Antonio' },
  '1610612761': { name: 'Raptors', tricode: 'TOR', city: 'Toronto' },
  '1610612762': { name: 'Jazz', tricode: 'UTA', city: 'Utah' },
  '1610612764': { name: 'Wizards', tricode: 'WAS', city: 'Washington' },
};

export function getTeamInfo(teamId: string): { name: string; tricode: string; city: string; fullName: string } {
  const team = NBA_TEAM_ID_MAP[teamId];
  if (!team) {
    return { name: 'Unknown', tricode: 'UNK', city: 'Unknown', fullName: 'Unknown Team' };
  }
  return {
    ...team,
    fullName: `${team.city} ${team.name}`,
  };
}


