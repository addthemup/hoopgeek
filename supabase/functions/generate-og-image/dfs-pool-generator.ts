// DFS Pool OG Image Generator
// Generates OG images for DFS pool join links

import {
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  getTeamLogoUrl,
  getPlayerAvatarUrl,
  fetchImageAsBase64,
  getTeamPrimaryColor,
  getTeamSecondaryColor,
  escapeHtml,
  formatGameDate,
  getIconSvgPath,
} from './og-image-utils.ts'

export interface DFSPoolData {
  id: string
  name: string
  entry_fee: number
  prize_pool: number | null
  current_entries: number
  max_entries: number | null
  lock_time: string | null
  difficulty_tier: string
  slate_date: string | null
  total_games?: number
  icon_name?: string | null
  html_color_primary?: string | null
  html_color_secondary?: string | null
  lineup_requirements?: any // JSONB object with lineup requirements
  starters_count?: number
  rotation_count?: number
  bench_count?: number
  salary_cap?: number
}

export interface DFSPoolGame {
  home_team: string
  away_team: string
  game_date: string
  game_id?: string
  start_time?: string
}

export async function generateDFSPoolOGImage(
  pool: DFSPoolData,
  games: DFSPoolGame[] = []
): Promise<Uint8Array> {
  const width = OG_IMAGE_WIDTH
  const height = OG_IMAGE_HEIGHT
  
  // Format entry fee
  const entryFee = pool.entry_fee === 0 ? 'FREE' : `$${pool.entry_fee.toFixed(2)}`
  
  // Format prize pool
  const prizePool = pool.prize_pool ? `$${pool.prize_pool.toLocaleString()}` : 'TBD'
  
  // Format entries
  const entries = pool.current_entries || 0
  const maxEntries = pool.max_entries ? pool.max_entries.toString() : '∞'
  
  // Format salary cap
  const salaryCap = pool.salary_cap 
    ? `$${(pool.salary_cap / 1000000).toFixed(1)}M`
    : ''
  
  // Format roster info
  const startersCount = pool.starters_count || 5
  const rotationCount = pool.rotation_count || 3
  const benchCount = pool.bench_count || 0
  const rosterText = `${startersCount} Starters • ${rotationCount} Rotation${benchCount > 0 ? ` • ${benchCount} Bench` : ''}`
  
  // Format lock time - use first game's start time in EST, or fallback to pool lock_time
  let lockTimeStr = ''
  try {
    // Try to get first game's start time
    let timeToFormat: Date | null = null
    if (games && games.length > 0 && games[0].start_time) {
      timeToFormat = new Date(games[0].start_time)
    } else if (pool.lock_time) {
      timeToFormat = new Date(pool.lock_time)
    }
    
    if (timeToFormat) {
      // Convert to EST (UTC-5 or UTC-4 depending on DST)
      // Use toLocaleString with timeZone option for EST
      lockTimeStr = timeToFormat.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
  } catch (e) {
    console.warn('Error formatting lock time:', e)
  }
  
  // Get difficulty tier color
  const difficultyColors: Record<string, string> = {
    'elite': '#FF6B6B',      // Red for hardest
    'pro': '#4ECDC4',        // Teal for medium
    'standard': '#45B7D1',   // Blue for easiest
  }
  const difficultyColor = difficultyColors[pool.difficulty_tier?.toLowerCase() || 'standard'] || '#45B7D1'
  
  // Get icon SVG path for background
  const iconSvgPath = pool.icon_name ? getIconSvgPath(pool.icon_name) : null
  const iconColor = pool.html_color_primary || '#FFC72C'
  
  // Get ALL unique teams from games (not just 4)
  const uniqueTeams = new Set<string>()
  games.forEach(game => {
    if (game.home_team) uniqueTeams.add(game.home_team)
    if (game.away_team) uniqueTeams.add(game.away_team)
  })
  const teamArray = Array.from(uniqueTeams) // Show all teams
  
  // Fetch team logos (1.5x bigger: 120 -> 180)
  const teamLogos: Record<string, string | null> = {}
  for (const team of teamArray) {
    const logoUrl = getTeamLogoUrl(team)
    teamLogos[team] = await fetchImageAsBase64(logoUrl)
  }
  
  // Get required player IDs from lineup requirements
  const requiredPlayerIds: number[] = []
  if (pool.lineup_requirements?.required_player_ids) {
    requiredPlayerIds.push(...pool.lineup_requirements.required_player_ids)
  }
  
  // Fetch player avatars (limit to 5 for display)
  const playerAvatars: Record<number, string | null> = {}
  for (const playerId of requiredPlayerIds.slice(0, 5)) {
    const avatarUrl = getPlayerAvatarUrl(playerId)
    playerAvatars[playerId] = await fetchImageAsBase64(avatarUrl)
  }
  
  // Build clipPath definitions for player avatars
  const avatarClipPaths = requiredPlayerIds.slice(0, 5).map((playerId, index) => {
    const avatarSize = 113  // 1.25x of 90px (which was 1.5x of original 60px)
    return `<clipPath id="avatar-clip-${playerId}">
      <circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2 - 2}"/>
    </clipPath>`
  }).join('\n      ')
  
  // Build SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <style>
        .title-text { font-family: Arial, sans-serif; font-weight: bold; fill: white; }
        .subtitle-text { font-family: Arial, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.95); }
        .value-text { font-family: Arial, sans-serif; font-weight: bold; fill: #FFC72C; }
        .label-text { font-family: Arial, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.9); }
      </style>
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.3"/>
      </filter>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#2d2d2d;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="difficultyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:${difficultyColor};stop-opacity:0.8" />
        <stop offset="100%" style="stop-color:${difficultyColor};stop-opacity:0.6" />
      </linearGradient>
      ${avatarClipPaths}
    </defs>
    
    <!-- Background - Black with icon SVG -->
    <rect x="0" y="0" width="${width}" height="${height}" fill="#000000"/>
    
    ${iconSvgPath ? `
      <!-- Icon SVG Background (centered, large, low opacity) -->
      <g transform="translate(${width/2}, ${height/2})" opacity="0.15">
        <path 
          d="${iconSvgPath}" 
          fill="${iconColor}" 
          transform="scale(8) translate(-50, -50)"
        />
      </g>
    ` : ''}
    
    <!-- Difficulty tier accent bar (top) -->
    <rect x="0" y="0" width="${width}" height="12" fill="url(#difficultyGradient)"/>
    
    <!-- Team logos (right side, 2-column format, showing ALL teams) -->
    ${teamArray.length > 0 ? `
      <g transform="translate(${width - 250}, 120)">
        ${teamArray.map((team, index) => {
          const logoSize = 45  // 90% of 50px
          const columnWidth = 80
          const rowHeight = 60
          const column = index % 2  // Always use two columns
          const row = Math.floor(index / 2)
          const x = column * columnWidth
          const y = row * rowHeight
          const logoBase64 = teamLogos[team]
          
          return `
            <g transform="translate(${x}, ${y})">
              ${logoBase64 ? `
                <image 
                  href="${logoBase64}" 
                  x="0" 
                  y="0" 
                  width="${logoSize}" 
                  height="${logoSize}" 
                  preserveAspectRatio="xMidYMid meet"
                  filter="url(#shadow)"
                  opacity="0.85"/>
              ` : `
                <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="${getTeamPrimaryColor(team)}" opacity="0.6"/>
                <text x="${logoSize/2}" y="${logoSize/2 + 5}" class="subtitle-text" font-size="14" text-anchor="middle">${team}</text>
              `}
            </g>
          `
        }).join('')}
      </g>
    ` : ''}
    
    <!-- Title -->
    <g transform="translate(80, 120)">
      <text 
        x="0" 
        y="0" 
        class="title-text" 
        font-size="52" 
        font-weight="700"
        text-anchor="start"
        filter="url(#shadow)">HoopGeek Daily Fantasy Challenges</text>
    </g>
    
    <!-- Main content area -->
    <g transform="translate(80, 200)">
      <!-- Pool Name with Difficulty Badge and Lock Time -->
      <g transform="translate(0, 0)">
        <text 
          x="0" 
          y="0" 
          class="subtitle-text" 
          font-size="42" 
          font-weight="700"
          text-anchor="start"
          filter="url(#shadow)">${escapeHtml(pool.name || 'DFS Contest')}</text>
        
        <!-- Difficulty Tier Badge (directly to the right of pool name) -->
        <g transform="translate(420, -30)">
          <rect 
            x="0" 
            y="0" 
            width="120" 
            height="45" 
            rx="8" 
            fill="${difficultyColor}" 
            stroke="#fff" 
            stroke-width="2"
            filter="url(#shadow)"
            opacity="0.9"/>
          <text 
            x="60" 
            y="28" 
            class="title-text" 
            font-size="22" 
            font-weight="700"
            text-anchor="middle">${pool.difficulty_tier?.toUpperCase() || 'STANDARD'}</text>
        </g>
        
        <!-- Lock Time (to the right of difficulty badge) -->
        ${lockTimeStr ? `
          <g transform="translate(560, -30)">
            <text 
              x="0" 
              y="28" 
              class="subtitle-text" 
              font-size="24" 
              font-weight="600"
              text-anchor="start"
              filter="url(#shadow)">🔒 ${lockTimeStr}</text>
          </g>
        ` : ''}
      </g>
      
      <!-- Stats Table (organized in 3 columns) -->
      <g transform="translate(0, 70)">
        <!-- Table background -->
        <rect 
          x="0" 
          y="0" 
          width="800" 
          height="220" 
          rx="8" 
          fill="rgba(0, 0, 0, 0.3)" 
          stroke="rgba(255, 255, 255, 0.1)" 
          stroke-width="1"
          opacity="0.8"/>
        
        <!-- Row 1: Entry Fee, Entries, Prize Pool, Roster Requirements -->
        <g transform="translate(20, 20)">
          <!-- Entry Fee -->
          <text 
            x="0" 
            y="0" 
            class="label-text" 
            font-size="22" 
            font-weight="600"
            text-anchor="start"
            fill="rgba(255,255,255,0.9)">Entry Fee</text>
          <text 
            x="0" 
            y="35" 
            class="value-text" 
            font-size="36" 
            font-weight="700"
            text-anchor="start"
            filter="url(#shadow)">${entryFee}</text>
          
          <!-- Entries -->
          <g transform="translate(200, 0)">
            <text 
              x="0" 
              y="0" 
              class="label-text" 
              font-size="22" 
              font-weight="600"
              text-anchor="start"
              fill="rgba(255,255,255,0.9)">Entries</text>
            <text 
              x="0" 
              y="35" 
              class="value-text" 
              font-size="36" 
              font-weight="700"
              text-anchor="start"
              filter="url(#shadow)">${entries}/${maxEntries}</text>
          </g>
          
          <!-- Prize Pool -->
          <g transform="translate(400, 0)">
            <text 
              x="0" 
              y="0" 
              class="label-text" 
              font-size="22" 
              font-weight="600"
              text-anchor="start"
              fill="rgba(255,255,255,0.9)">Prize Pool</text>
            <text 
              x="0" 
              y="35" 
              class="value-text" 
              font-size="36" 
              font-weight="700"
              text-anchor="start"
              filter="url(#shadow)">${prizePool}</text>
          </g>
          
          <!-- Roster Requirements (4th column in row 1) - will be populated by lineup requirements section -->
        </g>
        
        <!-- Row 2: Games, Salary Cap -->
        <g transform="translate(20, 100)">
          <!-- Games -->
          ${pool.total_games ? `
            <text 
              x="0" 
              y="0" 
              class="label-text" 
              font-size="22" 
              font-weight="600"
              text-anchor="start"
              fill="rgba(255,255,255,0.9)">Games</text>
            <text 
              x="0" 
              y="35" 
              class="value-text" 
              font-size="36" 
              font-weight="700"
              text-anchor="start"
              filter="url(#shadow)">${pool.total_games}</text>
          ` : ''}
          
          <!-- Salary Cap -->
          ${salaryCap ? `
            <g transform="translate(200, 0)">
              <text 
                x="0" 
                y="0" 
                class="label-text" 
                font-size="22" 
                font-weight="600"
                text-anchor="start"
                fill="rgba(255,255,255,0.9)">Salary Cap</text>
              <text 
                x="0" 
                y="35" 
                class="value-text" 
                font-size="36" 
                font-weight="700"
                text-anchor="start"
                filter="url(#shadow)">${salaryCap}</text>
            </g>
          ` : ''}
        </g>
        
        <!-- Row 3: Roster -->
        <g transform="translate(20, 180)">
          <text 
            x="0" 
            y="0" 
            class="label-text" 
            font-size="22" 
            font-weight="600"
            text-anchor="start"
            fill="rgba(255,255,255,0.9)">Roster</text>
          <text 
            x="0" 
            y="35" 
            class="subtitle-text" 
            font-size="30" 
            font-weight="600"
            text-anchor="start"
            filter="url(#shadow)">${rosterText}</text>
        </g>
      </g>
      
      <!-- Lineup Requirements Section (to the right of specs table) -->
      ${pool.lineup_requirements ? (() => {
        const reqs = pool.lineup_requirements
        const requirements: string[] = []
        
        // Team-specific requirements
        if (reqs.min_players_from_teams && Array.isArray(reqs.min_players_from_teams) && reqs.min_players_from_teams.length > 0) {
          const firstReq = reqs.min_players_from_teams[0]
          requirements.push(`Min ${firstReq.min} ${firstReq.team} player${firstReq.min > 1 ? 's' : ''}`)
        }
        if (reqs.max_players_from_teams && Array.isArray(reqs.max_players_from_teams) && reqs.max_players_from_teams.length > 0) {
          const firstReq = reqs.max_players_from_teams[0]
          requirements.push(`Max ${firstReq.max} ${firstReq.team} player${firstReq.max > 1 ? 's' : ''}`)
        }
        
        // General team requirements
        if (reqs.max_players_same_team) requirements.push(`Max ${reqs.max_players_same_team} from same team`)
        if (reqs.min_different_teams) requirements.push(`Min ${reqs.min_different_teams} different teams`)
        
        // Player requirements
        if (reqs.required_player_ids && reqs.required_player_ids.length > 0) {
          requirements.push(`${reqs.required_player_ids.length} required player${reqs.required_player_ids.length > 1 ? 's' : ''}`)
        }
        
        // Rookie requirements
        if (reqs.max_rookies) requirements.push(`Max ${reqs.max_rookies} rookies`)
        
        // Game requirements
        if (reqs.min_players_per_game) requirements.push(`Min ${reqs.min_players_per_game} per game`)
        if (reqs.max_players_same_game) requirements.push(`Max ${reqs.max_players_same_game} from same game`)
        
        if (requirements.length === 0 && requiredPlayerIds.length === 0) return ''
        
        const reqsText = requirements.slice(0, 2).join(' • ') // Show max 2 text requirements
        const hasPlayerAvatars = requiredPlayerIds.length > 0
        
        // Position in row 1, column 4 of specs table (x=600, same y as table start=70+20=90)
        const reqsX = 600  // 4th column in row 1 (Entry Fee=0, Entries=200, Prize Pool=400, Requirements=600)
        const reqsY = 90   // Row 1 Y position (table start=70 + row offset=20)
        
        return `
          <g transform="translate(${reqsX}, ${reqsY})">
            <!-- Label -->
            <text 
              x="0" 
              y="0" 
              class="label-text" 
              font-size="22" 
              font-weight="600"
              text-anchor="start"
              fill="rgba(255,255,255,0.9)">Requirements</text>
            
            ${reqsText ? `
              <g transform="translate(0, 35)">
                <text 
                  x="0" 
                  y="0" 
                  class="subtitle-text" 
                  font-size="24" 
                  text-anchor="start"
                  fill="#FFC72C"
                  font-weight="600">⚡ ${reqsText}${requirements.length > 2 ? '...' : ''}</text>
              </g>
            ` : ''}
            
            ${hasPlayerAvatars ? `
              <g transform="translate(0, ${reqsText ? '70' : '35'})">
                <text 
                  x="0" 
                  y="0" 
                  class="label-text" 
                  font-size="18" 
                  text-anchor="start"
                  fill="rgba(255,255,255,0.8)">Required Players:</text>
                <g transform="translate(0, 30)">
                  ${requiredPlayerIds.slice(0, 3).map((playerId, index) => {
                    const avatarBase64 = playerAvatars[playerId]
                    const avatarSize = 113  // 1.25x of 90px
                    const spacing = 120  // Increased spacing for larger avatars
                    const x = index * spacing
                    
                    return `
                      <g transform="translate(${x}, 0)">
                        ${avatarBase64 ? `
                          <circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2}" fill="rgba(255,255,255,0.1)" stroke="#FFC72C" stroke-width="2"/>
                          <image 
                            href="${avatarBase64}" 
                            x="2" 
                            y="2" 
                            width="${avatarSize - 4}" 
                            height="${avatarSize - 4}" 
                            preserveAspectRatio="xMidYMid meet"
                            clip-path="url(#avatar-clip-${playerId})"/>
                        ` : `
                          <circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2}" fill="rgba(255, 199, 44, 0.2)" stroke="#FFC72C" stroke-width="2"/>
                          <text x="${avatarSize/2}" y="${avatarSize/2 + 5}" class="subtitle-text" font-size="20" text-anchor="middle" fill="#FFC72C">${playerId}</text>
                        `}
                      </g>
                    `
                  }).join('')}
                </g>
              </g>
            ` : ''}
          </g>
        `
      })() : ''}
    </g>
    
    <!-- HoopGeek branding (bottom right) -->
    <text 
      x="${width - 40}" 
      y="${height - 30}" 
      class="subtitle-text" 
      font-size="28" 
      text-anchor="end"
      opacity="0.7">HoopGeek</text>
  </svg>
  `
  
  return new TextEncoder().encode(svg)
}
