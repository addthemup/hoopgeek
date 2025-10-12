// NBA Team Colors Library
// Complete color palette for all 30 NBA teams

export interface TeamColors {
  primary: string;
  secondary: string;
  tertiary?: string;
  quaternary?: string;
  quinary?: string;
}

export const NBA_TEAM_COLORS: Record<string, TeamColors> = {
  // Atlanta Hawks
  'ATL': {
    primary: '#E03A3E',    // Hawks Red
    secondary: '#C1D32F',  // Volt Green
    tertiary: '#26282A',   // Hawks Charcoal
  },
  'Atlanta Hawks': {
    primary: '#E03A3E',
    secondary: '#C1D32F',
    tertiary: '#26282A',
  },

  // Boston Celtics
  'BOS': {
    primary: '#007A33',    // Celtics Green
    secondary: '#BA9653',  // Celtics Gold
    tertiary: '#963821',   // Celtics Brown
    quaternary: '#FFFFFF', // White
    quinary: '#000000',    // Celtics Black
  },
  'Boston Celtics': {
    primary: '#007A33',
    secondary: '#BA9653',
    tertiary: '#963821',
    quaternary: '#FFFFFF',
    quinary: '#000000',
  },

  // Brooklyn Nets
  'BKN': {
    primary: '#000000',    // Black
    secondary: '#FFFFFF',  // White
  },
  'Brooklyn Nets': {
    primary: '#000000',
    secondary: '#FFFFFF',
  },

  // Charlotte Hornets
  'CHA': {
    primary: '#1D1160',    // Hornets Purple
    secondary: '#00788C',  // Teal
    tertiary: '#A1A1A4',   // Gray
  },
  'Charlotte Hornets': {
    primary: '#1D1160',
    secondary: '#00788C',
    tertiary: '#A1A1A4',
  },

  // Chicago Bulls
  'CHI': {
    primary: '#CE1141',    // Bulls Red
    secondary: '#000000',  // Black
  },
  'Chicago Bulls': {
    primary: '#CE1141',
    secondary: '#000000',
  },

  // Cleveland Cavaliers
  'CLE': {
    primary: '#860038',    // Cavaliers Wine
    secondary: '#041E42',  // Cavaliers Navy
    tertiary: '#FDBB30',   // Cavaliers Gold
    quaternary: '#000000', // Cavaliers Black
  },
  'Cleveland Cavaliers': {
    primary: '#860038',
    secondary: '#041E42',
    tertiary: '#FDBB30',
    quaternary: '#000000',
  },

  // Dallas Mavericks
  'DAL': {
    primary: '#00538C',    // Royal Blue
    secondary: '#002B5E',  // Navy Blue
    tertiary: '#B8C4CA',   // Silver
    quaternary: '#000000', // Black
  },
  'Dallas Mavericks': {
    primary: '#00538C',
    secondary: '#002B5E',
    tertiary: '#B8C4CA',
    quaternary: '#000000',
  },

  // Denver Nuggets
  'DEN': {
    primary: '#0E2240',    // Midnight Blue
    secondary: '#FEC524',  // Sunshine Yellow
    tertiary: '#8B2131',   // Flatirons Red
    quaternary: '#1D428A', // Skyline Blue
  },
  'Denver Nuggets': {
    primary: '#0E2240',
    secondary: '#FEC524',
    tertiary: '#8B2131',
    quaternary: '#1D428A',
  },

  // Detroit Pistons
  'DET': {
    primary: '#C8102E',    // Red
    secondary: '#1D42BA',  // Royal
    tertiary: '#BEC0C2',   // Gray
    quaternary: '#002D62', // Navy
  },
  'Detroit Pistons': {
    primary: '#C8102E',
    secondary: '#1D42BA',
    tertiary: '#BEC0C2',
    quaternary: '#002D62',
  },

  // Golden State Warriors
  'GSW': {
    primary: '#1D428A',    // Warriors Blue
    secondary: '#FFC72C',  // Golden Yellow
  },
  'Golden State Warriors': {
    primary: '#1D428A',
    secondary: '#FFC72C',
  },

  // Houston Rockets
  'HOU': {
    primary: '#CE1141',    // Red
    secondary: '#000000',  // Black
    tertiary: '#C4CED4',   // Silver
  },
  'Houston Rockets': {
    primary: '#CE1141',
    secondary: '#000000',
    tertiary: '#C4CED4',
  },

  // Indiana Pacers
  'IND': {
    primary: '#002D62',    // Pacers Blue
    secondary: '#FDBB30',  // Yellow
    tertiary: '#BEC0C2',   // Silver
  },
  'Indiana Pacers': {
    primary: '#002D62',
    secondary: '#FDBB30',
    tertiary: '#BEC0C2',
  },

  // Los Angeles Clippers
  'LAC': {
    primary: '#C8102E',    // Red
    secondary: '#1D428A',  // Blue
    tertiary: '#BEC0C2',   // Silver
    quaternary: '#000000', // Black
  },
  'Los Angeles Clippers': {
    primary: '#C8102E',
    secondary: '#1D428A',
    tertiary: '#BEC0C2',
    quaternary: '#000000',
  },

  // Los Angeles Lakers
  'LAL': {
    primary: '#552583',    // Lakers Purple
    secondary: '#FDB927',  // Gold
    tertiary: '#000000',   // Black
  },
  'Los Angeles Lakers': {
    primary: '#552583',
    secondary: '#FDB927',
    tertiary: '#000000',
  },

  // Memphis Grizzlies
  'MEM': {
    primary: '#5D76A9',    // Blue
    secondary: '#12173F',  // Navy
    tertiary: '#F5B112',   // Yellow
    quaternary: '#707271', // Gray
  },
  'Memphis Grizzlies': {
    primary: '#5D76A9',
    secondary: '#12173F',
    tertiary: '#F5B112',
    quaternary: '#707271',
  },

  // Miami Heat
  'MIA': {
    primary: '#98002E',    // Red
    secondary: '#F9A01B',  // Yellow
    tertiary: '#000000',   // Black
  },
  'Miami Heat': {
    primary: '#98002E',
    secondary: '#F9A01B',
    tertiary: '#000000',
  },

  // Milwaukee Bucks
  'MIL': {
    primary: '#00471B',    // Good Land Green
    secondary: '#EEE1C6',  // Cream City Cream
    tertiary: '#0077C0',   // Great Lakes Blue
    quaternary: '#000000', // Black
  },
  'Milwaukee Bucks': {
    primary: '#00471B',
    secondary: '#EEE1C6',
    tertiary: '#0077C0',
    quaternary: '#000000',
  },

  // Minnesota Timberwolves
  'MIN': {
    primary: '#0C2340',    // Midnight Blue
    secondary: '#236192',  // Lake Blue
    tertiary: '#9EA2A2',   // Moonlight Grey
    quaternary: '#78BE20', // Aurora Green
  },
  'Minnesota Timberwolves': {
    primary: '#0C2340',
    secondary: '#236192',
    tertiary: '#9EA2A2',
    quaternary: '#78BE20',
  },

  // New Orleans Pelicans
  'NOP': {
    primary: '#0C2340',    // Pelicans Navy
    secondary: '#C8102E',  // Pelicans Red
    tertiary: '#85714D',   // Pelicans Gold
  },
  'New Orleans Pelicans': {
    primary: '#0C2340',
    secondary: '#C8102E',
    tertiary: '#85714D',
  },

  // New York Knicks
  'NYK': {
    primary: '#006BB6',    // Knicks Blue
    secondary: '#F58426',  // Knicks Orange
    tertiary: '#BEC0C2',   // Knicks Silver
    quaternary: '#000000', // Knicks Black
  },
  'New York Knicks': {
    primary: '#006BB6',
    secondary: '#F58426',
    tertiary: '#BEC0C2',
    quaternary: '#000000',
  },

  // Oklahoma City Thunder
  'OKC': {
    primary: '#007AC1',    // Thunder Blue
    secondary: '#EF3B24',  // Sunset
    tertiary: '#002D62',   // Blue
    quaternary: '#FDBB30', // Yellow
  },
  'Oklahoma City Thunder': {
    primary: '#007AC1',
    secondary: '#EF3B24',
    tertiary: '#002D62',
    quaternary: '#FDBB30',
  },

  // Orlando Magic
  'ORL': {
    primary: '#0077C0',    // Magic Blue
    secondary: '#C4CED4',  // Silver
    tertiary: '#000000',   // Black
  },
  'Orlando Magic': {
    primary: '#0077C0',
    secondary: '#C4CED4',
    tertiary: '#000000',
  },

  // Philadelphia 76ers
  'PHI': {
    primary: '#006BB6',    // Blue
    secondary: '#ED174C',  // Red
    tertiary: '#002B5C',   // Navy
    quaternary: '#C4CED4', // Silver
  },
  'Philadelphia 76ers': {
    primary: '#006BB6',
    secondary: '#ED174C',
    tertiary: '#002B5C',
    quaternary: '#C4CED4',
  },

  // Phoenix Suns
  'PHX': {
    primary: '#1D1160',    // Purple
    secondary: '#E56020',  // Orange
    tertiary: '#000000',   // Black
    quaternary: '#63727A', // Gray
    quinary: '#F9AD1B',    // Yellow
  },
  'Phoenix Suns': {
    primary: '#1D1160',
    secondary: '#E56020',
    tertiary: '#000000',
    quaternary: '#63727A',
    quinary: '#F9AD1B',
  },

  // Portland Trail Blazers
  'POR': {
    primary: '#E03A3E',    // Red
    secondary: '#000000',  // Black
  },
  'Portland Trail Blazers': {
    primary: '#E03A3E',
    secondary: '#000000',
  },

  // Sacramento Kings
  'SAC': {
    primary: '#5A2D81',    // Purple
    secondary: '#63727A',  // Gray
    tertiary: '#000000',   // Black
  },
  'Sacramento Kings': {
    primary: '#5A2D81',
    secondary: '#63727A',
    tertiary: '#000000',
  },

  // San Antonio Spurs
  'SAS': {
    primary: '#C4CED4',    // Silver
    secondary: '#000000',  // Black
  },
  'San Antonio Spurs': {
    primary: '#C4CED4',
    secondary: '#000000',
  },

  // Toronto Raptors
  'TOR': {
    primary: '#CE1141',    // Red
    secondary: '#000000',  // Black
    tertiary: '#A1A1A4',   // Silver
    quaternary: '#B4975A', // Gold
  },
  'Toronto Raptors': {
    primary: '#CE1141',
    secondary: '#000000',
    tertiary: '#A1A1A4',
    quaternary: '#B4975A',
  },

  // Utah Jazz
  'UTA': {
    primary: '#002B5C',    // Navy
    secondary: '#00471B',  // Green
    tertiary: '#F9A01B',   // Yellow
  },
  'Utah Jazz': {
    primary: '#002B5C',
    secondary: '#00471B',
    tertiary: '#F9A01B',
  },

  // Washington Wizards
  'WAS': {
    primary: '#002B5C',    // Navy Blue
    secondary: '#E31837',  // Red
    tertiary: '#C4CED4',   // Silver
  },
  'Washington Wizards': {
    primary: '#002B5C',
    secondary: '#E31837',
    tertiary: '#C4CED4',
  },
};

/**
 * Get team colors by team abbreviation or full name
 */
export const getTeamColors = (teamIdentifier: string): TeamColors => {
  const colors = NBA_TEAM_COLORS[teamIdentifier];
  
  if (colors) {
    return colors;
  }
  
  // Default fallback colors
  return {
    primary: '#1D428A',
    secondary: '#FFC72C',
  };
};

/**
 * Get primary color for a team
 */
export const getTeamPrimaryColor = (teamIdentifier: string): string => {
  return getTeamColors(teamIdentifier).primary;
};

/**
 * Get secondary color for a team
 */
export const getTeamSecondaryColor = (teamIdentifier: string): string => {
  return getTeamColors(teamIdentifier).secondary;
};

