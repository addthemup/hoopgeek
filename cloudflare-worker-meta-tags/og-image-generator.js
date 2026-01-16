/**
 * Cloudflare Worker route: /og-image/:postId
 * Generates OG images on-demand when bots request them
 * Returns SVG with proper caching headers
 */

// Team colors (matching Supabase Edge Function)
const TEAM_COLORS = {
  'ATL': { primary: '#E03A3E', secondary: '#C1D32F' },
  'BOS': { primary: '#007A33', secondary: '#BA9653' },
  'BKN': { primary: '#000000', secondary: '#FFFFFF' },
  'CHA': { primary: '#1D1160', secondary: '#00788C' },
  'CHI': { primary: '#CE1141', secondary: '#000000' },
  'CLE': { primary: '#860038', secondary: '#041E42' },
  'DAL': { primary: '#00538C', secondary: '#002B5E' },
  'DEN': { primary: '#0E2240', secondary: '#FEC524' },
  'DET': { primary: '#C8102E', secondary: '#1D42BA' },
  'GSW': { primary: '#1D428A', secondary: '#FFC72C' },
  'HOU': { primary: '#CE1141', secondary: '#000000' },
  'IND': { primary: '#002D62', secondary: '#FDBB30' },
  'LAC': { primary: '#C8102E', secondary: '#1D428A' },
  'LAL': { primary: '#552583', secondary: '#FDB927' },
  'MEM': { primary: '#5D76A9', secondary: '#12173F' },
  'MIA': { primary: '#98002E', secondary: '#F9A01B' },
  'MIL': { primary: '#00471B', secondary: '#EEE1C6' },
  'MIN': { primary: '#0C2340', secondary: '#236192' },
  'NOP': { primary: '#0C2340', secondary: '#C8102E' },
  'NYK': { primary: '#006BB6', secondary: '#F58426' },
  'OKC': { primary: '#007AC1', secondary: '#EF3B24' },
  'ORL': { primary: '#0077C0', secondary: '#C4CED4' },
  'PHI': { primary: '#006BB6', secondary: '#ED174C' },
  'PHX': { primary: '#1D1160', secondary: '#E56020' },
  'POR': { primary: '#E03A3E', secondary: '#000000' },
  'SAC': { primary: '#5A2D81', secondary: '#63727A' },
  'SAS': { primary: '#C4CED4', secondary: '#000000' },
  'TOR': { primary: '#CE1141', secondary: '#000000' },
  'UTA': { primary: '#002B5C', secondary: '#F9A01B' },
  'WAS': { primary: '#002B5C', secondary: '#E31837' },
}

const TEAM_IDS = {
  'ATL': '1610612737', 'BOS': '1610612738', 'BKN': '1610612751', 'CHA': '1610612766',
  'CHI': '1610612741', 'CLE': '1610612739', 'DAL': '1610612742', 'DEN': '1610612743',
  'DET': '1610612765', 'GSW': '1610612744', 'HOU': '1610612745', 'IND': '1610612754',
  'LAC': '1610612746', 'LAL': '1610612747', 'MEM': '1610612763', 'MIA': '1610612748',
  'MIL': '1610612749', 'MIN': '1610612750', 'NOP': '1610612740', 'NYK': '1610612752',
  'OKC': '1610612760', 'ORL': '1610612753', 'PHI': '1610612755', 'PHX': '1610612756',
  'POR': '1610612757', 'SAC': '1610612758', 'SAS': '1610612759', 'TOR': '1610612761',
  'UTA': '1610612762', 'WAS': '1610612764',
}

function getTeamLogoUrl(tricode) {
  const teamId = TEAM_IDS[tricode] || TEAM_IDS['ATL']
  return `https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`
}

function getPlayerAvatarUrl(playerId) {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
}

function getTeamPrimaryColor(tricode) {
  return TEAM_COLORS[tricode]?.primary || '#1a1a1a'
}

