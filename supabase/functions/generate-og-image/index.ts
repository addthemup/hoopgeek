import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Import shared utilities
import {
  getTeamLogoUrl,
  getPlayerAvatarUrl,
  fetchImageAsBase64,
  getTeamPrimaryColor,
  getTeamSecondaryColor,
  formatGameDate,
  escapeHtml,
  calculateFantasyPoints,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from './og-image-utils.ts'

// Import DFS pool generator
import { generateDFSPoolOGImage, type DFSPoolData, type DFSPoolGame } from './dfs-pool-generator.ts'

// Import player page generator
import { generatePlayerPageOGImage, type PlayerPageData } from './player-page-generator.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fetch player boxscore from nba_boxscores table
async function fetchPlayerBoxscore(
  supabaseClient: any,
  nbaPlayerId: number,
  gameId: string
): Promise<any | null> {
  try {
    console.log(`🔍 Fetching boxscore for player ${nbaPlayerId}, game ${gameId}`)
    
    const { data, error } = await supabaseClient
      .from('nba_boxscores')
      .select('pts, reb, ast, stl, blk, tov, team_tricode')
      .eq('nba_player_id', nbaPlayerId)
      .eq('game_id', gameId)
      .single()
    
    if (error) {
      console.error(`❌ Error fetching boxscore:`, error)
      return null
    }
    
    if (data) {
      console.log(`✅ Boxscore found: PTS=${data.pts}, REB=${data.reb}, AST=${data.ast}, STL=${data.stl}, BLK=${data.blk}, TOV=${data.tov}`)
      return data
    }
    
    return null
  } catch (error) {
    console.error(`❌ Exception fetching boxscore:`, error)
    return null
  }
}

function generateOGImageHTML(
  teamTricodes: string[] | null,
  playerIds: number[] | null,
  metadata: any,
  gameDate: string | null,
  title: string | null
): string {
  const width = 1200
  const height = 630
  
  // Parse metadata
  const metadataObj = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {})
  const storyData = typeof metadataObj.story_data === 'string' 
    ? JSON.parse(metadataObj.story_data) 
    : (metadataObj.story_data || {})
  
  const isGamePost = teamTricodes && teamTricodes.length >= 2
  const isPlayerPost = playerIds && playerIds.length > 0
  
  let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            width: ${width}px;
            height: ${height}px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            position: relative;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
  `
  
  if (isGamePost) {
    // Game post: Split background with team colors
    const [awayTeam, homeTeam] = teamTricodes
    const awayColor = getTeamPrimaryColor(awayTeam)
    const homeColor = getTeamPrimaryColor(homeTeam)
    const awayLogo = getTeamLogoUrl(awayTeam)
    const homeLogo = getTeamLogoUrl(homeTeam)
    
    const awayScore = storyData.awayScore ?? metadataObj.awayPoints
    const homeScore = storyData.homeScore ?? metadataObj.homePoints
    const dateStr = formatGameDate(gameDate)
    
    html += `
      <!-- Split background -->
      <div style="position: absolute; left: 0; top: 0; width: 50%; height: 100%; background: ${awayColor};"></div>
      <div style="position: absolute; right: 0; top: 0; width: 50%; height: 100%; background: ${homeColor};"></div>
      
      <!-- Vertical divider -->
      <div style="position: absolute; left: 50%; top: 10%; bottom: 30%; width: 2px; background: rgba(255,255,255,0.3); transform: translateX(-50%);"></div>
      
      <!-- Team logos -->
      <div style="position: absolute; left: 25%; top: 50%; transform: translate(-50%, -50%); width: 200px; height: 200px; display: flex; align-items: center; justify-content: center;">
        <img src="${awayLogo}" style="max-width: 100%; max-height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" />
      </div>
      
      <div style="position: absolute; left: 75%; top: 50%; transform: translate(-50%, -50%); width: 200px; height: 200px; display: flex; align-items: center; justify-content: center;">
        <img src="${homeLogo}" style="max-width: 100%; max-height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" />
      </div>
      
      ${awayScore !== undefined && homeScore !== undefined ? `
      <!-- Score badge -->
      <div style="position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%); background: #FFC72C; color: #000; padding: 12px 30px; border-radius: 8px; font-size: 72px; font-weight: bold; border: 4px solid #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
        ${awayScore}-${homeScore}
      </div>
      ` : ''}
      
      ${dateStr ? `
      <!-- Date badge -->
      <div style="position: absolute; top: 40px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.75); color: #fff; padding: 8px 20px; border-radius: 6px; font-size: 32px; font-weight: bold; border: 2px solid #fff;">
        ${dateStr}
      </div>
      ` : ''}
    `
  } else if (isPlayerPost) {
    // Player post: Player avatar with fantasy points
    const playerId = playerIds[0]
    const playerAvatar = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
    const fantasyPoints = metadataObj.fantasyPoints ?? metadataObj.fantasy_points
    
    html += `
      <!-- Background -->
      <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);"></div>
      
      <!-- Player avatar -->
      <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 400px; height: 400px; border-radius: 50%; overflow: hidden; border: 6px solid #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
        <img src="${playerAvatar}" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      
      ${fantasyPoints && fantasyPoints > 0 ? `
      <!-- Fantasy points badge -->
      <div style="position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%); background: #FFC72C; color: #000; padding: 12px 30px; border-radius: 8px; font-size: 72px; font-weight: bold; border: 4px solid #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
        ${fantasyPoints.toFixed(1)} FP
      </div>
      ` : ''}
    `
  } else {
    // Fallback: Title on gradient background
    html += `
      <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); display: flex; align-items: center; justify-content: center;">
        <div style="color: #fff; font-size: 64px; font-weight: bold; text-align: center; padding: 40px;">
          ${title || 'NBA Highlights'}
        </div>
      </div>
    `
  }
  
  // HoopGeek branding
  html += `
      <!-- Branding -->
      <div style="position: absolute; bottom: 20px; right: 40px; color: rgba(255,255,255,0.6); font-size: 24px; font-weight: 600;">
        HoopGeek
      </div>
      </body>
    </html>
  `
  
  return html
}

// SVG to PNG conversion using external service (if needed)
// Most platforms accept SVG for og:image, but if PNG is required,
// we can use a service like Cloudinary or convert via API
async function convertSVGtoPNG(svgData: Uint8Array): Promise<Uint8Array | null> {
  // For now, return null (use SVG directly)
  // TODO: Implement PNG conversion if needed (e.g., via Cloudinary transform or API)
  return null
}

async function generateOGImageSVG(
  teamTricodes: string[] | null,
  playerIds: number[] | null,
  metadata: any,
  gameDate: string | null,
  title: string | null,
  gameId: string | null,
  supabaseClient: any,
  slides: any[] = [],
  postType: string | null = null
): Promise<Uint8Array> {
  const width = OG_IMAGE_WIDTH
  const height = OG_IMAGE_HEIGHT
  
  const metadataObj = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {})
  const storyData = typeof metadataObj.story_data === 'string' 
    ? JSON.parse(metadataObj.story_data) 
    : (metadataObj.story_data || {})
  const funData = typeof metadataObj.fun_data === 'string' 
    ? JSON.parse(metadataObj.fun_data) 
    : (metadataObj.fun_data || {})
  
  const funScoreRaw = metadataObj.fun_score ?? funData.fun_score ?? 0
  const isFunScorePost = postType === 'fun_score' && teamTricodes && teamTricodes.length >= 2 && funScoreRaw > 0
  const isGamePost = teamTricodes && teamTricodes.length >= 2 && !isFunScorePost
  const isPlayerPost = playerIds && playerIds.length > 0
  
  // Extract top players for fun score posts BEFORE generating SVG (so we can add gradients to defs)
  // Only show top player avatars if post_type is 'fun_score'
  let topPlayers: any[] = []
  if (postType === 'fun_score') {
    console.log(`🔍 Fun Score Post detected, extracting top players from slides...`)
    console.log(`📊 Slides count: ${slides.length}`)
    try {
      for (const slide of slides) {
        if (slide.type === 'top_fantasy_scorers' && slide.players && Array.isArray(slide.players)) {
          console.log(`✅ Found top_fantasy_scorers slide with ${slide.players.length} players`)
          // Get top 5 players (already sorted by fantasyPoints)
          topPlayers = slide.players.slice(0, 5)
          console.log(`📋 Extracted ${topPlayers.length} top players:`, topPlayers.map(p => ({ name: p.name, personId: p.personId, teamTricode: p.teamTricode })))
          
          // Fetch player avatars using personId directly from player object
          for (const player of topPlayers) {
            // Use personId directly from player object if available
            let personId = player.personId || null
            console.log(`🔍 Processing player: ${player.name}, personId: ${personId}`)
            
            // Fallback: Find personId from slides by matching player name if not directly available
            if (!personId) {
              const playerLastName = player.name?.split(' ').pop() || ''
              
              for (const slideItem of slides) {
                if (slideItem.type === 'video' && slideItem.metadata) {
                  // Match by full name (playerNameI) or last name (playerName)
                  if (slideItem.metadata.playerNameI === player.name || 
                      slideItem.metadata.playerName === playerLastName) {
                    personId = slideItem.metadata.personId
                    console.log(`✅ Found personId ${personId} for ${player.name} from video slide`)
                    if (personId) break
                  }
                }
              }
            }
            
            // Set personId on player object
            if (personId) {
              player.personId = personId
              // Fetch avatar using personId
              console.log(`📥 Fetching avatar for personId ${personId}`)
              player.avatarBase64 = await fetchImageAsBase64(getPlayerAvatarUrl(personId))
              console.log(`📥 Avatar fetch result: ${player.avatarBase64 ? '✅' : '❌'}`)
              // Get team colors for gradient (use teamTricode from player object or find from slides)
              if (!player.teamTricode) {
                // Try to find teamTricode from slides
                for (const slideItem of slides) {
                  if (slideItem.type === 'video' && slideItem.metadata && slideItem.metadata.personId === personId) {
                    player.teamTricode = slideItem.metadata.teamTricode
                    break
                  }
                }
              }
              player.teamPrimary = getTeamPrimaryColor(player.teamTricode)
              player.teamSecondary = getTeamSecondaryColor(player.teamTricode)
              console.log(`✅ Processed player ${player.name}: team=${player.teamTricode}, avatar=${player.avatarBase64 ? 'loaded' : 'missing'}`)
            } else {
              console.warn(`⚠️ Could not find personId for player: ${player.name}`)
            }
          }
          console.log(`✅ Extracted ${topPlayers.length} top players for fun score post`)
          break
        }
      }
      // Fallback: If no top_fantasy_scorers slide found, query database for top 5 players
      if (topPlayers.length === 0 && gameId && supabaseClient) {
        console.log(`⚠️ No top_fantasy_scorers slide found, querying database for top 5 fantasy scorers...`)
        try {
          const { data: boxscores, error: boxscoreError } = await supabaseClient
            .from('nba_boxscores')
            .select('nba_player_id, player_name, team_tricode, pts, reb, ast, stl, blk, tov')
            .eq('game_id', gameId)
            .gt('min', 0) // Only players who actually played
          
          if (boxscores && !boxscoreError && boxscores.length > 0) {
            console.log(`✅ Found ${boxscores.length} players in boxscores for game ${gameId}`)
            
            // Calculate fantasy points for each player and sort
            const playersWithFP = boxscores.map((boxscore: any) => {
              const fantasyPoints = calculateFantasyPoints({
                points: boxscore.pts || 0,
                rebounds: boxscore.reb || 0,
                assists: boxscore.ast || 0,
                steals: boxscore.stl || 0,
                blocks: boxscore.blk || 0,
                turnovers: boxscore.tov || 0
              })
              
              return {
                personId: boxscore.nba_player_id,
                name: boxscore.player_name,
                teamTricode: boxscore.team_tricode,
                fantasyPoints,
                pts: boxscore.pts || 0,
                reb: boxscore.reb || 0,
                ast: boxscore.ast || 0,
                stl: boxscore.stl || 0,
                blk: boxscore.blk || 0,
                tov: boxscore.tov || 0
              }
            })
            
            // Sort by fantasy points descending and take top 5
            topPlayers = playersWithFP
              .sort((a: any, b: any) => b.fantasyPoints - a.fantasyPoints)
              .slice(0, 5)
            
            console.log(`✅ Calculated top ${topPlayers.length} players from database`)
            
            // Fetch avatars for top players
            for (const player of topPlayers) {
              if (player.personId) {
                console.log(`📥 Fetching avatar for personId ${player.personId} (${player.name})`)
                player.avatarBase64 = await fetchImageAsBase64(getPlayerAvatarUrl(player.personId))
                console.log(`📥 Avatar fetch result: ${player.avatarBase64 ? '✅' : '❌'}`)
                player.teamPrimary = getTeamPrimaryColor(player.teamTricode)
                player.teamSecondary = getTeamSecondaryColor(player.teamTricode)
                console.log(`✅ Processed player ${player.name}: team=${player.teamTricode}, avatar=${player.avatarBase64 ? 'loaded' : 'missing'}`)
              }
            }
          } else {
            console.warn(`⚠️ Could not fetch boxscores from database:`, boxscoreError)
          }
        } catch (dbError) {
          console.error('❌ Error querying database for top players:', dbError)
        }
      }
    } catch (e) {
      console.error('❌ Error extracting top players for fun score:', e)
    }
  }
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <style>
        .team-text { font-family: Arial, sans-serif; font-weight: bold; fill: white; }
        .score-text { font-family: Arial, sans-serif; font-weight: bold; fill: black; }
        .date-text { font-family: Arial, sans-serif; font-weight: bold; fill: white; }
      </style>
      <filter id="shadow">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
      ${postType === 'fun_score' && topPlayers.length > 0 ? topPlayers.map((player: any, index: number) => {
        const playerGradientId = `topPlayerGrad-${index}`
        return `<linearGradient id="${playerGradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${player.teamPrimary || '#1D428A'};stop-opacity:0.6" />
          <stop offset="50%" style="stop-color:${player.teamSecondary || '#FFC72C'};stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:${player.teamPrimary || '#1D428A'};stop-opacity:0.4" />
        </linearGradient>`
      }).join('') : ''}
    </defs>
  `
  
  if (isFunScorePost || isGamePost) {
    const [awayTeam, homeTeam] = teamTricodes
    const awayColor = getTeamPrimaryColor(awayTeam)
    const homeColor = getTeamPrimaryColor(homeTeam)
    
    // Fetch logos as base64 for embedding (using EXACT same URLs as frontend)
    const awayLogoUrl = getTeamLogoUrl(awayTeam) // Uses primary/L/logo.svg like frontend
    const homeLogoUrl = getTeamLogoUrl(homeTeam)
    console.log(`📥 Fetching logos: away=${awayLogoUrl}, home=${homeLogoUrl}`)
    const awayLogoBase64 = await fetchImageAsBase64(awayLogoUrl)
    const homeLogoBase64 = await fetchImageAsBase64(homeLogoUrl)
    console.log(`📥 Logo fetch results: away=${awayLogoBase64 ? '✅' : '❌'}, home=${homeLogoBase64 ? '✅' : '❌'}`)
    
    const awayScore = storyData.awayScore ?? metadataObj.awayPoints
    const homeScore = storyData.homeScore ?? metadataObj.homePoints
    const dateStr = formatGameDate(gameDate)
    
    // Extract and format fun score (divide by 10, show 1 decimal) for fun score posts
    const funScoreFormatted = isFunScorePost && funScoreRaw > 0 ? (funScoreRaw / 10).toFixed(1) : null
    
    // Large split-circle avatar (like avatar bar) - positioned center-left
    const avatarSize = isFunScorePost ? 380 : 250  // Larger for fun score posts
    const avatarCenterX = isFunScorePost ? 300 : width / 2
    const avatarCenterY = height / 2
    const logoSize = isFunScorePost ? 200 : (avatarSize * 0.8)  // Logo size for each half
    const rightSideStartX = isFunScorePost ? (avatarCenterX + avatarSize/2 + 80) : 0
    
    svg += `
      <!-- Black background (matching player highlights for fun score posts) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="${isFunScorePost ? '#000000' : '#f5f5f5'}"/>
      ${!isFunScorePost ? `
      <!-- Card shadow -->
      <rect x="40" y="40" width="${width-80}" height="${height-80}" rx="20" fill="#fff" opacity="0.95"/>
      ` : ''}
      
      <!-- Split-circle avatar (matches avatar bar design) -->
      <g>
        <!-- Circle clip path -->
        <clipPath id="avatarCircle">
          <circle cx="${avatarCenterX}" cy="${avatarCenterY}" r="${avatarSize/2}"/>
        </clipPath>
        
        <!-- Split background: left half (away team) -->
        <rect 
          x="${avatarCenterX - avatarSize/2}" 
          y="${avatarCenterY - avatarSize/2}" 
          width="${avatarSize/2}" 
          height="${avatarSize}" 
          fill="${awayColor}" 
          clip-path="url(#avatarCircle)"/>
        
        <!-- Split background: right half (home team) -->
        <rect 
          x="${avatarCenterX}" 
          y="${avatarCenterY - avatarSize/2}" 
          width="${avatarSize/2}" 
          height="${avatarSize}" 
          fill="${homeColor}" 
          clip-path="url(#avatarCircle)"/>
        
        <!-- Vertical divider line -->
        <line 
          x1="${avatarCenterX}" 
          y1="${avatarCenterY - avatarSize/2 + avatarSize*0.1}" 
          x2="${avatarCenterX}" 
          y2="${avatarCenterY + avatarSize/2 - avatarSize*0.3}" 
          stroke="rgba(255,255,255,0.3)" 
          stroke-width="2"/>
        
        <!-- Away team logo (left half) - centered in left half -->
        ${awayLogoBase64 ? `
          <g transform="translate(${avatarCenterX - avatarSize/4 - logoSize/2}, ${avatarCenterY - logoSize/2})">
            <image 
              href="${awayLogoBase64}" 
              x="0" 
              y="0" 
              width="${logoSize}" 
              height="${logoSize}" 
              preserveAspectRatio="xMidYMid meet"
              filter="url(#shadow)"/>
          </g>
        ` : `
          <text x="${avatarCenterX - avatarSize/4}" y="${avatarCenterY + 10}" class="team-text" font-size="64" font-weight="700" text-anchor="middle" fill="white">${awayTeam}</text>
        `}
        
        <!-- Home team logo (right half) - centered in right half -->
        ${homeLogoBase64 ? `
          <g transform="translate(${avatarCenterX + avatarSize/4 - logoSize/2}, ${avatarCenterY - logoSize/2})">
            <image 
              href="${homeLogoBase64}" 
              x="0" 
              y="0" 
              width="${logoSize}" 
              height="${logoSize}" 
              preserveAspectRatio="xMidYMid meet"
              filter="url(#shadow)"/>
          </g>
        ` : `
          <text x="${avatarCenterX + avatarSize/4}" y="${avatarCenterY + 10}" class="team-text" font-size="64" font-weight="700" text-anchor="middle" fill="white">${homeTeam}</text>
        `}
        
        <!-- Circle border (white dashed for fun score posts) -->
        <circle 
          cx="${avatarCenterX}" 
          cy="${avatarCenterY}" 
          r="${avatarSize/2}" 
          fill="none" 
          stroke="${isFunScorePost ? '#ffffff' : '#000'}" 
          stroke-width="${isFunScorePost ? '6' : '4'}"
          ${isFunScorePost ? 'stroke-dasharray="16,8" opacity="0.8"' : ''}/>
      </g>
      
      <!-- Fun Score badge - overlaid on avatar bottom (for fun score posts) -->
      ${isFunScorePost && funScoreFormatted ? `
        <g transform="translate(${avatarCenterX}, ${avatarCenterY + avatarSize/2 * 0.75})">
          <rect 
            x="-100" 
            y="-26" 
            width="200" 
            height="52" 
            rx="10" 
            fill="#FFC72C" 
            stroke="#000" 
            stroke-width="3"
            filter="url(#shadow)"
            opacity="0.98"/>
          <text 
            x="0" 
            y="8" 
            class="score-text" 
            font-size="44" 
            font-weight="700"
            text-anchor="middle" 
            fill="#000">${funScoreFormatted}</text>
        </g>
      ` : ''}
      
      <!-- Game score badge (if available and no fun score) - overlaid on avatar bottom -->
      ${!isFunScorePost && awayScore !== undefined && homeScore !== undefined ? `
        <g transform="translate(${avatarCenterX}, ${avatarCenterY + avatarSize/2 * 0.75})">
          <rect 
            x="-100" 
            y="-26" 
            width="200" 
            height="52" 
            rx="10" 
            fill="#FFC72C" 
            stroke="#000" 
            stroke-width="3"
            filter="url(#shadow)"
            opacity="0.98"/>
          <text 
            x="0" 
            y="8" 
            class="score-text" 
            font-size="44" 
            font-weight="700"
            text-anchor="middle" 
            fill="#000">${awayScore}-${homeScore}</text>
        </g>
      ` : ''}
      
      <!-- Title and description (right side for fun score posts) - white text matching player highlights -->
      ${isFunScorePost ? `
        <g transform="translate(${rightSideStartX}, ${height/2 - 140})">
          ${title ? `
            <text 
              x="0" 
              y="0" 
              class="team-text" 
              font-size="56" 
              font-weight="700"
              text-anchor="start"
              fill="#ffffff"
              filter="url(#shadow)">${escapeHtml((title || '').replace(/Fun Score:\s*\d+\.?\d*\s*/gi, '').replace(/^\s*[•·]\s*/, '').replace(/^\s*\.\d+\s*[•·]?\s*/gi, '').replace(/\s*•\s*/g, ' • ').trim())}</text>
          ` : ''}
        </g>
        
        <!-- Top 5 Fantasy Scorers (Fun Score posts only) - horizontal row of avatars -->
        ${postType === 'fun_score' && topPlayers.length > 0 ? `
          <g transform="translate(${rightSideStartX}, ${height/2 + 40})">
            ${topPlayers.map((player: any, index: number) => {
              const playerAvatarSize = 90
              const playerAvatarX = index * 110
              const playerGradientId = `topPlayerGrad-${index}`
              
              return `
                <g transform="translate(${playerAvatarX}, 0)">
                  <!-- Gradient circle behind avatar -->
                  ${player.personId ? `
                    <circle 
                      cx="${playerAvatarSize/2}" 
                      cy="${playerAvatarSize/2}" 
                      r="${playerAvatarSize/2 + 8}" 
                      fill="url(#${playerGradientId})"
                      opacity="0.8"/>
                  ` : ''}
                  
                  <!-- Circle clip path -->
                  <clipPath id="topPlayerAvatar-${index}">
                    <circle cx="${playerAvatarSize/2}" cy="${playerAvatarSize/2}" r="${playerAvatarSize/2}"/>
                  </clipPath>
                  
                  <!-- Player avatar image -->
                  ${player.avatarBase64 ? `
                    <image 
                      href="${player.avatarBase64}" 
                      x="0" 
                      y="0" 
                      width="${playerAvatarSize}" 
                      height="${playerAvatarSize}" 
                      clip-path="url(#topPlayerAvatar-${index})"
                      filter="url(#shadow)"/>
                  ` : `
                    <circle 
                      cx="${playerAvatarSize/2}" 
                      cy="${playerAvatarSize/2}" 
                      r="${playerAvatarSize/2}" 
                      fill="#1a1a1a"/>
                  `}
                  
                  <!-- Dashed border -->
                  <circle 
                    cx="${playerAvatarSize/2}" 
                    cy="${playerAvatarSize/2}" 
                    r="${playerAvatarSize/2 + 2}" 
                    fill="none" 
                    stroke="#ffffff" 
                    stroke-width="3" 
                    stroke-dasharray="8,4"
                    opacity="0.8"/>
                  
                  <!-- Fantasy Points badge below avatar -->
                  <g transform="translate(${playerAvatarSize/2}, ${playerAvatarSize + 15})">
                    <rect 
                      x="-35" 
                      y="-12" 
                      width="70" 
                      height="24" 
                      rx="4" 
                      fill="#FFC72C" 
                      stroke="#000" 
                      stroke-width="2"
                      filter="url(#shadow)"
                      opacity="0.98"/>
                    <text 
                      x="0" 
                      y="4" 
                      class="score-text" 
                      font-size="18" 
                      font-weight="700"
                      text-anchor="middle" 
                      fill="#000">${player.fantasyPoints?.toFixed(1) || '0'}</text>
                  </g>
                </g>
              `
            }).join('')}
          </g>
        ` : ''}
        
        <!-- Date badge (bottom right, matching player highlights style) - BIG -->
        ${dateStr ? `
          <g transform="translate(${width - 320}, ${height - 180})">
            <rect 
              x="0" 
              y="0" 
              width="280" 
              height="80" 
              rx="12" 
              fill="rgba(255,255,255,0.15)" 
              stroke="#ffffff" 
              stroke-width="3"
              filter="url(#shadow)"
              opacity="0.9"/>
            <text 
              x="140" 
              y="52" 
              class="date-text" 
              font-size="52" 
              font-weight="700"
              text-anchor="middle"
              fill="#ffffff">${dateStr}</text>
          </g>
        ` : ''}
        
        <!-- HoopGeek branding (bottom right) - white text -->
        <text 
          x="${width - 40}" 
          y="${height - 30}" 
          class="team-text" 
          font-size="28" 
          text-anchor="end"
          fill="#ffffff"
          opacity="0.7">HoopGeek</text>
      ` : `
        ${awayScore !== undefined && homeScore !== undefined ? `
        <!-- Score badge (matches avatar bar style) -->
        <rect x="${avatarCenterX-90}" y="${height-140}" width="180" height="70" rx="8" fill="#FFC72C" stroke="#000" stroke-width="3"/>
        <text x="${avatarCenterX}" y="${height-100}" class="score-text" font-size="56" text-anchor="middle" font-weight="bold">${awayScore}-${homeScore}</text>
        ` : ''}
        
        ${dateStr ? `
        <!-- Date badge -->
        <rect x="${avatarCenterX-70}" y="60" width="140" height="45" rx="6" fill="rgba(0,0,0,0.7)" stroke="#fff" stroke-width="2"/>
        <text x="${avatarCenterX}" y="88" class="date-text" font-size="28" text-anchor="middle">${dateStr}</text>
        ` : ''}
        
        ${title ? `
        <!-- Title -->
        <text x="${avatarCenterX}" y="${height-50}" class="team-text" font-size="36" text-anchor="middle" font-weight="bold" fill="#333">${title}</text>
        ` : ''}
      `}
    `
  } else if (isPlayerPost) {
    const playerId = playerIds[0]
    // Use EXACT same URL as frontend
    const playerAvatarUrl = getPlayerAvatarUrl(playerId)
    
    // PRIORITY 1: Get stats from top_fantasy_scorers slide in metadata (PRIMARY SOURCE)
    let fantasyPoints = 0
    let playerStats = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 }
    let foundStats = false
    
    // Try to find stats in top_fantasy_scorers slide
    for (const slide of slides) {
      if (slide.type === 'top_fantasy_scorers' && slide.players && Array.isArray(slide.players)) {
        const nbaPlayerId = parseInt(playerId.toString())
        
        // Find player by personId
        let playerData = slide.players.find((p: any) => {
          if (p.personId === nbaPlayerId) return true
          if (slide.highlightedPlayerId === nbaPlayerId) return true
          return false
        })
        
        // If highlightedPlayerId matches but no direct match, use first player
        if (!playerData && slide.highlightedPlayerId === nbaPlayerId && slide.players.length > 0) {
          playerData = slide.players[0]
        }
        
        // Try to find by player name from title
        if (!playerData && title) {
          const playerName = title.match(/^([A-Z]\.\s+[A-Za-z]+)/)?.[1]
          if (playerName) {
            playerData = slide.players.find((p: any) => {
              if (p.name === playerName || p.name?.includes(playerName.split(' ')[1])) return true
              return false
            })
          }
        }
        
        if (playerData) {
          console.log(`✅ Found stats in top_fantasy_scorers slide (PRIMARY SOURCE):`, {
            pts: playerData.pts,
            reb: playerData.reb,
            ast: playerData.ast,
            stl: playerData.stl,
            blk: playerData.blk,
            tov: playerData.tov
          })
          playerStats = {
            points: playerData.pts || 0,
            rebounds: playerData.reb || 0,
            assists: playerData.ast || 0,
            steals: playerData.stl || 0,
            blocks: playerData.blk || 0,
            turnovers: playerData.tov || 0
          }
          fantasyPoints = calculateFantasyPoints(playerStats)
          foundStats = true
          console.log(`✅ Using metadata stats: ${fantasyPoints.toFixed(1)} FP, ${playerStats.points} PTS, ${playerStats.rebounds} REB, ${playerStats.assists} AST`)
          break
        }
      }
    }
    
    // PRIORITY 2: Fall back to nba_boxscores database if metadata doesn't have stats
    if (!foundStats && gameId && supabaseClient) {
      const boxscore = await fetchPlayerBoxscore(supabaseClient, playerId, gameId)
      if (boxscore) {
        fantasyPoints = calculateFantasyPoints(boxscore)
        playerStats = {
          points: boxscore.pts || 0,
          rebounds: boxscore.reb || 0,
          assists: boxscore.ast || 0,
          steals: boxscore.stl || 0,
          blocks: boxscore.blk || 0,
          turnovers: boxscore.tov || 0
        }
        console.log(`✅ Using boxscore data (FALLBACK): ${fantasyPoints.toFixed(1)} FP, ${playerStats.points} PTS, ${playerStats.rebounds} REB, ${playerStats.assists} AST`)
        foundStats = true
      } else {
        console.log(`⚠️ Boxscore not found`)
      }
    }
    
    // If player not found in top_fantasy_scorers, don't show stats or FP at all
    if (!foundStats) {
      fantasyPoints = 0
      console.log(`⚠️ Player not found in top_fantasy_scorers, not showing stats or FP`)
    }
    
    // Fetch player avatar as base64
    console.log(`📥 Fetching player avatar: ${playerAvatarUrl}`)
    const playerAvatarBase64 = await fetchImageAsBase64(playerAvatarUrl)
    console.log(`📥 Player avatar fetch result: ${playerAvatarBase64 ? '✅' : '❌'}`)
    
    const circleRadius = 220
    const circleCenterX = width / 2
    const circleCenterY = height / 2 - 30
    
    svg += `
      <!-- Background (light gray for card effect) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5f5"/>
      
      <!-- Card shadow -->
      <rect x="40" y="40" width="${width-80}" height="${height-80}" rx="20" fill="#fff" opacity="0.95"/>
      
      <!-- Player avatar circle (matches avatar bar) -->
      <defs>
        <clipPath id="player-circle">
          <circle cx="${circleCenterX}" cy="${circleCenterY}" r="${circleRadius}"/>
        </clipPath>
        <linearGradient id="player-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2d2d2d;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      ${playerAvatarBase64 ? `
      <image href="${playerAvatarBase64}" x="${circleCenterX-circleRadius}" y="${circleCenterY-circleRadius}" width="${circleRadius*2}" height="${circleRadius*2}" clip-path="url(#player-circle)"/>
      ` : `
      <circle cx="${circleCenterX}" cy="${circleCenterY}" r="${circleRadius}" fill="#1a1a1a"/>
      <text x="${circleCenterX}" y="${circleCenterY+20}" class="team-text" font-size="72" text-anchor="middle">Player</text>
      `}
      
      <!-- Circle border (dashed style like avatar bar) -->
      <circle cx="${circleCenterX}" cy="${circleCenterY}" r="${circleRadius}" fill="none" stroke="#000" stroke-width="4" stroke-dasharray="8,4"/>
      
      ${foundStats && fantasyPoints && fantasyPoints > 0 ? `
      <!-- Fantasy points badge (only show if found in top_fantasy_scorers) -->
      <rect x="${circleCenterX-100}" y="${height-140}" width="200" height="70" rx="8" fill="#FFC72C" stroke="#000" stroke-width="3"/>
      <text x="${circleCenterX}" y="${height-100}" class="score-text" font-size="56" text-anchor="middle" font-weight="bold">${fantasyPoints.toFixed(1)} FP</text>
      ` : ''}
      
      ${title ? `
      <!-- Title -->
      <text x="${circleCenterX}" y="${height-50}" class="team-text" font-size="36" text-anchor="middle" font-weight="bold" fill="#333">${title}</text>
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
      <text x="${width/2}" y="${height/2}" class="team-text" font-size="64" text-anchor="middle">${title || 'NBA Highlights'}</text>
    `
  }
  
  svg += `
    <!-- Branding -->
    <text x="${width-200}" y="${height-30}" class="team-text" font-size="24" opacity="0.6">HoopGeek</text>
  </svg>
  `
  
  return new TextEncoder().encode(svg)
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    console.log('📝 Request received:', {
      method: req.method,
      hasAuth: !!authHeader,
      url: req.url
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const requestBody = await req.json()
    const { 
      post_id, 
      pool_id,  // For DFS pools
      player_id,  // For player pages
      team_tricodes, 
      player_ids, 
      metadata, 
      game_date, 
      title 
    } = requestBody

    console.log('📦 Request body:', {
      post_id,
      pool_id,
      player_id,
      has_team_tricodes: !!team_tricodes,
      has_player_ids: !!player_ids,
      has_metadata: !!metadata
    })

    // Handle player page OG image generation
    if (player_id) {
      console.log('🎨 Generating OG image for player page:', player_id)
      
      // Fetch player data
      const { data: playerData, error: playerError } = await supabaseClient
        .from('nba_players')
        .select('nba_player_id, name, position, team_abbreviation, jersey_number')
        .eq('id', player_id)
        .single()
      
      if (playerError || !playerData) {
        console.error('❌ Error fetching player:', playerError)
        return new Response(
          JSON.stringify({ error: 'Player not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Fetch 2025-26 season stats (regular season games only: 2025-10-21 to 2026-04-12, min > 0)
      // Use player_id (UUID) to match the nba_players.id field
      // Also fetch game_date for chart progression
      const { data: seasonStatsData, error: statsError } = await supabaseClient
        .from('nba_boxscores')
        .select('pts, reb, ast, stl, blk, tov, min, game_date')
        .eq('player_id', player_id) // player_id is UUID from nba_players table
        .eq('season_year', '2025-26')
        .gte('game_date', '2025-10-21')
        .lte('game_date', '2026-04-12')
        .gt('min', 0) // Only games where player played
        .order('game_date', { ascending: true }) // Order by date for progression chart
      
      let ppg = 0
      let rpg = 0
      let apg = 0
      let avgFantasyPoints = 0
      let gamesPlayed = 0
      const fantasyPointsProgression: Array<{ game: number; fp: number }> = []
      
      if (!statsError && seasonStatsData && seasonStatsData.length > 0) {
        gamesPlayed = seasonStatsData.length
        
        // Calculate totals and build progression data
        const totals = seasonStatsData.reduce(
          (acc: any, game: any, index: number) => {
            acc.pts += game.pts || 0
            acc.reb += game.reb || 0
            acc.ast += game.ast || 0
            
            // Calculate fantasy points for this game
            const gameStats = {
              pts: Number(game.pts) || 0,
              reb: Number(game.reb) || 0,
              ast: Number(game.ast) || 0,
              stl: Number(game.stl) || 0,
              blk: Number(game.blk) || 0,
              tov: Number(game.tov) || 0,
            }
            const fp = calculateFantasyPoints(gameStats)
            acc.fantasyPoints += fp
            
            // Add to progression array for chart
            fantasyPointsProgression.push({
              game: index + 1,
              fp: fp
            })
            
            return acc
          },
          { pts: 0, reb: 0, ast: 0, fantasyPoints: 0 }
        )
        
        // Calculate averages
        ppg = totals.pts / gamesPlayed
        rpg = totals.reb / gamesPlayed
        apg = totals.ast / gamesPlayed
        avgFantasyPoints = totals.fantasyPoints / gamesPlayed
      }
      
      // Prepare player data for image generation
      // team_abbreviation is the same as team_tricode (3-letter code like "LAL", "BOS")
      const playerDataForImage: PlayerPageData = {
        nba_player_id: playerData.nba_player_id,
        name: playerData.name,
        position: playerData.position || undefined,
        team_abbreviation: playerData.team_abbreviation || undefined,
        team_tricode: playerData.team_abbreviation || undefined, // Use team_abbreviation as team_tricode
        jersey_number: playerData.jersey_number || undefined,
        ppg: gamesPlayed > 0 ? ppg : undefined,
        rpg: gamesPlayed > 0 ? rpg : undefined,
        apg: gamesPlayed > 0 ? apg : undefined,
        avg_fantasy_points: gamesPlayed > 0 ? avgFantasyPoints : undefined,
        games_played: gamesPlayed,
        fantasy_points_progression: fantasyPointsProgression.length > 0 ? fantasyPointsProgression : undefined,
      }
      
      const svgData = await generatePlayerPageOGImage(playerDataForImage)
      
      // Upload to Supabase Storage
      const fileName = `${player_id}.svg`
      const filePath = `player-pages/${fileName}`
      
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('og-images')
        .upload(filePath, svgData, {
          contentType: 'image/svg+xml',
          upsert: true,
          cacheControl: '3600'
        })

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('og-images')
        .getPublicUrl(filePath)

      console.log('✅ Player page OG image generated:', publicUrl)

      return new Response(
        JSON.stringify({ 
          success: true, 
          og_image_url: publicUrl,
          player_id 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle DFS pool OG image generation
    if (pool_id) {
      console.log('🎨 Generating OG image for DFS pool:', pool_id)
      
      // Fetch pool data
      const { data: poolData, error: poolError } = await supabaseClient
        .from('dfs_pools')
        .select('*')
        .eq('id', pool_id)
        .single()
      
      if (poolError || !poolData) {
        console.error('❌ Error fetching pool:', poolError)
        return new Response(
          JSON.stringify({ error: 'Pool not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Fetch pool games with game_id for getting start_time
      const { data: poolGames, error: gamesError } = await supabaseClient
        .from('dfs_pool_games')
        .select('home_team, away_team, game_date, game_id')
        .eq('pool_id', pool_id)
        .order('game_date', { ascending: true })
      
      // Fetch first game's start_time from nba_games if available
      let firstGameStartTime: string | null = null
      if (poolGames && poolGames.length > 0 && poolGames[0].game_id) {
        const { data: firstGame, error: gameError } = await supabaseClient
          .from('nba_games')
          .select('game_date_est, start_time_est')
          .eq('game_id', poolGames[0].game_id)
          .single()
        
        if (!gameError && firstGame) {
          // Prefer start_time_est, fallback to game_date_est
          firstGameStartTime = firstGame.start_time_est || firstGame.game_date_est
        }
      }
      
      if (gamesError) {
        console.warn('⚠️ Error fetching pool games:', gamesError)
      }
      
      // Generate DFS pool OG image
      const poolDataForImage: DFSPoolData = {
        id: poolData.id,
        name: poolData.name,
        entry_fee: parseFloat(poolData.entry_fee) || 0,
        prize_pool: poolData.prize_pool ? parseFloat(poolData.prize_pool) : null,
        current_entries: poolData.current_entries || 0,
        max_entries: poolData.max_entries || null,
        lock_time: poolData.lock_time,
        difficulty_tier: poolData.difficulty_tier || 'standard',
        slate_date: poolData.slate_date,
        total_games: poolGames?.length || 0,
        icon_name: poolData.icon_name || null,
        html_color_primary: poolData.html_color_primary || null,
        html_color_secondary: poolData.html_color_secondary || null,
        starters_count: poolData.starters_count || 5,
        rotation_count: poolData.rotation_count || 3,
        bench_count: poolData.bench_count || 0,
        salary_cap: poolData.salary_cap ? parseInt(poolData.salary_cap) : null,
        lineup_requirements: poolData.lineup_requirements ? poolData.lineup_requirements : (poolData.min_players_per_team || poolData.max_players_per_team || 
                            poolData.min_different_teams || poolData.max_players_same_team ||
                            poolData.required_player_ids || poolData.excluded_player_ids ||
                            poolData.max_rookies || poolData.min_players_per_game ||
                            poolData.max_players_same_game ? {
          min_players_per_team: poolData.min_players_per_team,
          max_players_per_team: poolData.max_players_per_team,
          min_players_from_teams: poolData.min_players_from_teams,
          max_players_from_teams: poolData.max_players_from_teams,
          min_different_teams: poolData.min_different_teams,
          max_players_same_team: poolData.max_players_same_team,
          required_player_ids: poolData.required_player_ids,
          required_player_groups: poolData.required_player_groups,
          excluded_player_ids: poolData.excluded_player_ids,
          max_rookies: poolData.max_rookies,
          min_players_per_position: poolData.min_players_per_position,
          max_players_per_position: poolData.max_players_per_position,
          min_salary_per_position: poolData.min_salary_per_position,
          max_salary_per_position: poolData.max_salary_per_position,
          min_lineup_age: poolData.min_lineup_age,
          max_lineup_age: poolData.max_lineup_age,
          min_players_under_age: poolData.min_players_under_age,
          max_players_over_age: poolData.max_players_over_age,
          age_threshold: poolData.age_threshold,
          min_players_per_game: poolData.min_players_per_game,
          max_players_same_game: poolData.max_players_same_game,
          required_game_ids: poolData.required_game_ids,
          min_players_home_teams: poolData.min_players_home_teams,
          max_players_home_teams: poolData.max_players_home_teams,
          min_players_away_teams: poolData.min_players_away_teams,
          max_players_away_teams: poolData.max_players_away_teams,
          min_players_from_winning_teams: poolData.min_players_from_winning_teams,
          max_players_from_winning_teams: poolData.max_players_from_winning_teams,
          min_players_from_losing_teams: poolData.min_players_from_losing_teams,
          max_players_from_losing_teams: poolData.max_players_from_losing_teams,
          min_players_top_teams: poolData.min_players_top_teams,
          max_players_top_teams: poolData.max_players_top_teams,
          top_teams_count: poolData.top_teams_count,
          min_players_bottom_teams: poolData.min_players_bottom_teams,
          max_players_bottom_teams: poolData.max_players_bottom_teams,
          bottom_teams_count: poolData.bottom_teams_count,
          min_players_east_conference: poolData.min_players_east_conference,
          max_players_east_conference: poolData.max_players_east_conference,
          min_players_west_conference: poolData.min_players_west_conference,
          max_players_west_conference: poolData.max_players_west_conference,
          max_players_same_division: poolData.max_players_same_division,
          min_players_stat_threshold: poolData.min_players_stat_threshold,
          max_players_stat_threshold: poolData.max_players_stat_threshold,
          max_players_playoff_teams: poolData.max_players_playoff_teams,
          min_players_non_playoff_teams: poolData.min_players_non_playoff_teams,
          min_players_high_total_games: poolData.min_players_high_total_games,
          max_players_high_total_games: poolData.max_players_high_total_games,
          high_total_threshold: poolData.high_total_threshold,
          min_players_close_games: poolData.min_players_close_games,
          max_players_close_games: poolData.max_players_close_games,
          close_game_spread_threshold: poolData.close_game_spread_threshold,
        } : undefined)
      }
      
      const gamesForImage: DFSPoolGame[] = (poolGames || []).map((game: any, index: number) => ({
        home_team: game.home_team,
        away_team: game.away_team,
        game_date: game.game_date,
        game_id: game.game_id,
        start_time: index === 0 ? firstGameStartTime : undefined  // Only include start_time for first game
      }))
      
      const svgData = await generateDFSPoolOGImage(poolDataForImage, gamesForImage)
      
      // Upload to Supabase Storage
      const fileName = `${pool_id}.svg`
      const filePath = `dfs-pools/${fileName}`
      
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('og-images')
        .upload(filePath, svgData, {
          contentType: 'image/svg+xml',
          upsert: true,
          cacheControl: '3600'
        })

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('og-images')
        .getPublicUrl(filePath)

      console.log('✅ DFS pool OG image generated:', publicUrl)

      // Update pool with OG image URL (only if pool_id is a valid UUID and exists)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(pool_id)) {
        const { error: updateError } = await supabaseClient
          .from('dfs_pools')
          .update({ og_image_url: publicUrl })
          .eq('id', pool_id)

        if (updateError) {
          console.error('❌ Update error:', updateError)
          // Don't fail - image was uploaded successfully, just log the error
        } else {
          console.log('✅ Pool updated with OG image URL')
        }
      } else {
        console.warn(`⚠️ Skipping pool update - invalid UUID format: ${pool_id}`)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          og_image_url: publicUrl,
          pool_id 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle feed post OG image generation (existing logic)
    if (!post_id) {
      console.error('❌ Missing post_id or pool_id')
      return new Response(
        JSON.stringify({ error: 'post_id or pool_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🎨 Generating OG image for post:', post_id)

    // Fetch full post to get game_id, slides, and post_type (needed for boxscore queries and metadata stats)
    let gameId: string | null = null
    let slides: any[] = []
    let postType: string | null = null
    try {
      const { data: postData, error: postError } = await supabaseClient
        .from('feed_posts')
        .select('game_id, slides, post_type')
        .eq('id', post_id)
        .single()
      
      if (!postError && postData) {
        gameId = postData.game_id
        postType = postData.post_type
        // Parse slides if they're a string
        slides = typeof postData.slides === 'string' 
          ? JSON.parse(postData.slides) 
          : (postData.slides || [])
        console.log(`✅ Fetched game_id from post: ${gameId}`)
        console.log(`✅ Fetched post_type: ${postType}`)
        console.log(`✅ Fetched ${slides.length} slides from post`)
      } else {
        console.warn(`⚠️ Could not fetch post data:`, postError)
      }
    } catch (error) {
      console.warn(`⚠️ Error fetching post:`, error)
    }

    // Generate SVG image with embedded logos (mirrors avatar bar design)
    const svgData = await generateOGImageSVG(team_tricodes, player_ids, metadata, game_date, title, gameId, supabaseClient, slides, postType)
    
    // Try to convert to PNG if possible, otherwise use SVG
    // SVG works for most platforms, but PNG is more widely supported
    const pngData = await convertSVGtoPNG(svgData)
    const usePNG = pngData !== null
    
    // Upload to Supabase Storage
    const fileExt = usePNG ? 'png' : 'svg'
    const contentType = usePNG ? 'image/png' : 'image/svg+xml'
    const fileName = `${post_id}.${fileExt}`
    const filePath = `feed-posts/${fileName}`
    
    const imageData = usePNG ? pngData : svgData
    
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('og-images')
      .upload(filePath, imageData, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error('❌ Upload error:', uploadError)
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('og-images')
      .getPublicUrl(filePath)

    console.log('✅ OG image generated:', publicUrl)

    // Update post with OG image URL (only if post_id is a valid UUID and exists)
    // Validate UUID format first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(post_id)) {
      const { error: updateError } = await supabaseClient
        .from('feed_posts')
        .update({ share_image_url: publicUrl })
        .eq('id', post_id)

      if (updateError) {
        console.error('❌ Update error:', updateError)
        // Don't fail - image was uploaded successfully, just log the error
      } else {
        console.log('✅ Post updated with OG image URL')
      }
    } else {
      console.warn(`⚠️ Skipping post update - invalid UUID format: ${post_id}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        og_image_url: publicUrl,
        post_id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

