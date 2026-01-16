// Shared OG Image Generation Utilities
// This module contains reusable functions for generating OG images across different content types

// Team colors (from nbaTeamColors.ts)
export const TEAM_COLORS: Record<string, { primary: string; secondary?: string }> = {
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

// Team IDs for logos
export const TEAM_IDS: Record<string, string> = {
  'ATL': '1610612737', 'BOS': '1610612738', 'BKN': '1610612751', 'CHA': '1610612766',
  'CHI': '1610612741', 'CLE': '1610612739', 'DAL': '1610612742', 'DEN': '1610612743',
  'DET': '1610612765', 'GSW': '1610612744', 'HOU': '1610612745', 'IND': '1610612754',
  'LAC': '1610612746', 'LAL': '1610612747', 'MEM': '1610612763', 'MIA': '1610612748',
  'MIL': '1610612749', 'MIN': '1610612750', 'NOP': '1610612740', 'NYK': '1610612752',
  'OKC': '1610612760', 'ORL': '1610612753', 'PHI': '1610612755', 'PHX': '1610612756',
  'POR': '1610612757', 'SAC': '1610612758', 'SAS': '1610612759', 'TOR': '1610612761',
  'UTA': '1610612762', 'WAS': '1610612764',
}

// Use EXACT same URLs as frontend (from src/utils/nbaTeamLogos.ts)
export function getTeamLogoUrl(tricode: string): string {
  const teamId = TEAM_IDS[tricode] || TEAM_IDS['ATL']
  // Frontend uses: primary/L/logo.svg
  return `https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`
}

// Player avatar URL (matches frontend exactly)
export function getPlayerAvatarUrl(playerId: number): string {
  // Frontend uses: cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
}

// Fetch image and convert to base64 data URI
export async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    console.log(`🖼️ Fetching image: ${url}`)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Generator/1.0)'
      }
    })
    
    if (!response.ok) {
      console.warn(`❌ Failed to fetch image: ${url} - Status: ${response.status}`)
      return null
    }
    
    const contentType = response.headers.get('content-type') || 'image/png'
    console.log(`✅ Image fetched, content-type: ${contentType}, size: ${response.headers.get('content-length') || 'unknown'} bytes`)
    
    const arrayBuffer = await response.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    // For SVG files (text/xml), handle differently
    if (contentType.includes('svg') || contentType.includes('xml')) {
      // SVG is text-based, so decode as UTF-8
      const text = new TextDecoder().decode(buffer)
      // Encode the SVG text to base64 (Deno-compatible)
      // Convert UTF-8 string to base64
      const utf8Bytes = new TextEncoder().encode(text)
      let binary = ''
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i])
      }
      const base64 = btoa(binary)
      console.log(`✅ SVG converted to base64, length: ${base64.length} chars`)
      return `data:${contentType};base64,${base64}`
    }
    
    // For binary images (PNG, JPG, etc.)
    let binary = ''
    const chunkSize = 8192 // Process in chunks to avoid stack overflow
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize)
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j])
      }
    }
    const base64 = btoa(binary)
    console.log(`✅ Image converted to base64, length: ${base64.length} chars`)
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.error(`❌ Error fetching image ${url}:`, error)
    return null
  }
}

export function getTeamPrimaryColor(tricode: string): string {
  return TEAM_COLORS[tricode]?.primary || '#1a1a1a'
}

export function getTeamSecondaryColor(tricode: string): string {
  return TEAM_COLORS[tricode]?.secondary || '#FFFFFF'
}

