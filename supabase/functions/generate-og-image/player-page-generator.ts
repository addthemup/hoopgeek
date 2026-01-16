// Player Page OG Image Generator
// Generates OG images for player page share links

import {
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  getTeamLogoUrl,
  getPlayerAvatarUrl,
  fetchImageAsBase64,
  getTeamPrimaryColor,
  getTeamSecondaryColor,
  escapeHtml,
  calculateFantasyPoints,
} from './og-image-utils.ts'

export interface PlayerPageData {
  nba_player_id: number
  name: string
  position?: string
  team_abbreviation?: string
  team_tricode?: string
  jersey_number?: string
  // Season stats (2025-26)
  ppg?: number
  rpg?: number
  apg?: number
  avg_fantasy_points?: number
  games_played?: number
  // Fantasy points progression for chart background
  fantasy_points_progression?: Array<{ game: number; fp: number }>
}

export async function generatePlayerPageOGImage(
  player: PlayerPageData
): Promise<Uint8Array> {
  const width = OG_IMAGE_WIDTH
  const height = OG_IMAGE_HEIGHT
  
  // Get team colors
  const teamTricode = player.team_tricode || player.team_abbreviation || ''
  const teamPrimaryColor = teamTricode ? getTeamPrimaryColor(teamTricode) : '#1a1a1a'
  const teamSecondaryColor = teamTricode ? getTeamSecondaryColor(teamTricode) : '#FFFFFF'
  
  // Fetch player avatar
  const playerAvatarUrl = getPlayerAvatarUrl(player.nba_player_id)
  const playerAvatarBase64 = await fetchImageAsBase64(playerAvatarUrl)
  
  // Fetch team logo if available
  let teamLogoBase64: string | null = null
  if (teamTricode) {
    const teamLogoUrl = getTeamLogoUrl(teamTricode)
    teamLogoBase64 = await fetchImageAsBase64(teamLogoUrl)
  }
  
  // Format stats
  const ppg = player.ppg ? player.ppg.toFixed(1) : 'N/A'
  const rpg = player.rpg ? player.rpg.toFixed(1) : 'N/A'
  const apg = player.apg ? player.apg.toFixed(1) : 'N/A'
  const avgFP = player.avg_fantasy_points ? player.avg_fantasy_points.toFixed(1) : 'N/A'
  const gamesPlayed = player.games_played || 0
  
  // Format position
  const position = player.position || ''
  const jerseyNumber = player.jersey_number ? `#${player.jersey_number}` : ''
  
  // Generate fantasy points progression chart data (for background)
  let chartPath = ''
  let chartPoints = ''
  if (player.fantasy_points_progression && player.fantasy_points_progression.length > 0) {
    const progression = player.fantasy_points_progression
    const chartPadding = 100
    const chartWidth = width - (chartPadding * 2)
    const chartHeight = height - (chartPadding * 2)
    const minFP = Math.min(...progression.map(p => p.fp))
    const maxFP = Math.max(...progression.map(p => p.fp))
    const fpRange = maxFP - minFP || 1 // Avoid division by zero
    
    // Build path for line chart
    const points = progression.map((point, index) => {
      const x = chartPadding + (index / (progression.length - 1 || 1)) * chartWidth
      const y = chartPadding + chartHeight - ((point.fp - minFP) / fpRange) * chartHeight
      return { x, y, fp: point.fp }
    })
    
    // Create smooth line path
    if (points.length > 1) {
      chartPath = `M ${points[0].x} ${points[0].y}`
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const curr = points[i]
        const cp1x = prev.x + (curr.x - prev.x) / 3
        const cp1y = prev.y
        const cp2x = curr.x - (curr.x - prev.x) / 3
        const cp2y = curr.y
        chartPath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`
      }
    }
    
    // Create data points (small circles)
    chartPoints = points.map(p => 
      `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${teamPrimaryColor}" opacity="0.6"/>`
    ).join('\n        ')
  }
  
  // Build SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <style>
        .player-name { font-family: Arial, sans-serif; font-weight: bold; fill: white; }
        .position-text { font-family: Arial, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.9); }
        .stat-value { font-family: Arial, sans-serif; font-weight: bold; fill: #FFC72C; }
        .stat-label { font-family: Arial, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.85); }
        .team-text { font-family: Arial, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.9); }
      </style>
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.3"/>
      </filter>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${teamPrimaryColor};stop-opacity:0.9" />
        <stop offset="100%" style="stop-color:${teamPrimaryColor};stop-opacity:0.7" />
      </linearGradient>
      <clipPath id="player-avatar-clip">
        <circle cx="180" cy="180" r="100"/>
      </clipPath>
    </defs>
    
    <!-- Background with team colors -->
    <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgGradient)"/>
    
    <!-- Fantasy Points Progression Chart Background (25% opacity) -->
    ${chartPath ? `
    <g opacity="0.25">
      <!-- Chart line -->
      <path 
        d="${chartPath}" 
        fill="none" 
        stroke="white" 
        stroke-width="4" 
        stroke-linecap="round" 
        stroke-linejoin="round"/>
      <!-- Chart data points -->
      ${chartPoints}
    </g>
    ` : ''}
    
    <!-- Team logo background (subtle, top right) -->
    ${teamLogoBase64 ? `
      <g transform="translate(${width - 200}, 40)" opacity="0.15">
        <image 
          href="${teamLogoBase64}" 
          x="0" 
          y="0" 
          width="160" 
          height="160" 
          preserveAspectRatio="xMidYMid meet"/>
      </g>
    ` : ''}
    
    <!-- Player avatar (smaller, top left) -->
    <g>
      ${playerAvatarBase64 ? `
        <image 
          href="${playerAvatarBase64}" 
          x="80" 
          y="80" 
          width="200" 
          height="200" 
          preserveAspectRatio="xMidYMid meet"
          clip-path="url(#player-avatar-clip)"
          filter="url(#shadow)"/>
      ` : `
        <circle 
          cx="180" 
          cy="180" 
          r="100" 
          fill="rgba(0,0,0,0.3)"/>
        <text 
          x="180" 
          y="200" 
          class="player-name" 
          font-size="36" 
          text-anchor="middle">${escapeHtml(player.name || 'Player')}</text>
      `}
      
      <!-- Avatar border -->
      <circle 
        cx="180" 
        cy="180" 
        r="100" 
        fill="none" 
        stroke="rgba(255,255,255,0.4)" 
        stroke-width="3"/>
    </g>
    
    <!-- Player name and info (top left, next to avatar) -->
    <g transform="translate(320, 120)">
      <text 
        x="0" 
        y="0" 
        class="player-name" 
        font-size="56" 
        font-weight="700"
        text-anchor="start"
        filter="url(#shadow)">${escapeHtml(player.name || 'Player')}</text>
      
      ${position || jerseyNumber ? `
        <g transform="translate(0, 50)">
          <text 
            x="0" 
            y="0" 
            class="position-text" 
            font-size="28" 
            font-weight="600"
            text-anchor="start"
            filter="url(#shadow)">
            ${position ? `${position}` : ''}${position && jerseyNumber ? ' • ' : ''}${jerseyNumber}
          </text>
        </g>
      ` : ''}
      
      ${teamTricode ? `
        <g transform="translate(0, 90)">
          <text 
            x="0" 
            y="0" 
            class="team-text" 
            font-size="32" 
            font-weight="600"
            text-anchor="start"
            filter="url(#shadow)">${teamTricode}</text>
        </g>
      ` : ''}
      
      ${gamesPlayed > 0 ? `
        <g transform="translate(0, 130)">
          <text 
            x="0" 
            y="0" 
            class="team-text" 
            font-size="24" 
            font-weight="500"
            text-anchor="start"
            opacity="0.8"
            filter="url(#shadow)">${gamesPlayed} games</text>
        </g>
      ` : ''}
    </g>
    
    <!-- Stats section (bottom center, larger and more prominent) -->
    <g transform="translate(${width/2}, ${height - 100})">
      <!-- Stats background -->
      <rect 
        x="-450" 
        y="-50" 
        width="900" 
        height="120" 
        rx="16" 
        fill="rgba(0, 0, 0, 0.5)" 
        stroke="rgba(255, 255, 255, 0.25)" 
        stroke-width="2"
        opacity="0.95"/>
      
      <!-- Stats grid -->
      <g transform="translate(-400, -30)">
        <!-- PPG -->
        <g transform="translate(0, 0)">
          <text 
            x="0" 
            y="0" 
            class="stat-label" 
            font-size="22" 
            font-weight="600"
            text-anchor="start">PPG</text>
          <text 
            x="0" 
            y="38" 
            class="stat-value" 
            font-size="42" 
            font-weight="700"
            text-anchor="start"
            filter="url(#shadow)">${ppg}</text>
        </g>
        
        <!-- RPG -->
        <g transform="translate(200, 0)">
          <text 
            x="0" 
            y="0" 
            class="stat-label" 
            font-size="22" 
            font-weight="600"
            text-anchor="start">RPG</text>
          <text 
            x="0" 
            y="38" 
            class="stat-value" 
            font-size="42" 
            font-weight="700"
            text-anchor="start"
            filter="url(#shadow)">${rpg}</text>
        </g>
        
        <!-- APG -->
        <g transform="translate(400, 0)">
          <text 
            x="0" 
            y="0" 
            class="stat-label" 
            font-size="22" 
            font-weight="600"
            text-anchor="start">APG</text>
          <text 
            x="0" 
            y="38" 
            class="stat-value" 
            font-size="42" 
            font-weight="700"
            text-anchor="start"
            filter="url(#shadow)">${apg}</text>
        </g>
        
        <!-- Fantasy Points -->
        <g transform="translate(600, 0)">
          <text 
            x="0" 
            y="0" 
            class="stat-label" 
            font-size="22" 
            font-weight="600"
            text-anchor="start">FP</text>
          <text 
            x="0" 
            y="38" 
            class="stat-value" 
            font-size="42" 
            font-weight="700"
            text-anchor="start"
            filter="url(#shadow)">${avgFP}</text>
        </g>
      </g>
    </g>
    
    <!-- HoopGeek branding (bottom right) -->
    <text 
      x="${width - 40}" 
      y="${height - 30}" 
      class="position-text" 
      font-size="28" 
      text-anchor="end"
      opacity="0.7">HoopGeek</text>
  </svg>
  `
  
  return new TextEncoder().encode(svg)
}