function formatGameDate(dateString) {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}/${day}`
  } catch {
    return ''
  }
}

// Fetch image and convert to base64 (for embedding in SVG)
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Generator/1.0)'
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    // For SVG files
    if (contentType.includes('svg') || contentType.includes('xml')) {
      const text = new TextDecoder().decode(buffer)
      const utf8Bytes = new TextEncoder().encode(text)
      let binary = ''
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i])
      }
      const base64 = btoa(binary)
      return `data:${contentType};base64,${base64}`
    }
    
    // For binary images
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize)
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j])
      }
    }
    const base64 = btoa(binary)
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    return null
  }
}

// Generate SVG OG image
async function generateOGImageSVG(post) {
  const width = 1200
  const height = 630
  
  // Parse metadata
  const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {})
  const storyData = typeof metadata.story_data === 'string' 
    ? JSON.parse(metadata.story_data) 
    : (metadata.story_data || {})
  
  const teamTricodes = post.team_tricodes || []
  const playerIds = post.player_ids || []
  const isGamePost = teamTricodes.length >= 2
  const isPlayerPost = playerIds.length > 0
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <style>
        .team-text { font-family: Arial, sans-serif; font-weight: bold; fill: white; }
        .score-text { font-family: Arial, sans-serif; font-weight: bold; fill: black; }
        .date-text { font-family: Arial, sans-serif; font-weight: bold; fill: white; }
      </style>
    </defs>
  `
  
  if (isGamePost) {
    const [awayTeam, homeTeam] = teamTricodes
    const awayColor = getTeamPrimaryColor(awayTeam)
    const homeColor = getTeamPrimaryColor(homeTeam)
    
    // Fetch logos as base64
    const awayLogoUrl = getTeamLogoUrl(awayTeam)
    const homeLogoUrl = getTeamLogoUrl(homeTeam)
    const awayLogoBase64 = await fetchImageAsBase64(awayLogoUrl)
    const homeLogoBase64 = await fetchImageAsBase64(homeLogoUrl)
    
    const awayScore = storyData.awayScore ?? metadata.awayPoints
    const homeScore = storyData.homeScore ?? metadata.homePoints
    const dateStr = formatGameDate(post.game_date)
    
    const circleRadius = 250
    const circleCenterX = width / 2
    const circleCenterY = height / 2
    
    svg += `
      <!-- Background (light gray for card effect) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5f5"/>
      
      <!-- Card shadow -->
      <rect x="40" y="40" width="${width-80}" height="${height-80}" rx="20" fill="#fff" opacity="0.95"/>
      
      <!-- Split circle background (matches avatar bar) -->
      <defs>
        <clipPath id="circle-clip">
          <circle cx="${circleCenterX}" cy="${circleCenterY}" r="${circleRadius}"/>
        </clipPath>
      </defs>
      
      <!-- Left half (away team) -->
      <rect x="${circleCenterX-circleRadius}" y="${circleCenterY-circleRadius}" width="${circleRadius}" height="${circleRadius*2}" fill="${awayColor}" clip-path="url(#circle-clip)"/>
      
      <!-- Right half (home team) -->
      <rect x="${circleCenterX}" y="${circleCenterY-circleRadius}" width="${circleRadius}" height="${circleRadius*2}" fill="${homeColor}" clip-path="url(#circle-clip)"/>
      
      <!-- Vertical divider line -->
      <line x1="${circleCenterX}" y1="${circleCenterY-circleRadius*0.8}" x2="${circleCenterX}" y2="${circleCenterY+circleRadius*0.8}" stroke="rgba(0,0,0,0.2)" stroke-width="2"/>
      
      <!-- Team logos (embedded as base64) -->
      ${awayLogoBase64 ? `
      <image href="${awayLogoBase64}" x="${circleCenterX-circleRadius*0.6}" y="${circleCenterY-circleRadius*0.4}" width="${circleRadius*0.8}" height="${circleRadius*0.8}" opacity="0.95" preserveAspectRatio="xMidYMid meet"/>
      ` : `
      <text x="${circleCenterX-circleRadius*0.3}" y="${circleCenterY+10}" class="team-text" font-size="64" text-anchor="middle">${awayTeam}</text>
      `}
      
      ${homeLogoBase64 ? `
      <image href="${homeLogoBase64}" x="${circleCenterX+circleRadius*0.2}" y="${circleCenterY-circleRadius*0.4}" width="${circleRadius*0.8}" height="${circleRadius*0.8}" opacity="0.95" preserveAspectRatio="xMidYMid meet"/>
      ` : `
      <text x="${circleCenterX+circleRadius*0.3}" y="${circleCenterY+10}" class="team-text" font-size="64" text-anchor="middle">${homeTeam}</text>
      `}
      
      <!-- Circle border -->
      <circle cx="${circleCenterX}" cy="${circleCenterY}" r="${circleRadius}" fill="none" stroke="#000" stroke-width="4"/>
      
      ${awayScore !== undefined && homeScore !== undefined ? `
      <!-- Score badge -->
      <rect x="${circleCenterX-90}" y="${height-140}" width="180" height="70" rx="8" fill="#FFC72C" stroke="#000" stroke-width="3"/>
      <text x="${circleCenterX}" y="${height-100}" class="score-text" font-size="56" text-anchor="middle" font-weight="bold">${awayScore}-${homeScore}</text>
      ` : ''}
      
      ${dateStr ? `
      <!-- Date badge -->
      <rect x="${circleCenterX-70}" y="60" width="140" height="45" rx="6" fill="rgba(0,0,0,0.7)" stroke="#fff" stroke-width="2"/>
      <text x="${circleCenterX}" y="88" class="date-text" font-size="28" text-anchor="middle">${dateStr}</text>
      ` : ''}
      
      ${post.title ? `
      <!-- Title -->
      <text x="${circleCenterX}" y="${height-50}" class="team-text" font-size="36" text-anchor="middle" font-weight="bold" fill="#333">${post.title}</text>
      ` : ''}
    `
  } else if (isPlayerPost) {
    const playerId = playerIds[0]
    const playerAvatarUrl = getPlayerAvatarUrl(playerId)
    const fantasyPoints = metadata.fantasyPoints ?? metadata.fantasy_points
    
    const playerAvatarBase64 = await fetchImageAsBase64(playerAvatarUrl)
    
    const circleRadius = 220
    const circleCenterX = width / 2
    const circleCenterY = height / 2 - 30
    
    svg += `
      <!-- Background (light gray for card effect) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5f5"/>
      
      <!-- Card shadow -->
      <rect x="40" y="40" width="${width-80}" height="${height-80}" rx="20" fill="#fff" opacity="0.95"/>
      
      <!-- Player avatar circle -->
      <defs>
        <clipPath id="player-circle">
          <circle cx="${circleCenterX}" cy="${circleCenterY}" r="${circleRadius}"/>
        </clipPath>
      </defs>
      
      ${playerAvatarBase64 ? `
      <image href="${playerAvatarBase64}" x="${circleCenterX-circleRadius}" y="${circleCenterY-circleRadius}" width="${circleRadius*2}" height="${circleRadius*2}" clip-path="url(#player-circle)"/>
      ` : `
      <circle cx="${circleCenterX}" cy="${circleCenterY}" r="${circleRadius}" fill="#1a1a1a"/>
      <text x="${circleCenterX}" y="${circleCenterY+20}" class="team-text" font-size="72" text-anchor="middle">Player</text>
      `}
      
      <!-- Circle border -->
      <circle cx="${circleCenterX}" cy="${circleCenterY}" r="${circleRadius}" fill="none" stroke="#000" stroke-width="4" stroke-dasharray="8,4"/>
      
      ${fantasyPoints && fantasyPoints > 0 ? `
      <!-- Fantasy points badge -->
      <rect x="${circleCenterX-100}" y="${height-140}" width="200" height="70" rx="8" fill="#FFC72C" stroke="#000" stroke-width="3"/>
      <text x="${circleCenterX}" y="${height-100}" class="score-text" font-size="56" text-anchor="middle" font-weight="bold">${fantasyPoints.toFixed(1)} FP</text>
      ` : ''}
      
      ${post.title ? `
      <!-- Title -->
      <text x="${circleCenterX}" y="${height-50}" class="team-text" font-size="36" text-anchor="middle" font-weight="bold" fill="#333">${post.title}</text>
      ` : ''}
    `
  } else {
    svg += `
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2d2d2d;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <text x="${width/2}" y="${height/2}" class="team-text" font-size="64" text-anchor="middle">${post.title || 'NBA Highlights'}</text>
    `
  }
  
  svg += `
    <!-- Branding -->
    <text x="${width-200}" y="${height-30}" class="team-text" font-size="24" opacity="0.6">HoopGeek</text>
  </svg>
  `
  
  return svg
}

// Fetch post from Supabase
async function fetchPost(postId, env) {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/feed_posts?id=eq.${postId}&status=eq.published&select=*`,
      {
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data && data.length > 0 ? data[0] : null
  } catch (error) {
    console.error('Error fetching post:', error)
    return null
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    
    // Match /og-image/:postId pattern
    const match = url.pathname.match(/^\/og-image\/([^\/]+)$/)
    if (!match) {
      return new Response('Not found', { status: 404 })
    }
    
    const postId = match[1]
    
    // Fetch post data
    const post = await fetchPost(postId, env)
    if (!post) {
      return new Response('Post not found', { status: 404 })
    }
    
    // Generate SVG image
    const svg = await generateOGImageSVG(post)
    
    // Return with caching headers
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
}