// Escape HTML/XML entities for safe text rendering in SVG
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Format game date
export function formatGameDate(dateString: string | null | undefined): string {
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

// Calculate fantasy points from stats (works with boxscore or playerStats object)
export function calculateFantasyPoints(stats: any): number {
  if (!stats) return 0
  
  const pts = stats.pts || stats.points || 0
  const reb = stats.reb || stats.rebounds || 0
  const ast = stats.ast || stats.assists || 0
  const stl = stats.stl || stats.steals || 0
  const blk = stats.blk || stats.blocks || 0
  const tov = stats.tov || stats.turnovers || 0
  
  // Standard fantasy scoring: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
  return pts + (reb * 1.2) + (ast * 1.5) + (stl * 3) + (blk * 3) - tov
}

// Standard OG image dimensions
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

// React Icons SVG path data mapping
// These are the SVG path data extracted from react-icons library
export const REACT_ICON_PATHS: Record<string, string> = {
  // Font Awesome icons
  'FaBasketballBall': 'M287.9 0c-21.5 0-42.2 3.1-60.8 9.1l-48 112c-3.1 7.2-3.1 15.5 0 22.7l48 112c18.6 6 39.2 9.1 60.8 9.1s42.2-3.1 60.8-9.1l48-112c3.1-7.2 3.1-15.5 0-22.7l-48-112C330.1 3.1 309.5 0 287.9 0zm0 96c-14.4 0-28.1 2.1-41.1 6.1l-32 74.7c5.1 1.3 10.3 2.1 15.6 2.6V96c0-17.7 14.3-32 32-32s32 14.3 32 32v82.4c5.3-.5 10.5-1.3 15.6-2.6l-32-74.7C316 98.1 302.3 96 287.9 96zm64 32c9.9 0 18 8.1 18 18s-8.1 18-18 18-18-8.1-18-18 8.1-18 18-18zm-192 0c9.9 0 18 8.1 18 18s-8.1 18-18 18-18-8.1-18-18 8.1-18 18-18z',
  'FaTrophy': 'M552 64H448V24c0-13.3-10.7-24-24-24H200c-13.3 0-24 10.7-24 24v40H72c-4.4 0-8 3.6-8 8v56c0 35.8 23.5 66.1 56 76.3V496c0 8.8 7.2 16 16 16h320c8.8 0 16-7.2 16-16V204.3c32.5-10.1 56-40.5 56-76.3V72c0-4.4-3.6-8-8-8zM96 128v-48h48v128c-17.7 0-32-14.3-32-32v-16h-16zm352 0v16c0 17.7-14.3 32-32 32V80h48v48h-16zm-32 48H128v320h288V176z',
  'FaFire': 'M216 23.86c0-23.8-30.65-32.77-44.15-13.04C48 191.85 224 200 224 288c0 35.63-29.11 64.46-64.85 63.99-35.17-.45-63.15-29.77-63.15-64.94v-85.51c0-21.7-26.47-32.23-41.43-16.5C27.8 213.16 0 261.33 0 320c0 105.78 86.92 192 194.4 192 107.45 0 194.4-86.22 194.4-192 0-170.29-172.8-298.14-172.8-298.14z',
  'FaStar': 'M259.3 17.8L194 150.2 47.9 171.5c-26.2 3.8-36.7 36.1-17.7 54.6l105.7 103-25 145.5c-4.5 26.3 23.2 46 46.4 33.7L288 439.6l130.7 68.7c23.2 12.2 50.9-7.4 46.4-33.7l-25-145.5 105.7-103c19-18.5 8.5-50.8-17.7-54.6L382 150.2 316.7 17.8c-11.7-23.6-45.6-23.9-57.4 0z',
  'FaCrown': 'M528 448H112c-8.8 0-16 7.2-16 16v48c0 8.8 7.2 16 16 16h416c8.8 0 16-7.2 16-16v-48c0-8.8-7.2-16-16-16zm64-320c-26.5 0-48 21.5-48 48 0 7.1 1.6 13.7 4.3 19.8L489.1 192l-149.1-38.3c-11.4-2.9-23.2-2.9-34.6 0L155.9 192 50.7 147.8c2.7-6.1 4.3-12.7 4.3-19.8 0-26.5-21.5-48-48-48S0 101.5 0 128c0 8.2 2.1 15.9 5.8 22.6L48 256h416l42.2-105.4c3.7-6.7 5.8-14.4 5.8-22.6 0-26.5-21.5-48-48-48z',
  'FaGem': 'M464 0H144c-26.5 0-48 21.5-48 48v435.6l192-111.5 192 111.5V48c0-26.5-21.5-48-48-48zm-16 218.9l-176 102.4-176-102.4V48c0-8.8 7.2-16 16-16h320c8.8 0 16 7.2 16 16v170.9z',
  'FaRocket': 'M505.12019,28.09375c-1.18945-25.03125-18.49219-45.875-43.15625-50.84375C460.716,10.70312,454.83594,12.5,450.5,16.5l-57.84375,57.84375C345.5,78.5,290.79688,78.5,238.71875,78.5H181.5L139.15625,36.15625C135.71875,32.71875,130.21875,30.5,124.5,30.5H64.5c-8.5,0-16.5,3.5-22.5,9.5C36.5,46,32.5,54,32.5,62.5v60c0,5.71875,2.21875,11.21875,5.65625,14.65625L80.5,179.5v57.21875c0,52.07813,0,106.78125,0,158.84375L22.65625,413.34375C19.21875,416.78125,17,422.28125,17,428v60c0,8.5,3.5,16.5,9.5,22.5s14,9.5,22.5,9.5h60c5.71875,0,11.21875-2.21875,14.65625-5.65625L181.5,479.5h57.21875c52.07813,0,106.78125,0,158.84375,0l57.84375,57.84375c3.33594,3.33594,7.216,5.13281,11.46375,5.13281,25.66406,0,45.875-18.49219,50.84375-43.15625,1.18945-25.03125-18.49219-45.875-43.15625-50.84375C460.716,501.29688,454.83594,503.09375,450.5,499.09375l-57.84375-57.84375C345.5,433.5,290.79688,433.5,238.71875,433.5H181.5l-42.34375,42.34375C135.71875,479.28125,130.21875,481.5,124.5,481.5H64.5c-8.5,0-16.5-3.5-22.5-9.5s-9.5-14-9.5-22.5v-60c0-5.71875,2.21875-11.21875,5.65625-14.65625L80.5,332.5v-57.21875c0-52.07813,0-106.78125,0-158.84375L22.65625,98.65625C19.21875,95.21875,17,89.71875,17,84v-60c0-8.5,3.5-16.5,9.5-22.5s14-9.5,22.5-9.5h60c5.71875,0,11.21875,2.21875,14.65625,5.65625L181.5,112.5h57.21875c52.07813,0,106.78125,0,158.84375,0l57.84375-57.84375c3.33594-3.33594,7.216-5.13281,11.46375-5.13281,25.66406,0,45.875,18.49219,50.84375,43.15625C506.30964,9.21875,506.30964,3.09375,505.12019,28.09375z',
  'FaBolt': 'M124.5 0c-5.5 0-10.5 3-13 8L3 256c-1.5 4-1.5 8.5 0 12.5 1.5 4 4.5 7 8.5 8.5L124.5 320c5.5 0 10.5-3 13-8L245 64c1.5-4 1.5-8.5 0-12.5-1.5-4-4.5-7-8.5-8.5L124.5 0zm381.5 0c-5.5 0-10.5 3-13 8L384.5 256c-1.5 4-1.5 8.5 0 12.5 1.5 4 4.5 7 8.5 8.5L505 320c5.5 0 10.5-3 13-8L625.5 64c1.5-4 1.5-8.5 0-12.5-1.5-4-4.5-7-8.5-8.5L506 0z',
  'FaDice': 'M191.5 0C85.9 0 0 85.9 0 191.5S85.9 383 191.5 383 383 297.1 383 191.5 297.1 0 191.5 0zm0 320c-70.7 0-128-57.3-128-128s57.3-128 128-128 128 57.3 128 128-57.3 128-128 128zm128-192c0-17.7-14.3-32-32-32s-32 14.3-32 32 14.3 32 32 32 32-14.3 32-32zm64 64c0-17.7-14.3-32-32-32s-32 14.3-32 32 14.3 32 32 32 32-14.3 32-32zm64 64c0-17.7-14.3-32-32-32s-32 14.3-32 32 14.3 32 32 32 32-14.3 32-32zm64-64c0-17.7-14.3-32-32-32s-32 14.3-32 32 14.3 32 32 32 32-14.3 32-32zm64-64c0-17.7-14.3-32-32-32s-32 14.3-32 32 14.3 32 32 32 32-14.3 32-32z',
  'FaFlag': 'M349.565 36.465c-51.899-2.465-93.776 10.223-126.756 28.725-23.663 13.223-47.89 29.223-66.89 40.024v47.556c18-10.801 42.89-26.801 66.89-40.024 37.156-20.712 82.756-33.512 132.756-33.512v-42.769zm-132.756 90.269c-23.663 13.223-47.89 29.223-66.89 40.024v47.557c18-10.801 42.89-26.801 66.89-40.025 37.156-20.711 82.756-33.511 132.756-33.511v-42.769c-50 0-95.6 12.8-132.756 33.512zm0 90.269c-23.663 13.223-47.89 29.223-66.89 40.024v271.464c0 16.375 13.325 29.699 29.699 29.699 16.375 0 29.699-13.325 29.699-29.699V283.165c18-10.801 42.89-26.801 66.89-40.024 37.156-20.712 82.756-33.512 132.756-33.512v-42.769c-50 0-95.6 12.8-132.756 33.512z',
  'FaHeart': 'M462.3 62.6c-54.5-46.4-136-38.7-186.6 13.5L256 96.6l-19.7-20.3c-50.6-52.2-132.1-59.9-186.6-13.5-54.5 46.4-54.5 121.5 0 168l192 198.5 192-198.5c54.5-46.4 54.5-121.5 0-168z',
  'FaSun': 'M256 160c-52.9 0-96 43.1-96 96s43.1 96 96 96 96-43.1 96-96-43.1-96-96-96zm246.4 80.5l-94.7-47.3 33.5-100.4c4.5-13.6-8.4-26.5-22-22l-100.4 33.5-47.4-94.8c-6.4-12.8-24.6-12.8-31 0l-47.3 94.7L92.7 70.8c-13.6-4.5-26.5 8.4-22 22l33.5 100.4-94.7 47.4c-12.8 6.4-12.8 24.6 0 31l94.7 47.3-33.5 100.5c-4.5 13.6 8.4 26.5 22 22l100.4-33.5 47.3 94.7c6.4 12.8 24.6 12.8 31 0l47.3-94.7 100.4 33.5c13.6 4.5 26.5-8.4 22-22l-33.5-100.4 94.7-47.3c13-6.5 13-24.7.2-31.1zm-155.9 106c-49.9 49.9-131.1 49.9-181 0-49.9-49.9-49.9-131.1 0-181 49.9-49.9 131.1-49.9 181 0 49.9 49.9 49.9 131.1 0 181z',
  'FaMoon': 'M283.211 512c78.962 0 151.079-35.925 198.857-94.971 7.068-8.708-.639-21.43-11.562-19.35-124.203 23.654-238.262-71.576-238.262-196.954 0-72.222 38.662-138.635 101.498-174.394 9.686-5.12 7.25-20.197-3.756-22.23A258.156 258.156 0 0 0 283.211 0c-141.309 0-256 114.511-256 256 0 141.309 114.511 256 256 256z',
  'FaDollarSign': 'M211.9 62.1c-4.1-1.4-8.6-1.4-12.7 0l-128 43.2c-9.4 3.2-16.1 11.5-17.2 21.2-1.1 9.7 4.2 18.9 12.9 22.8l42.2 16.8-16.8 42.2c-3.9 8.7-13.1 14-22.8 12.9-9.7-1.1-18-7.8-21.2-17.2l-43.2-128c-2.6-7.8-1.1-16.3 3.8-22.5 4.9-6.2 12.4-9.8 20.2-9.8h128c8.8 0 16 7.2 16 16s-7.2 16-16 16H93.5l25.4 63.5c3.2 8 12.4 13.1 20.8 9.9l128-43.2c9.4-3.2 16.1-11.5 17.2-21.2 1.1-9.7-4.2-18.9-12.9-22.8l-42.2-16.8 16.8-42.2c3.9-8.7 13.1-14 22.8-12.9 9.7 1.1 18 7.8 21.2 17.2l43.2 128c2.6 7.8 1.1 16.3-3.8 22.5-4.9 6.2-12.4 9.8-20.2 9.8h-128c-8.8 0-16-7.2-16-16s7.2-16 16-16h106.5l-25.4-63.5c-3.2-8-12.4-13.1-20.8-9.9z',
  'FaMedal': 'M223.7 228.3L154.3 167l-69.4 61.3c-6.2 5.5-16.1 4.9-21.5-1.3l-11.1-12.6c-5.4-6.2-4.9-16.1 1.3-21.5l69.4-61.3-69.4-61.3c-6.2-5.5-6.7-15.3-1.3-21.5l11.1-12.6c5.4-6.2 15.3-6.7 21.5-1.3l69.4 61.3 69.4-61.3c6.2-5.5 16.1-4.9 21.5 1.3l11.1 12.6c5.4 6.2 4.9 16.1-1.3 21.5L223.7 167l69.4 61.3c6.2 5.5 6.7 15.3 1.3 21.5l-11.1 12.6c-5.4 6.2-15.3 6.7-21.5 1.3L223.7 228.3z',
  // Material Design icons (simplified paths)
  'MdSportsBasketball': 'M17.09 11c0-1.31-.84-2.41-2-2.86V8c0-1.1-.9-2-2-2s-2 .9-2 2v.14c-1.16.45-2 1.55-2 2.86 0 1.31.84 2.41 2 2.86v.14c0 1.1.9 2 2 2s2-.9 2-2v-.14c1.16-.45 2-1.55 2-2.86zm-2 0c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm-4-2.86V8c0-1.1-.9-2-2-2s-2 .9-2 2v.14c-1.16.45-2 1.55-2 2.86 0 1.31.84 2.41 2 2.86V16c0 1.1.9 2 2 2s2-.9 2-2v-.14c1.16-.45 2-1.55 2-2.86 0-1.31-.84-2.41-2-2.86zM6.09 8v.14c-1.16.45-2 1.55-2 2.86 0 1.31.84 2.41 2 2.86V16c0 1.1.9 2 2 2s2-.9 2-2v-.14c1.16-.45 2-1.55 2-2.86 0-1.31-.84-2.41-2-2.86V8c0-1.1-.9-2-2-2s-2 .9-2 2z',
  'MdEmojiEvents': 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.69-.33 3-1.5 3-2.9V7c0-1.1-.9-2-2-2zM5 7h14v1c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2H9c0 1.1-.9 2-2 2H5V7z',
  'MdLocalFireDepartment': 'M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23.1-.44-.37-.78-.75-.55C9.29 4.71 6.68 8.5 7.18 12.3c.2 1.64 1.64 2.9 3.18 3.79v4.66c0 .45-.18.88-.5 1.2l-2.5 2.5c.76.59 1.64 1.06 2.6 1.36 1.13.36 2.33.54 3.57.54 3.25 0 6.17-1.5 8.04-3.85.38-.5.38-1.19 0-1.69-.38-.5-1.03-.5-1.41 0zM14.5 14.2c-.28.28-.65.45-1.05.5-.4.05-.8-.05-1.15-.3-.35-.25-.6-.6-.75-1-.15-.4-.2-.85-.1-1.25.1-.4.3-.75.6-1 .3-.25.65-.4 1.05-.45.4-.05.8.05 1.15.3.35.25.6.6.75 1 .15.4.2.85.1 1.25-.1.4-.3.75-.6 1z',
  'MdStars': 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.54 4.92.42-3.73 3.23L16.23 18z',
  'MdWorkspacePremium': 'M10 16v-1H3.01L3 19c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2v-4h-7v1.5c0 .83-.67 1.5-1.5 1.5h-3c-.83 0-1.5-.67-1.5-1.5V16zm11-9H3v1h8v1.5c0 .83.67 1.5 1.5 1.5h3c.83 0 1.5-.67 1.5-1.5V9h2V7zm0-2v1H3V5h18z',
  'MdDiamond': 'M6 2L2 8l10 14L22 8l-4-6H6zm1.5 2h9l2.5 4h-14l2.5-4zM3 9l7 9.5L3 22V9zm18 0v13l-7-3.5L21 9zm-9 1.5L7.5 20h9L12 10.5z',
  'MdRocketLaunch': 'M2.81 14.12L5.64 11.3l8.49 8.49-2.83 2.83zm14.78-10.61l-2.83-2.83-8.49 8.49 2.83 2.83zm-5.66 5.66L4.93 4.93 2.1 7.76l6.36 6.36zm9.9-9.9L12.7.1 10.87 1.93l6.36 6.36zm-5.66 5.66L9.17 10.58l2.83 2.83 6.36-6.36zm5.66-5.66L14.93 4.93l2.83 2.83-6.36 6.36z',
  'MdFlashOn': 'M7 2v11h3v9l7-12h-4l4-8z',
  'MdCasino': 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18C6.67 18 6 17.33 6 16.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.17 6 16 6s1.5.67 1.5 1.5S16.83 9 16 9z',
  'MdFlag': 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',
  'MdFavorite': 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  'MdWbSunny': 'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z',
  'MdDarkMode': 'M12.34 2.02C6.59 1.82 2 6.42 2 12c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-13.19-7.99-8.32-14.96z',
  'MdAttachMoney': 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.38-1.9 1.38-2.05 0-2.36-.49-2.5-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  'MdMilitaryTech': 'M17 10.43V2H7v8.43c0 .35.18.68.49.86l4.18 2.51-.99 2.47-3.41-1.78-.14.07 1.12 2.79L12 16l3.76-1.93 1.12-2.79-.14-.07-3.41 1.78-.99-2.47 4.18-2.51c.31-.18.49-.51.49-.86zm-4 1.8l-1 .6-1-.6V3h2v9.23z'
}

// Get SVG path for a react-icon by name
export function getIconSvgPath(iconName: string | null | undefined): string | null {
  if (!iconName) return null
  return REACT_ICON_PATHS[iconName] || null
}

