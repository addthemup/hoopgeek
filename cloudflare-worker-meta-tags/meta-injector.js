/**
 * Cloudflare Worker to inject dynamic Open Graph meta tags for social media sharing
 * Detects social media bots and serves custom HTML with pool-specific meta tags
 */

// Social media bot user agents to detect
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'SkypeUriPreview',
  'facebookcatalog',
  'Pinterest',
  'Instagram',
  'Snapchat',
  'MessengerBot',
  'AppleBot', // iMessage link preview
  'AppleWebKit', // iOS Safari/iMessage (sometimes)
  'Mobile/1', // iOS mobile browsers
  'iPhone', // iPhone browser
  'iPad' // iPad browser
];

// Check if request is from a social media bot or iOS device
function isSocialMediaBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  
  // Check for known bot user agents
  if (BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()))) {
    return true;
  }
  
  // Additional check: if it's iOS Safari/Mobile requesting a UUID, likely link preview
  // This catches cases where iMessage doesn't use AppleBot
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('firefox')) {
      return true; // Likely iOS Safari/iMessage link preview
    }
  }
  
  return false;
}

// Fetch player details from Supabase
async function fetchPlayerDetails(playerId, env) {
  try {
    // Query nba_players directly
    // Note: team_tricode doesn't exist in nba_players table, use team_abbreviation instead
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/nba_players?id=eq.${playerId}&select=id,nba_player_id,name,position,team_abbreviation,jersey_number`,
      {
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`[Worker] Failed to fetch player details: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const player = data && data.length > 0 ? data[0] : null;
    
    if (player) {
      console.log(`[Worker] ✅ Fetched player: ${player.name || playerId}`);
    } else {
      console.log(`[Worker] ⚠️ Player not found: ${playerId}`);
    }
    
    return player;
  } catch (error) {
    console.error(`[Worker] Error fetching player details:`, error);
    return null;
  }
}

// Generate Open Graph meta tags for a player page
function generatePlayerPageMetaTags(player, url, playerId, env, ogImageUrlOverride = null) {
  const title = `${player.name || 'Player'} - HoopGeek`;
  // Use team_abbreviation instead of team_tricode (they're the same thing)
  const teamTricode = player.team_abbreviation || player.team_tricode || '';
  const description = player.position 
    ? `${player.name} - ${player.position}${teamTricode ? ` • ${teamTricode}` : ''}${player.jersey_number ? ` #${player.jersey_number}` : ''}`
    : `${player.name} - NBA Player Profile`;
  
  // ALWAYS use on-demand OG image generation via /player-og-image/:playerId route
  // This ensures the image is always generated correctly and accessible
  // The SVG from Supabase storage may not be accessible to iMessage, so we convert to PNG on-demand
  let ogImageUrl;
  
  if (ogImageUrlOverride) {
    // If override is provided, use it (but this shouldn't happen - we always want the PNG route)
    ogImageUrl = ogImageUrlOverride;
    console.log(`[Worker] ⚠️ Using override OG image URL (unexpected): ${ogImageUrl}`);
  } else {
    // Use the on-demand PNG route (same pattern as feed posts)
    const urlObj = new URL(url);
    const port = urlObj.port && urlObj.port !== '80' && urlObj.port !== '443' ? `:${urlObj.port}` : '';
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${port}`;
    
    ogImageUrl = `${baseUrl}/player-og-image/${playerId}`;
    
    // Ensure imageUrl is always absolute (critical for iMessage)
    if (!ogImageUrl.startsWith('http://') && !ogImageUrl.startsWith('https://')) {
      ogImageUrl = `${baseUrl}${ogImageUrl.startsWith('/') ? '' : '/'}${ogImageUrl}`;
    }
  }
  
  console.log(`[Worker] 📸 Player Page OG image URL: ${ogImageUrl}`);
  
  return `
    <!-- Player Page Specific Meta Tags -->
    <meta property="og:site_name" content="HoopGeek" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:url" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    
    <!-- Link rel="image_src" - Fallback for some platforms -->
    <link rel="image_src" href="${escapeHtml(ogImageUrl)}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@hoopgeek" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
    
    <!-- Additional Info -->
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(title)}</title>
  `;
}

// Fetch pool details from Supabase
async function fetchPoolDetails(poolId, env) {
  try {
    // Query dfs_pools directly (same as Edge Function uses)
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/dfs_pools?id=eq.${poolId}&select=*`,
      {
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`[Worker] Failed to fetch pool details: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const pool = data && data.length > 0 ? data[0] : null;
    
    if (pool) {
      console.log(`[Worker] ✅ Fetched pool: ${pool.name || poolId}`);
      
      // Also fetch game count for total_games field
      const gamesResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/dfs_pool_games?pool_id=eq.${poolId}&select=id`,
        {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact'
          }
        }
      );
      
      if (gamesResponse.ok) {
        const countHeader = gamesResponse.headers.get('content-range');
        if (countHeader) {
          const match = countHeader.match(/\/(\d+)/);
          pool.total_games = match ? parseInt(match[1]) : 0;
        } else {
          const gamesData = await gamesResponse.json();
          pool.total_games = gamesData ? gamesData.length : 0;
        }
        console.log(`[Worker] ✅ Pool has ${pool.total_games} games`);
      }
    } else {
      console.warn(`[Worker] ⚠️ Pool not found: ${poolId}`);
    }
    
    return pool;
  } catch (error) {
    console.error('[Worker] Error fetching pool details:', error);
    return null;
  }
}

// Fetch feed post details from Supabase
async function fetchFeedPost(postId, env) {
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
    );

    if (!response.ok) {
      console.error('Failed to fetch feed post:', response.status);
      return null;
    }

    const data = await response.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching feed post:', error);
    return null;
  }
}

// Fetch player boxscore data from Supabase nba_boxscores table
async function fetchPlayerBoxscore(nbaPlayerId, gameId, env) {
  try {
    console.log(`[Worker] 🔍 Fetching boxscore for player ${nbaPlayerId}, game ${gameId}`)
    
    // Query nba_boxscores by nba_player_id and game_id
    // PostgREST format: eq.value for text fields (no quotes needed)
    const url = `${env.SUPABASE_URL}/rest/v1/nba_boxscores?nba_player_id=eq.${nbaPlayerId}&game_id=eq.${gameId}&select=*`
    console.log(`[Worker] 📡 Boxscore query URL: ${url}`)
    console.log(`[Worker] 📡 Query params: nba_player_id=eq.${nbaPlayerId}, game_id=eq.${gameId}`)
    
    const response = await fetch(url, {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    if (!response.ok) {
      console.error(`[Worker] ❌ Failed to fetch boxscore: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error(`[Worker] ❌ Error response: ${errorText}`)
      return null;
    }
    
    let data

    data = await response.json();
    console.log(`[Worker] 📊 Boxscore query returned ${data.length} results`)
    
    if (data && data.length > 0) {
      const boxscore = data[0]
      console.log(`[Worker] ✅ Boxscore found: PTS=${boxscore.pts}, REB=${boxscore.reb}, AST=${boxscore.ast}, STL=${boxscore.stl}, BLK=${boxscore.blk}, TOV=${boxscore.tov}`)
      return boxscore
    } else {
      console.log(`[Worker] ⚠️ No boxscore data found for player ${nbaPlayerId} in game ${gameId}`)
      
      // Diagnostic: Try to find ANY boxscore for this player to see if player exists
      const playerOnlyUrl = `${env.SUPABASE_URL}/rest/v1/nba_boxscores?nba_player_id=eq.${nbaPlayerId}&select=nba_player_id,game_id,player_name&limit=5`
      console.log(`[Worker] 🔍 Diagnostic: Checking if player exists - querying: ${playerOnlyUrl}`)
      try {
        const playerCheckResponse = await fetch(playerOnlyUrl, {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        })
        if (playerCheckResponse.ok) {
          const playerData = await playerCheckResponse.json()
          console.log(`[Worker] 🔍 Diagnostic: Found ${playerData.length} boxscore records for player ${nbaPlayerId}`)
          if (playerData.length > 0) {
            console.log(`[Worker] 🔍 Diagnostic: Sample game_ids for this player:`, playerData.map(p => p.game_id).slice(0, 3))
          }
        }
      } catch (e) {
        console.error(`[Worker] ❌ Diagnostic query failed:`, e.message)
      }
      
      // Diagnostic: Try to find ANY boxscore for this game to see if game exists
      const gameOnlyUrl = `${env.SUPABASE_URL}/rest/v1/nba_boxscores?game_id=eq.${gameId}&select=nba_player_id,game_id,player_name&limit=5`
      console.log(`[Worker] 🔍 Diagnostic: Checking if game exists - querying: ${gameOnlyUrl}`)
      try {
        const gameCheckResponse = await fetch(gameOnlyUrl, {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        })
        if (gameCheckResponse.ok) {
          const gameData = await gameCheckResponse.json()
          console.log(`[Worker] 🔍 Diagnostic: Found ${gameData.length} boxscore records for game ${gameId}`)
          if (gameData.length > 0) {
            console.log(`[Worker] 🔍 Diagnostic: Sample player_ids for this game:`, gameData.map(g => g.nba_player_id).slice(0, 5))
          }
        }
      } catch (e) {
        console.error(`[Worker] ❌ Diagnostic query failed:`, e.message)
      }
      
      return null
    }
  } catch (error) {
    console.error(`[Worker] ❌ Error fetching boxscore: ${error.message}`)
    console.error(`[Worker] ❌ Error stack: ${error.stack}`)
    return null;
  }
}

// Get team name from tricode
function getTeamName(tricode) {
  const teamNames = {
    'ATL': 'Hawks', 'BOS': 'Celtics', 'BKN': 'Nets', 'CHA': 'Hornets', 'CHI': 'Bulls',
    'CLE': 'Cavaliers', 'DAL': 'Mavericks', 'DEN': 'Nuggets', 'DET': 'Pistons', 'GSW': 'Warriors',
    'HOU': 'Rockets', 'IND': 'Pacers', 'LAC': 'Clippers', 'LAL': 'Lakers', 'MEM': 'Grizzlies',
    'MIA': 'Heat', 'MIL': 'Bucks', 'MIN': 'Timberwolves', 'NOP': 'Pelicans', 'NYK': 'Knicks',
    'OKC': 'Thunder', 'ORL': 'Magic', 'PHI': '76ers', 'PHX': 'Suns', 'POR': 'Trail Blazers',
    'SAC': 'Kings', 'SAS': 'Spurs', 'TOR': 'Raptors', 'UTA': 'Jazz', 'WAS': 'Wizards'
  };
  return teamNames[tricode] || tricode;
}

// Format game date for display
function formatGameDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  } catch {
    return '';
  }
}

// Generate Open Graph meta tags for a feed post (parallels avatar bar)
function generateFeedPostMetaTags(post, url) {
  // Use share metadata if available, otherwise generate from post data
  const title = post.share_title || post.title || 'NBA Highlights - HoopGeek';
  
  // Build description optimized for card previews (Instagram/YouTube style)
  // Format: Title info first, then key stats, then description
  let description = '';
  
  // Start with post description if available (most engaging)
  if (post.share_description) {
    description = post.share_description;
  } else if (post.description) {
    description = post.description;
  }
  
  // Add team matchup and score (key visual info)
  if (post.team_tricodes && Array.isArray(post.team_tricodes) && post.team_tricodes.length >= 2) {
    const [awayTeam, homeTeam] = post.team_tricodes;
    let matchupInfo = `${getTeamName(awayTeam)} vs ${getTeamName(homeTeam)}`;
    
    // Add game score if available
    if (post.metadata) {
      try {
        const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata;
        let score = null;
        if (metadata.story_data) {
          const storyData = typeof metadata.story_data === 'string' ? JSON.parse(metadata.story_data) : metadata.story_data;
          if (storyData.awayScore !== undefined && storyData.homeScore !== undefined) {
            score = `${storyData.awayScore}-${storyData.homeScore}`;
          }
        } else if (metadata.awayPoints !== undefined && metadata.homePoints !== undefined) {
          score = `${metadata.awayPoints}-${metadata.homePoints}`;
        }
        if (score) {
          matchupInfo += ` ${score}`;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    // Add matchup info to description
    if (description) {
      description = `${matchupInfo} • ${description}`;
    } else {
      description = matchupInfo;
    }
  }
  
  // Add fun score if available (engagement metric)
  if (post.metadata) {
    try {
      const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata;
      if (metadata.fun_score !== undefined) {
        const funScore = `Fun Score: ${metadata.fun_score}`;
        if (description) {
          description += ` • ${funScore}`;
        } else {
          description = funScore;
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  
  // Fallback if no description at all
  if (!description) {
    description = 'Check out this NBA highlight on HoopGeek';
  }
  
  // Truncate description to reasonable length (shorter for card previews)
  if (description.length > 200) {
    description = description.substring(0, 197) + '...';
  }
  
  // Get base URL for constructing absolute image URLs
  const urlObj = new URL(url);
  // Include port if present (for development), otherwise use standard ports
  const port = urlObj.port && urlObj.port !== '80' && urlObj.port !== '443' ? `:${urlObj.port}` : '';
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${port}`;
  
  // ALWAYS use on-demand OG image generation via /og-image/:postId route
  // This ensures the image is always generated correctly and accessible
  // The share_image_url might point to Supabase storage which may not be accessible to iMessage
  const postId = post.id;
  let imageUrl = `${baseUrl}/og-image/${postId}`;
  
  // Ensure imageUrl is always absolute (critical for iMessage)
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  }
  
  console.log(`[generateFeedPostMetaTags] Base URL: ${baseUrl}, Generated OG image URL: ${imageUrl}`);

  // Instagram/YouTube-style card preview requires large images
  // Optimal dimensions: 1200x630px (1.91:1 aspect ratio)
  // But we'll accept whatever image we have and let platforms optimize

  // Determine image type based on URL
  // og-image endpoint now serves PNG for better compatibility (iMessage, etc.)
  const isOGImageEndpoint = imageUrl.includes('/og-image/')
  const isPNG = imageUrl.includes('.png') || imageUrl.includes('.PNG')
  const isJPEG = imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') || imageUrl.includes('.JPG') || imageUrl.includes('.JPEG')
  let imageType = 'image/png' // Default to PNG for better compatibility
  if (isOGImageEndpoint) {
    imageType = 'image/png' // og-image endpoint now serves PNG, not SVG
  } else if (isPNG) {
    imageType = 'image/png'
  } else if (isJPEG) {
    imageType = 'image/jpeg'
  }
  
  // Ensure image URL uses HTTPS for secure_url (required by some platforms)
  const secureImageUrl = imageUrl.replace(/^http:/, 'https:');
  
  // Ensure imageUrl is always HTTPS for iMessage compatibility
  const httpsImageUrl = imageUrl.startsWith('http://') ? imageUrl.replace('http://', 'https://') : imageUrl;
  
  return `
    <!-- Feed Post Specific Meta Tags - Instagram/YouTube Style Card -->
    <!-- These MUST be at the top of <head> for iMessage to pick them up -->
    <meta property="og:site_name" content="HoopGeek" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(httpsImageUrl)}" />
    <meta property="og:image:url" content="${escapeHtml(httpsImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(secureImageUrl)}" />
    <meta property="og:image:type" content="${imageType}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    
    <!-- Link rel="image_src" - Fallback for some platforms including older iMessage -->
    <link rel="image_src" href="${escapeHtml(httpsImageUrl)}" />
    
    <!-- Twitter Card - Large Image -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@hoopgeek" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(httpsImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
    
    <!-- Additional Meta Tags -->
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="article:author" content="HoopGeek" />
    <title>${escapeHtml(title)}</title>
  `;
}

// Generate Open Graph meta tags for a DFS pool
function generatePoolMetaTags(pool, url, poolId, env) {
  const title = `${pool.pool_name || pool.name || 'DFS Contest'} - HoopGeek`;
  const entryFee = pool.entry_fee === 0 ? 'FREE' : `$${pool.entry_fee}`;
  const prizePool = pool.prize_pool ? `$${pool.prize_pool}` : 'TBD';
  const entries = pool.current_entries || 0;
  const maxEntries = pool.max_entries || '∞';
  
  let description = `Join this ${entryFee} DFS basketball contest! `;
  description += `💰 Prize Pool: ${prizePool} | `;
  description += `👥 ${entries}/${maxEntries} entries | `;
  description += `${pool.total_games || 0} NBA games`;
  
  if (pool.lock_time) {
    const lockDate = new Date(pool.lock_time);
    description += ` | Locks ${lockDate.toLocaleDateString()} at ${lockDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  // Get base URL from request for image URLs
  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
  
  // Use on-demand OG image generation via /dfs-og-image/:poolId route (same as feed posts)
  // This ensures the image is always generated correctly and converted to PNG
  const ogImageUrl = poolId 
    ? `${baseUrl}/dfs-og-image/${poolId}`
    : `${baseUrl}/dfs-og-image.jpg`; // Fallback
  
  console.log(`[Worker] 📸 DFS Pool OG image URL: ${ogImageUrl}`)
  
  return `
    <!-- DFS Pool Specific Meta Tags -->
    <meta property="og:site_name" content="HoopGeek" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:url" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    
    <!-- Link rel="image_src" - Fallback for some platforms -->
    <link rel="image_src" href="${escapeHtml(ogImageUrl)}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@hoopgeek" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
    
    <!-- Additional Info -->
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(title)}</title>
  `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Inject meta tags into HTML
function injectMetaTags(html, metaTags) {
  let modifiedHtml = html;
  
  // Find the head tag
  const headOpenIndex = modifiedHtml.indexOf('<head>');
  const headCloseIndex = modifiedHtml.indexOf('</head>');
  
  if (headOpenIndex === -1 || headCloseIndex === -1) {
    console.error('Could not find head tag');
    return html; // Return original if we can't find head
  }
  
  // Extract head content
  const beforeHead = modifiedHtml.substring(0, headOpenIndex + 6); // +6 for '<head>'
  const headContent = modifiedHtml.substring(headOpenIndex + 6, headCloseIndex);
  const afterHead = modifiedHtml.substring(headCloseIndex);
  
  // Remove existing OG tags, Twitter tags, and description/title tags more aggressively
  // This regex catches all variations: <meta property="og:...">, <meta name="og:...">, etc.
  const ogTagRegex = /<meta\s+[^>]*(property|name)=["'](og:|twitter:)[^"']*["'][^>]*>/gi;
  const descTagRegex = /<meta\s+[^>]*name=["']description["'][^>]*>/gi;
  const titleRegex = /<title>[^<]*<\/title>/gi;
  
  let cleanedHead = headContent
    .replace(ogTagRegex, '')
    .replace(descTagRegex, '')
    .replace(titleRegex, '');
  
  // Clean up extra newlines and whitespace
  cleanedHead = cleanedHead.replace(/\n\s*\n\s*\n/g, '\n').trim();
  
  // Find where to insert - right after charset/viewport tags (essential meta tags)
  // Insert after the first few lines (charset, viewport, etc.) but before everything else
  // This ensures iMessage sees our OG tags first
  const insertAfterEssential = cleanedHead.match(/(<meta[^>]*charset[^>]*>[\s\S]*?<meta[^>]*viewport[^>]*>)/i);
  let insertionPoint = 0;
  
  if (insertAfterEssential) {
    insertionPoint = insertAfterEssential.index + insertAfterEssential[0].length;
    // Find the next newline after the essential tags
    const nextNewline = cleanedHead.indexOf('\n', insertionPoint);
    if (nextNewline !== -1) {
      insertionPoint = nextNewline + 1;
    }
  }
  
  // Insert new meta tags at the beginning of head (after essential tags)
  // This ensures iMessage reads them first
  const beforeInsert = cleanedHead.substring(0, insertionPoint);
  const afterInsert = cleanedHead.substring(insertionPoint);
  const newHead = beforeInsert + '\n    ' + metaTags + '\n    ' + afterInsert;
  
  modifiedHtml = beforeHead + newHead + '\n  ' + afterHead;
  
  return modifiedHtml;
}

// Helper functions for OG image generation (imported from og-image-generator.js logic)
// Team colors matching src/utils/nbaTeamColors.ts
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
  'UTA': { primary: '#002B5C', secondary: '#00471B' },
  'WAS': { primary: '#002B5C', secondary: '#E31837' },
}

function getTeamSecondaryColor(tricode) {
  return TEAM_COLORS[tricode]?.secondary || '#FFFFFF'
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

async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Generator/1.0)' }
    })
    if (!response.ok) return null
    
    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    if (contentType.includes('svg') || contentType.includes('xml')) {
      const text = new TextDecoder().decode(buffer)
      const utf8Bytes = new TextEncoder().encode(text)
      let binary = ''
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i])
      }
      return `data:${contentType};base64,${btoa(binary)}`
    }
    
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize)
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j])
      }
    }
    return `data:${contentType};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

async function generateOGImageSVG(post, env) {
  const width = 1200, height = 630
  const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {})
  const storyData = typeof metadata.story_data === 'string' ? JSON.parse(metadata.story_data) : (metadata.story_data || {})
  const teamTricodes = post.team_tricodes || []
  const playerIds = post.player_ids || []
  
  // Check if this is a player_spotlight post - if so, find the most featured player from slides
  let primaryPlayerId = null
  if (post.post_type === 'player_spotlight') {
    try {
      const slides = typeof post.slides === 'string' ? JSON.parse(post.slides) : (post.slides || [])
      
      // Count personId occurrences in slides
      const playerCounts = new Map()
      slides.forEach((slide) => {
        const personId = slide.metadata?.personId
        if (personId) {
          const count = playerCounts.get(personId) || 0
          playerCounts.set(personId, count + 1)
        }
      })
      
      // Find the player that appears most
      let maxCount = 0
      playerCounts.forEach((count, personId) => {
        if (count > maxCount) {
          maxCount = count
          primaryPlayerId = personId
        }
      })
      
      // Fallback to first player_id if no personId found in slides
      if (!primaryPlayerId && playerIds.length > 0) {
        primaryPlayerId = parseInt(playerIds[0])
      }
    } catch (e) {
      console.error('Error parsing slides for player_spotlight:', e)
      // Fallback to first player_id
      if (playerIds.length > 0) {
        primaryPlayerId = parseInt(playerIds[0])
      }
    }
  }
  
  // Determine post type: Fun Score (game post with fun_score) or Player Highlight (player post)
  const funData = typeof metadata.fun_data === 'string' ? JSON.parse(metadata.fun_data) : (metadata.fun_data || {})
  const funScoreRaw = metadata.fun_score ?? funData.fun_score ?? 0
  const isFunScorePost = post.post_type === 'fun_score' && teamTricodes.length >= 2 && funScoreRaw > 0 && !primaryPlayerId
  const isGamePost = teamTricodes.length >= 2 && !primaryPlayerId && !isFunScorePost
  const isPlayerPost = primaryPlayerId || (playerIds.length > 0 && !isGamePost && !isFunScorePost)
  
  // Extract top players for fun score posts BEFORE generating SVG (so we can add gradients to defs)
  // Only show top player avatars if post_type is 'fun_score'
  let topPlayers = []
  if (post.post_type === 'fun_score') {
    console.log(`[Worker] 🔍 Fun Score Post detected, extracting top players from slides...`)
    try {
      const slides = typeof post.slides === 'string' ? JSON.parse(post.slides) : (post.slides || [])
      console.log(`[Worker] 📊 Slides count: ${slides.length}`)
      for (const slide of slides) {
        if (slide.type === 'top_fantasy_scorers' && slide.players && Array.isArray(slide.players)) {
          console.log(`[Worker] ✅ Found top_fantasy_scorers slide with ${slide.players.length} players`)
          // Get top 5 players (already sorted by fantasyPoints)
          topPlayers = slide.players.slice(0, 5)
          console.log(`[Worker] 📋 Extracted ${topPlayers.length} top players`)
          
          // Fetch player avatars using personId directly from player object
          for (const player of topPlayers) {
            // Use personId directly from player object if available, otherwise try to find it
            let personId = player.personId || null
            console.log(`[Worker] 🔍 Processing player: ${player.name}, personId: ${personId}`)
            
            // Fallback: Find personId from slides by matching player name if not directly available
            if (!personId) {
              const playerLastName = player.name?.split(' ').pop() || ''
              
              for (const slideItem of slides) {
                if (slideItem.type === 'video' && slideItem.metadata) {
                  // Match by full name (playerNameI) or last name (playerName)
                  if (slideItem.metadata.playerNameI === player.name || 
                      slideItem.metadata.playerName === playerLastName) {
                    personId = slideItem.metadata.personId
                    console.log(`[Worker] ✅ Found personId ${personId} for ${player.name} from video slide`)
                    if (personId) break
                  }
                }
              }
            }
            
            // Set personId on player object
            if (personId) {
              player.personId = personId
              // Fetch avatar using personId
              console.log(`[Worker] 📥 Fetching avatar for personId ${personId}`)
              player.avatarBase64 = await fetchImageAsBase64(getPlayerAvatarUrl(personId))
              console.log(`[Worker] 📥 Avatar fetch result: ${player.avatarBase64 ? '✅' : '❌'}`)
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
              console.log(`[Worker] ✅ Processed player ${player.name}: team=${player.teamTricode}, avatar=${player.avatarBase64 ? 'loaded' : 'missing'}`)
            } else {
              console.warn(`[Worker] ⚠️ Could not find personId for player: ${player.name}`)
            }
          }
          console.log(`[Worker] ✅ Extracted ${topPlayers.length} top players for fun score post`)
          break
        }
      }
      // Fallback: If no top_fantasy_scorers slide found, query database for top 5 players
      if (topPlayers.length === 0 && post.game_id && env) {
        console.log(`[Worker] ⚠️ No top_fantasy_scorers slide found, querying database for top 5 fantasy scorers...`)
        try {
          const supabaseUrl = env.SUPABASE_URL
          const supabaseKey = env.SUPABASE_ANON_KEY
          
          if (!supabaseUrl || !supabaseKey) {
            console.warn(`[Worker] ⚠️ Missing Supabase credentials`)
          } else {
            const response = await fetch(`${supabaseUrl}/rest/v1/nba_boxscores?game_id=eq.${post.game_id}&min=gt.0&select=nba_player_id,player_name,team_tricode,pts,reb,ast,stl,blk,tov`, {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (response.ok) {
              const boxscores = await response.json()
              console.log(`[Worker] ✅ Found ${boxscores.length} players in boxscores for game ${post.game_id}`)
              
              if (boxscores.length > 0) {
                // Calculate fantasy points for each player and sort
                const playersWithFP = boxscores.map((boxscore) => {
                  // Fantasy points calculation: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
                  const fantasyPoints = (boxscore.pts || 0) + 
                                      ((boxscore.reb || 0) * 1.2) + 
                                      ((boxscore.ast || 0) * 1.5) + 
                                      ((boxscore.stl || 0) * 3) + 
                                      ((boxscore.blk || 0) * 3) - 
                                      (boxscore.tov || 0)
                  
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
                  .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
                  .slice(0, 5)
                
                console.log(`[Worker] ✅ Calculated top ${topPlayers.length} players from database`)
                
                // Fetch avatars for top players
                for (const player of topPlayers) {
                  if (player.personId) {
                    console.log(`[Worker] 📥 Fetching avatar for personId ${player.personId} (${player.name})`)
                    player.avatarBase64 = await fetchImageAsBase64(getPlayerAvatarUrl(player.personId))
                    console.log(`[Worker] 📥 Avatar fetch result: ${player.avatarBase64 ? '✅' : '❌'}`)
                    player.teamPrimary = getTeamPrimaryColor(player.teamTricode)
                    player.teamSecondary = getTeamSecondaryColor(player.teamTricode)
                    console.log(`[Worker] ✅ Processed player ${player.name}: team=${player.teamTricode}, avatar=${player.avatarBase64 ? 'loaded' : 'missing'}`)
                  }
                }
              }
            } else {
              console.warn(`[Worker] ⚠️ Could not fetch boxscores from database: ${response.status}`)
            }
          }
        } catch (dbError) {
          console.error('[Worker] ❌ Error querying database for top players:', dbError)
        }
      }
    } catch (e) {
      console.error('[Worker] ❌ Error extracting top players for fun score:', e)
    }
  }
  
  // Use web fonts that resvg can fetch - embed font-face with URL
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <style>
        @font-face {
          font-family: 'Roboto';
          font-style: normal;
          font-weight: 400;
          src: url('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf') format('truetype');
        }
        @font-face {
          font-family: 'Roboto';
          font-style: normal;
          font-weight: 700;
          src: url('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf') format('truetype');
        }
        /* Use Roboto web font - resvg can fetch it */
        .team-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 700; fill: white; }
        .score-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 700; fill: black; }
        .date-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 600; fill: white; }
        .title-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 700; fill: #ffffff; }
        .brand-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 600; fill: #ffffff; }
      </style>
      <filter id="shadow">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#e9ecef;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="playerBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#e9ecef;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="fallbackBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#2d2d2d;stop-opacity:1" />
      </linearGradient>
      ${post.post_type === 'fun_score' && topPlayers.length > 0 ? topPlayers.map((player, index) => {
        const playerGradientId = `topPlayerGrad-${index}`
        return `<linearGradient id="${playerGradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${player.teamPrimary || '#1D428A'};stop-opacity:0.6" />
          <stop offset="50%" style="stop-color:${player.teamSecondary || '#FFC72C'};stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:${player.teamPrimary || '#1D428A'};stop-opacity:0.4" />
        </linearGradient>`
      }).join('') : ''}
    </defs>`
  
  if (isFunScorePost || isGamePost) {
    const [awayTeam, homeTeam] = teamTricodes
    const awayColor = getTeamPrimaryColor(awayTeam)
    const homeColor = getTeamPrimaryColor(homeTeam)
    const awayLogoBase64 = await fetchImageAsBase64(getTeamLogoUrl(awayTeam))
    const homeLogoBase64 = await fetchImageAsBase64(getTeamLogoUrl(homeTeam))
    const awayScore = storyData.awayScore ?? metadata.awayPoints
    const homeScore = storyData.homeScore ?? metadata.homePoints
    const dateStr = formatGameDate(post.game_date)
    
    // Extract and format fun score (divide by 10, show 1 decimal)
    const funScoreFormatted = (funScoreRaw / 10).toFixed(1)
    
    // Note: topPlayers already extracted above (before SVG generation) for gradient definitions
    
    // Extract milestones from fun_data
    const scoringMilestones = funData.scoring_milestones || {}
    let milestoneText = ''
    
    // Process milestones: prioritize 70 Ball > 60 Ball > 50 Ball > 40 Ball > Triple Double
    const milestoneOrder = ['70 Ball', '60 Ball', '50 Ball', '40 Ball', 'Triple Double']
    for (const category of milestoneOrder) {
      const players = scoringMilestones[category] || []
      if (players.length > 0) {
        const [playerName, points] = players[0] // Get first player
        if (category === 'Triple Double') {
          milestoneText = playerName
        } else {
          // Format as "PlayerName Xpt" or just "Xpt" if short
          const pointsText = points ? `${points}pt` : ''
          milestoneText = pointsText || playerName
        }
        break // Use first milestone found
      }
    }
    
    // Large split-circle avatar (like avatar bar) - positioned center-left
    const avatarSize = 380  // Large circle to match avatar bar prominence
    const avatarCenterX = 300
    const avatarCenterY = height / 2
    const logoSize = 200  // Logo size for each half (increased to fill space)
    const rightSideStartX = avatarCenterX + avatarSize/2 + 80
    
    svg += `
      <!-- Black background (matching player highlights) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="#000000"/>
      
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
          <text x="${avatarCenterX - avatarSize/4}" y="${avatarCenterY + 10}" font-family="Roboto" font-size="64" font-weight="700" text-anchor="middle" fill="white">${awayTeam}</text>
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
          <text x="${avatarCenterX + avatarSize/4}" y="${avatarCenterY + 10}" font-family="Roboto" font-size="64" font-weight="700" text-anchor="middle" fill="white">${homeTeam}</text>
        `}
        
        <!-- Circle border (white dashed like player highlights) -->
        <circle 
          cx="${avatarCenterX}" 
          cy="${avatarCenterY}" 
          r="${avatarSize/2}" 
          fill="none" 
          stroke="#ffffff" 
          stroke-width="6"
          stroke-dasharray="16,8"
          opacity="0.8"/>
      </g>
      
      <!-- Fun Score badge - overlaid on avatar bottom (no milestones) - BIGGER -->
      ${funScoreRaw > 0 ? `
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
            font-family="Roboto" 
            font-size="44" 
            font-weight="700"
            text-anchor="middle" 
            fill="#000">${funScoreFormatted}</text>
        </g>
      ` : ''}
      
      <!-- Game score badge (if available and no fun score) - overlaid on avatar bottom - BIGGER -->
      ${funScoreRaw === 0 && awayScore !== undefined && homeScore !== undefined ? `
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
            font-family="Roboto" 
            font-size="44" 
            font-weight="700"
            text-anchor="middle" 
            fill="#000">${awayScore}-${homeScore}</text>
        </g>
      ` : ''}
      
      <!-- Title and description (right side) - white text matching player highlights -->
      <g transform="translate(${rightSideStartX}, ${height/2 - 140})">
        ${post.title || post.share_title ? `
          <text 
            x="0" 
            y="0" 
            font-family="Roboto" 
            font-size="56" 
            font-weight="700"
            text-anchor="start"
            fill="#ffffff"
            filter="url(#shadow)">${escapeHtml((post.title || post.share_title || 'NBA Highlights').replace(/Fun Score:\s*\d+\.?\d*\s*/gi, '').replace(/^\s*[•·]\s*/, '').replace(/^\s*\.\d+\s*[•·]?\s*/gi, '').replace(/\s*•\s*/g, ' • ').trim())}</text>
        ` : ''}
        
      </g>
      
      <!-- Top 5 Fantasy Scorers (Fun Score posts only) - horizontal row of avatars -->
      ${post.post_type === 'fun_score' && topPlayers.length > 0 ? `
        <g transform="translate(${rightSideStartX}, ${height/2 + 40})">
          ${topPlayers.map((player, index) => {
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
                    font-family="Roboto" 
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
            font-family="Roboto" 
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
        font-family="Roboto" 
        font-size="28" 
        text-anchor="end"
        fill="#ffffff"
        opacity="0.7">HoopGeek</text>`
      
  } else if (isPlayerPost) {
    console.log(`[Worker] 🏀 Player Post detected:`)
    console.log(`[Worker]   - post.game_id: ${post.game_id}`)
    console.log(`[Worker]   - post.player_ids: ${JSON.stringify(post.player_ids)}`)
    console.log(`[Worker]   - primaryPlayerId: ${primaryPlayerId}`)
    console.log(`[Worker]   - post.game_date: ${post.game_date}`)
    console.log(`[Worker]   - env available: ${!!env}`)
    
    // Use primaryPlayerId if found from slides, otherwise use first player_id
    const playerId = primaryPlayerId || (playerIds.length > 0 ? parseInt(playerIds[0]) : null)
    console.log(`[Worker]   - Final playerId: ${playerId}`)
    
    if (!playerId) {
      // Fallback if no player ID available
      svg += `
        <rect width="${width}" height="${height}" fill="url(#fallbackBg)"/>
        <text x="${width/2}" y="${height/2}" class="team-text" font-size="64" text-anchor="middle" font-weight="700">${escapeHtml(post.title || post.share_title || 'Player Highlight')}</text>
        <text x="${width - 40}" y="${height - 30}" font-family="Roboto" font-size="28" font-weight="600" text-anchor="end" fill="#999">HoopGeek</text>`
      svg += `</svg>`
      return svg
    }
    
    const playerAvatarBase64 = await fetchImageAsBase64(getPlayerAvatarUrl(playerId))
    
    // Get team logos and colors for right side
    const awayTeam = teamTricodes.length > 0 ? teamTricodes[0] : null
    const homeTeam = teamTricodes.length > 1 ? teamTricodes[1] : null
    const awayLogoBase64 = awayTeam ? await fetchImageAsBase64(getTeamLogoUrl(awayTeam)) : null
    const homeLogoBase64 = homeTeam ? await fetchImageAsBase64(getTeamLogoUrl(homeTeam)) : null
    const dateStr = formatGameDate(post.game_date)
    
    // Get game score from metadata
    const awayScore = storyData.awayScore ?? metadata.awayPoints
    const homeScore = storyData.homeScore ?? metadata.homePoints
    
    // Count slides and find player's team for gradient
    let slideCount = 0
    let playerTeamTricode = null
    let foundStats = false  // Declare outside try block so it's accessible in template
    let playerStats = {
      points: 0,
      madeShots: 0,
      missedShots: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0
    }
    
    try {
      const slides = typeof post.slides === 'string' ? JSON.parse(post.slides) : (post.slides || [])
      slideCount = slides.length
      
      // PRIORITY 1: Get stats from top_fantasy_scorers slide in metadata (PRIMARY SOURCE)
      // This is the most reliable source since it's already in the post metadata
      if (!foundStats) {
        console.log(`[Worker] 🔍 Primary: Trying to get stats from top_fantasy_scorers slide`)
        for (const slide of slides) {
          if (slide.type === 'top_fantasy_scorers' && slide.players && Array.isArray(slide.players)) {
            // Find the player by matching personId (from player_ids array)
            // playerId is the nba_player_id (personId)
            const nbaPlayerId = parseInt(playerId)
            
            let playerData = slide.players.find(p => {
              // Check if personId matches
              if (p.personId === nbaPlayerId) return true
              // Also check if there's a highlightedPlayerId that matches
              if (slide.highlightedPlayerId === nbaPlayerId) {
                return true
              }
              return false
            })
            
            // If highlightedPlayerId matches but we didn't find by personId, try to find by position
            if (!playerData && slide.highlightedPlayerId === nbaPlayerId && slide.players.length > 0) {
              // Usually highlighted player is first in the list
              playerData = slide.players[0]
            }
            
            // Try to find by matching player name from title
            if (!playerData) {
              const playerName = post.title?.match(/^([A-Z]\.\s+[A-Za-z]+)/)?.[1]
              if (playerName) {
                playerData = slide.players.find(p => {
                  if (p.name === playerName || p.name?.includes(playerName.split(' ')[1])) return true
                  return false
                })
              }
            }
            
            // Last resort: if we know the team, find first player from that team
            if (!playerData && playerTeamTricode) {
              playerData = slide.players.find(p => p.teamTricode === playerTeamTricode)
            }
            
            if (playerData) {
              console.log(`[Worker] ✅ Found stats in top_fantasy_scorers slide (PRIMARY SOURCE):`, {
                pts: playerData.pts,
                reb: playerData.reb,
                ast: playerData.ast,
                stl: playerData.stl,
                blk: playerData.blk,
                tov: playerData.tov
              })
              playerStats.points = playerData.pts || 0
              playerStats.rebounds = playerData.reb || 0
              playerStats.assists = playerData.ast || 0
              playerStats.steals = playerData.stl || 0
              playerStats.blocks = playerData.blk || 0
              playerStats.turnovers = playerData.tov || 0
              
              // Also get team tricode if we don't have it
              if (!playerTeamTricode && playerData.teamTricode) {
                playerTeamTricode = playerData.teamTricode
              }
              
              foundStats = true
              break
            }
          }
        }
        
        if (!foundStats) {
          console.log(`[Worker] ⚠️ No top_fantasy_scorers slide found, trying database fallback`)
        }
      }
      
      // PRIORITY 2: Fall back to nba_boxscores database if metadata doesn't have stats
      if (!foundStats && post.game_id && env) {
        try {
          // playerId is the nba_player_id (personId) - ensure it's an integer
          const nbaPlayerId = parseInt(playerId)
          const gameId = post.game_id
          
          console.log(`[Worker] 🔍 Fallback: Fetching boxscore from nba_boxscores database:`)
          console.log(`[Worker]   - playerId (personId): ${playerId} (as nba_player_id: ${nbaPlayerId})`)
          console.log(`[Worker]   - game_id: ${gameId}`)
          
          if (!nbaPlayerId || isNaN(nbaPlayerId)) {
            console.log(`[Worker] ⚠️ Invalid playerId: ${playerId}, cannot query boxscore`)
          } else {
            const boxscore = await fetchPlayerBoxscore(nbaPlayerId, gameId, env)
            if (boxscore) {
              console.log(`[Worker] ✅ Successfully fetched boxscore from database (FALLBACK)`)
              console.log(`[Worker] 📊 Raw boxscore data:`, {
                pts: boxscore.pts,
                reb: boxscore.reb,
                ast: boxscore.ast,
                stl: boxscore.stl,
                blk: boxscore.blk,
                tov: boxscore.tov
              })
              playerStats.points = boxscore.pts || 0
              playerStats.rebounds = boxscore.reb || 0
              playerStats.assists = boxscore.ast || 0
              playerStats.steals = boxscore.stl || 0
              playerStats.blocks = boxscore.blk || 0
              playerStats.turnovers = boxscore.tov || 0
              console.log(`[Worker] 📊 Final playerStats:`, playerStats)
              
              // Also get team tricode if we don't have it
              if (!playerTeamTricode && boxscore.team_tricode) {
                playerTeamTricode = boxscore.team_tricode
              }
              
              foundStats = true
            } else {
              console.log(`[Worker] ⚠️ Boxscore query returned no data`)
            }
          }
        } catch (e) {
          console.error(`[Worker] ❌ Error fetching boxscore from database: ${e.message}`)
          console.error(`[Worker] ❌ Error stack: ${e.stack}`)
        }
      } else if (!foundStats) {
        if (!post.game_id) {
          console.log(`[Worker] ⚠️ No game_id on post`)
        }
        if (!env) {
          console.log(`[Worker] ⚠️ No env available`)
        }
      }
      
      // PRIORITY 3: Last resort - extract from individual slides (not reliable for totals)
      // But don't accumulate points - just count actions
      if (!foundStats) {
        for (const slide of slides) {
          if (slide.metadata?.personId === playerId) {
            // Find player's team
            if (slide.metadata?.teamTricode && !playerTeamTricode) {
              playerTeamTricode = slide.metadata.teamTricode
            }
            
            // Just count actions, don't accumulate points from captions (they're per-play, not total)
            const actionType = slide.metadata?.actionType
            if (actionType === 'Rebound') {
              playerStats.rebounds++
            } else if (actionType === 'Turnover') {
              playerStats.turnovers++
            }
            // Note: Don't count points from individual slide captions - they're cumulative within the slide
            // and we'd need the final game totals, not individual play points
          }
        }
      }
      
      // Fallback to first team if not found
      if (!playerTeamTricode && teamTricodes.length > 0) {
        playerTeamTricode = teamTricodes[0]
      }
    } catch (e) {
      // Ignore parse errors
      console.error(`[Worker] ❌ Error in stats extraction: ${e.message}`)
    }
    
    // Log final stats before rendering
    console.log(`[Worker] 📊 FINAL STATS BEFORE RENDERING:`)
    console.log(`[Worker]   - foundStats: ${foundStats}`)
    console.log(`[Worker]   - playerStats:`, JSON.stringify(playerStats, null, 2))
    console.log(`[Worker]   - points: ${playerStats.points}, rebounds: ${playerStats.rebounds}, assists: ${playerStats.assists}, steals: ${playerStats.steals}, blocks: ${playerStats.blocks}`)
    
    // Calculate fantasy points from boxscore stats (only if player found in top_fantasy_scorers)
    // Standard fantasy scoring: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
    let fantasyPoints = 0
    if (foundStats) {
      fantasyPoints = playerStats.points + 
                      (playerStats.rebounds * 1.2) + 
                      (playerStats.assists * 1.5) + 
                      (playerStats.steals * 3) + 
                      (playerStats.blocks * 3) - 
                      playerStats.turnovers
      console.log(`[Worker] ✅ Calculated fantasy points from metadata: ${fantasyPoints.toFixed(1)} FP`)
    } else {
      // Don't show fantasy points if player not in top_fantasy_scorers
      fantasyPoints = 0
      console.log(`[Worker] ⚠️ Player not found in top_fantasy_scorers, not showing stats or FP`)
    }
    
    // Get player's team colors for gradient
    const playerTeamPrimary = playerTeamTricode ? getTeamPrimaryColor(playerTeamTricode) : '#1D428A'
    const playerTeamSecondary = playerTeamTricode ? getTeamSecondaryColor(playerTeamTricode) : '#FFC72C'
    
    // Large player avatar (like avatar bar) - positioned center-left
    // Move avatar down to align with date badge center
    const avatarSize = 380  // Large circle to match avatar bar prominence
    const avatarCenterX = 300
    const avatarCenterY = height / 2 + 25  // Move down 25px to align with date badge center
    const rightSideStartX = avatarCenterX + avatarSize/2 + 80
    
    // Define gradient for player's team colors
    const playerGradientId = `playerTeamGrad-${playerId}`
    const playerGradientDef = `<linearGradient id="${playerGradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${playerTeamPrimary};stop-opacity:0.6" />
            <stop offset="50%" style="stop-color:${playerTeamSecondary};stop-opacity:0.5" />
            <stop offset="100%" style="stop-color:${playerTeamPrimary};stop-opacity:0.4" />
          </linearGradient>`
    
    // Insert gradient into defs (before closing defs tag)
    svg = svg.replace('</defs>', `${playerGradientDef}</defs>`)
    
    svg += `
      <!-- Black background (matching home page) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="#000000"/>
      
      <!-- Player avatar circle with team color gradient background -->
      <g>
        <!-- Gradient circle behind avatar (team colors) -->
        <circle 
          cx="${avatarCenterX}" 
          cy="${avatarCenterY}" 
          r="${avatarSize/2 + 20}" 
          fill="url(#${playerGradientId})"
          opacity="0.8"/>
        
        <!-- Circle clip path -->
        <clipPath id="playerAvatarCircle">
          <circle cx="${avatarCenterX}" cy="${avatarCenterY}" r="${avatarSize/2}"/>
        </clipPath>
        
        <!-- Player avatar image -->
        ${playerAvatarBase64 ? `
          <image 
            href="${playerAvatarBase64}" 
            x="${avatarCenterX - avatarSize/2}" 
            y="${avatarCenterY - avatarSize/2}" 
            width="${avatarSize}" 
            height="${avatarSize}" 
            clip-path="url(#playerAvatarCircle)"
            filter="url(#shadow)"/>
        ` : `
          <!-- Fallback if avatar doesn't load -->
          <circle 
            cx="${avatarCenterX}" 
            cy="${avatarCenterY}" 
            r="${avatarSize/2}" 
            fill="#1a1a1a"/>
          <text 
            x="${avatarCenterX}" 
            y="${avatarCenterY + 30}" 
            font-family="Roboto" 
            font-size="80" 
            text-anchor="middle"
            fill="#ffffff">Player</text>
        `}
        
        <!-- Dashed border (outer border like fun score avatar) -->
        <circle 
          cx="${avatarCenterX}" 
          cy="${avatarCenterY}" 
          r="${avatarSize/2 + 3}" 
          fill="none" 
          stroke="#ffffff" 
          stroke-width="6" 
          stroke-dasharray="16,8"
          opacity="0.8"/>
      </g>
      
      <!-- Fantasy Points badge overlaid on avatar (only show if found in top_fantasy_scorers) -->
      ${foundStats && fantasyPoints !== undefined && fantasyPoints !== null && fantasyPoints > 0 ? `
        <g transform="translate(${avatarCenterX}, ${avatarCenterY + avatarSize/2 * 0.75})">
          <rect 
            x="-100" 
            y="-22" 
            width="200" 
            height="44" 
            rx="8" 
            fill="#FFC72C" 
            stroke="#000" 
            stroke-width="3"
            filter="url(#shadow)"
            opacity="0.98"/>
          <text 
            x="0" 
            y="5" 
            font-family="Roboto" 
            font-size="32" 
            text-anchor="middle" 
            font-weight="bold"
            fill="#000">${fantasyPoints.toFixed(1)} FP</text>
        </g>
      ` : ''}
      
      <!-- Title and highlights count (right side) - white text matching home page -->
      <g transform="translate(${rightSideStartX}, ${height/2 - 140})">
        <text 
          x="0" 
          y="0" 
          font-family="Roboto" 
          font-size="56" 
          font-weight="700"
          text-anchor="start"
          fill="#ffffff"
          filter="url(#shadow)">${escapeHtml((post.title || post.share_title || 'Player Highlight')
            .replace(/\s*\([^)]*FP[^)]*\)/gi, '') // Remove FP
            .replace(/\s*'s\s+Game\s+Highlights?/gi, '') // Remove "'s Game Highlights"
            .replace(/\s+vs\s+[A-Za-z]+/gi, '') // Remove "vs [Team Name]" (e.g., "vs Thunder")
            .trim())}</text>
        
        <!-- Slide count / highlights count -->
        ${slideCount > 0 ? `
          <text 
            x="0" 
            y="70" 
            font-family="Roboto" 
            font-size="32" 
            font-weight="600"
            text-anchor="start"
            opacity="0.9"
            fill="#cccccc">${slideCount} highlight${slideCount !== 1 ? 's' : ''}</text>
        ` : ''}
        
        <!-- Player stats summary (only show if player found in top_fantasy_scorers) -->
        ${foundStats ? `
          <text 
            x="0" 
            y="110" 
            font-family="Roboto" 
            font-size="28" 
            font-weight="500"
            text-anchor="start"
            opacity="0.8"
            fill="#aaaaaa">
            ${playerStats.points > 0 ? `${playerStats.points} PTS` : ''}${playerStats.points > 0 && (playerStats.rebounds > 0 || playerStats.assists > 0) ? ' • ' : ''}
            ${playerStats.rebounds > 0 ? `${playerStats.rebounds} REB` : ''}${playerStats.rebounds > 0 && playerStats.assists > 0 ? ' • ' : ''}
            ${playerStats.assists > 0 ? `${playerStats.assists} AST` : ''}${playerStats.assists > 0 && (playerStats.steals > 0 || playerStats.blocks > 0) ? ' • ' : ''}
            ${playerStats.steals > 0 ? `${playerStats.steals} STL` : ''}${playerStats.steals > 0 && playerStats.blocks > 0 ? ' • ' : ''}
            ${playerStats.blocks > 0 ? `${playerStats.blocks} BLK` : ''}
          </text>
        ` : ''}
      
        <!-- Date and team logos - horizontal layout aligned with avatar center -->
      ${awayTeam && homeTeam ? `
          <!-- Position relative to right side group: avatar center is at height/2 + 25 = 340, 
               right side group starts at height/2 - 140 = 175, 
               so date badge center should be at 340 - 175 = 165 relative to right side group.
               Date badge is 130px tall, so its top should be at 165 - 65 = 100, then add 20px = 120 -->
          <g transform="translate(0, 120)">
            <!-- Date badge - BIGGER to match logo size -->
          ${dateStr ? `
            <rect 
              x="0" 
              y="0" 
                width="140" 
                height="130" 
                rx="12" 
              fill="rgba(255,255,255,0.15)" 
              stroke="#ffffff" 
                stroke-width="3"
              filter="url(#shadow)"
              opacity="0.9"/>
            <text 
                x="70" 
                y="75" 
                font-family="Roboto" 
                font-size="48" 
                font-weight="700"
              text-anchor="middle"
              fill="#ffffff">${dateStr}</text>
          ` : ''}
          
            <!-- Team logos side by side - BIG, horizontal -->
            <g transform="translate(${dateStr ? 160 : 0}, 0)">
            ${awayLogoBase64 && awayTeam ? `
              <g transform="translate(0, 0)">
                  <circle cx="70" cy="65" r="65" fill="${getTeamPrimaryColor(awayTeam)}" stroke="#000" stroke-width="4" filter="url(#shadow)"/>
                <image 
                  href="${awayLogoBase64}" 
                    x="20" 
                  y="15" 
                    width="100" 
                    height="100" 
                  preserveAspectRatio="xMidYMid meet"
                  opacity="0.95"/>
              </g>
            ` : ''}
            
            ${homeLogoBase64 && homeTeam ? `
                <g transform="translate(190, 0)">
                  <circle cx="70" cy="65" r="65" fill="${getTeamPrimaryColor(homeTeam)}" stroke="#000" stroke-width="4" filter="url(#shadow)"/>
                <image 
                  href="${homeLogoBase64}" 
                    x="20" 
                  y="15" 
                    width="100" 
                    height="100" 
                  preserveAspectRatio="xMidYMid meet"
                  opacity="0.95"/>
              </g>
            ` : ''}
            </g>
            </g>
          ` : ''}
        </g>
      
      <!-- HoopGeek branding (bottom right) - white text -->
      <text 
        x="${width - 40}" 
        y="${height - 30}" 
        font-family="Roboto" 
        font-size="28" 
        text-anchor="end"
        fill="#ffffff"
        opacity="0.7">HoopGeek</text>`
      
  } else {
    // Fallback for posts without team or player data
    svg += `
      <rect width="${width}" height="${height}" fill="url(#fallbackBg)"/>
      <text 
        x="${width/2}" 
        y="${height/2}" 
        class="team-text" 
        font-size="64" 
        text-anchor="middle"
        font-weight="700">${escapeHtml(post.title || post.share_title || 'NBA Highlights')}</text>
      <text 
        x="${width - 40}" 
        y="${height - 30}" 
        font-family="Roboto" 
        font-size="28" 
        text-anchor="end"
        fill="#999">HoopGeek</text>`
  }
  
  svg += `</svg>`
  return svg
}

// Generate DFS Pool OG Image SVG (similar to feed posts but for pools)
async function generateDFSPoolOGImageSVG(pool, env) {
  const width = 1200, height = 630
  
  // Format entry fee
  const entryFee = pool.entry_fee === 0 ? 'FREE' : `$${parseFloat(pool.entry_fee).toFixed(2)}`
  
  // Format prize pool
  const prizePool = pool.prize_pool ? `$${parseFloat(pool.prize_pool).toLocaleString()}` : 'TBD'
  
  // Format entries
  const entries = pool.current_entries || 0
  const maxEntries = pool.max_entries ? pool.max_entries.toString() : '∞'
  
  // Format lock time
  let lockTimeStr = ''
  if (pool.lock_time) {
    try {
      const lockDate = new Date(pool.lock_time)
      lockTimeStr = lockDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch (e) {
      console.warn('[Worker] Error formatting lock time:', e)
    }
  }
  
  // Get difficulty tier color (fallback)
  const difficultyColors = {
    'elite': '#FF6B6B',
    'pro': '#4ECDC4',
    'standard': '#45B7D1',
  }
  const defaultDifficultyColor = difficultyColors[pool.difficulty_tier?.toLowerCase() || 'standard'] || '#45B7D1'
  
  // Use pool's custom colors if available, otherwise fall back to difficulty tier
  const primaryColor = pool.html_color_primary || defaultDifficultyColor
  const secondaryColor = pool.html_color_secondary || '#000000'
  const accentColor = primaryColor
  
  // Fetch pool games to get all matchups
  let matchups = []
  const teamLogos = {}
  if (pool.id) {
    try {
      const gamesResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/dfs_pool_games?pool_id=eq.${pool.id}&select=home_team,away_team&order=home_team`,
        {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (gamesResponse.ok) {
        const games = await gamesResponse.json()
        matchups = games
          .filter(game => game.home_team && game.away_team)
          .map(game => ({
            home: game.home_team,
            away: game.away_team
          }))
        
        // Fetch logos for all teams
        const allTeams = new Set()
        matchups.forEach(matchup => {
          allTeams.add(matchup.home)
          allTeams.add(matchup.away)
        })
        
        for (const team of allTeams) {
          const logoUrl = getTeamLogoUrl(team)
          teamLogos[team] = await fetchImageAsBase64(logoUrl)
        }
      }
    } catch (e) {
      console.warn('[Worker] Error fetching pool games:', e)
    }
  }
  
  // Format salary cap
  const formatSalaryCap = (cap) => {
    if (!cap) return 'N/A'
    const millions = cap / 1000000
    if (millions >= 100) {
      return `$${millions.toFixed(1)}M`
    }
    return `$${millions.toFixed(2)}M`
  }
  
  const salaryCapFormatted = formatSalaryCap(pool.salary_cap)
  
  // Format roster configuration
  const rosterConfig = pool.starters_count && pool.rotation_count && pool.bench_count
    ? `${pool.starters_count} Starters • ${pool.rotation_count} Rotation • ${pool.bench_count} Bench`
    : pool.roster_size
    ? `${pool.roster_size} Players`
    : 'Standard Roster'
  
  // Build SVG (similar style to feed posts but DFS-themed)
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <style>
        @font-face {
          font-family: 'Roboto';
          font-style: normal;
          font-weight: 400;
          src: url('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf') format('truetype');
        }
        @font-face {
          font-family: 'Roboto';
          font-style: normal;
          font-weight: 700;
          src: url('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf') format('truetype');
        }
        .title-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 700; fill: white; }
        .subtitle-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.9); }
        .value-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 700; fill: #FFC72C; }
        .label-text { font-family: 'Roboto', Arial, sans-serif; font-weight: 500; fill: rgba(255,255,255,0.7); }
      </style>
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.3"/>
      </filter>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="difficultyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.8" />
        <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0.6" />
      </linearGradient>
    </defs>
    
    <!-- Background -->
    <rect x="0" y="0" width="${width}" height="${height}" fill="#000000"/>
    
    <!-- Difficulty tier accent bar (top) -->
    <rect x="0" y="0" width="${width}" height="12" fill="url(#difficultyGradient)"/>
    
    <!-- Pool Icon (if available) -->
    ${pool.icon_name ? `
      <g transform="translate(80, 60)">
        <circle 
          cx="40" 
          cy="40" 
          r="40" 
          fill="${primaryColor}" 
          stroke="${secondaryColor}" 
          stroke-width="3"
          filter="url(#shadow)"
          opacity="0.9"/>
        <text 
          x="40" 
          y="50" 
          class="title-text" 
          font-size="32" 
          font-weight="700"
          text-anchor="middle"
          fill="${secondaryColor}">${pool.icon_name.charAt(2) || '🏀'}</text>
      </g>
    ` : ''}
    
    <!-- Pool Name / Title -->
    <text 
      x="${pool.icon_name ? '160' : '80'}" 
      y="100" 
      class="title-text" 
      font-size="72" 
      font-weight="700"
      text-anchor="start"
      filter="url(#shadow)">${escapeHtml(pool.name || pool.pool_name || 'DFS Contest')}</text>
    
    <!-- Team matchups (far right, 2 columns, all the way to bottom) -->
    ${matchups.length > 0 ? `
      <g transform="translate(${width - 200}, 120)">
        ${matchups.slice(0, 15).map((matchup, index) => {
          const logoSize = 35
          const matchupSpacing = 40
          const column = index % 2 // 0 or 1
          const row = Math.floor(index / 2) // Row within the column
          const y = row * matchupSpacing
          const x = column * 110 // Two columns, tighter spacing
          const logoBase64Away = teamLogos[matchup.away]
          const logoBase64Home = teamLogos[matchup.home]
          
          return `
            <g transform="translate(${x}, ${y})">
              <!-- Away team -->
              <g transform="translate(0, 0)">
                ${logoBase64Away ? `
                  <image 
                    href="${logoBase64Away}" 
                    x="0" 
                    y="0" 
                    width="${logoSize}" 
                    height="${logoSize}" 
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#shadow)"
                    opacity="0.9"/>
                ` : `
                  <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="${getTeamPrimaryColor(matchup.away)}" opacity="0.7"/>
                  <text x="${logoSize/2}" y="${logoSize/2 + 4}" class="subtitle-text" font-size="11" text-anchor="middle" fill="white">${matchup.away}</text>
                `}
              </g>
              
              <!-- VS text -->
              <text x="${logoSize + 5}" y="${logoSize/2 + 5}" class="label-text" font-size="12" text-anchor="middle" opacity="0.6">vs</text>
              
              <!-- Home team -->
              <g transform="translate(${logoSize + 22}, 0)">
                ${logoBase64Home ? `
                  <image 
                    href="${logoBase64Home}" 
                    x="0" 
                    y="0" 
                    width="${logoSize}" 
                    height="${logoSize}" 
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#shadow)"
                    opacity="0.9"/>
                ` : `
                  <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="${getTeamPrimaryColor(matchup.home)}" opacity="0.7"/>
                  <text x="${logoSize/2}" y="${logoSize/2 + 4}" class="subtitle-text" font-size="11" text-anchor="middle" fill="white">${matchup.home}</text>
                `}
              </g>
            </g>
          `
        }).join('')}
      </g>
    ` : ''}
    
    <!-- Main content area -->
    <g transform="translate(80, 180)">
      
      <!-- Entry Fee Badge -->
      <g transform="translate(0, 0)">
        <rect 
          x="0" 
          y="-35" 
          width="180" 
          height="70" 
          rx="12" 
          fill="#FFC72C" 
          stroke="#000" 
          stroke-width="3"
          filter="url(#shadow)"
          opacity="0.98"/>
        <text 
          x="90" 
          y="8" 
          class="value-text" 
          font-size="36" 
          font-weight="700"
          text-anchor="middle" 
          fill="#000">${entryFee}</text>
        <text 
          x="90" 
          y="-15" 
          class="label-text" 
          font-size="18" 
          text-anchor="middle" 
          fill="#000"
          opacity="0.8">Entry Fee</text>
      </g>
      
      <!-- Prize Pool -->
      <g transform="translate(220, 0)">
        <text 
          x="0" 
          y="0" 
          class="label-text" 
          font-size="24" 
          text-anchor="start">Prize Pool</text>
        <text 
          x="0" 
          y="35" 
          class="value-text" 
          font-size="48" 
          font-weight="700"
          text-anchor="start"
          filter="url(#shadow)">${prizePool}</text>
      </g>
      
      <!-- Games count -->
      ${pool.total_games ? `
        <g transform="translate(500, 0)">
          <text 
            x="0" 
            y="0" 
            class="label-text" 
            font-size="24" 
            text-anchor="start">Games</text>
          <text 
            x="0" 
            y="35" 
            class="value-text" 
            font-size="48" 
            font-weight="700"
            text-anchor="start"
            filter="url(#shadow)">${pool.total_games}</text>
        </g>
      ` : ''}
      
      <!-- Roster Configuration -->
      <g transform="translate(0, 100)">
        <text 
          x="0" 
          y="0" 
          class="label-text" 
          font-size="24" 
          text-anchor="start">Roster</text>
        <text 
          x="0" 
          y="35" 
          class="subtitle-text" 
          font-size="32" 
          font-weight="600"
          text-anchor="start"
          filter="url(#shadow)">${rosterConfig}</text>
      </g>
      
      <!-- Entries -->
      <g transform="translate(220, 100)">
        <text 
          x="0" 
          y="0" 
          class="label-text" 
          font-size="24" 
          text-anchor="start">Entries</text>
        <text 
          x="0" 
          y="35" 
          class="value-text" 
          font-size="48" 
          font-weight="700"
          text-anchor="start"
          filter="url(#shadow)">${entries}/${maxEntries}</text>
      </g>
      
      <!-- Salary Cap -->
      <g transform="translate(500, 100)">
        <text 
          x="0" 
          y="0" 
          class="label-text" 
          font-size="24" 
          text-anchor="start">Salary Cap</text>
        <text 
          x="0" 
          y="35" 
          class="value-text" 
          font-size="48" 
          font-weight="700"
          text-anchor="start"
          filter="url(#shadow)">${salaryCapFormatted}</text>
      </g>
      
      <!-- Difficulty Tier Badge -->
      <g transform="translate(500, 200)">
        <rect 
          x="0" 
          y="-20" 
          width="140" 
          height="40" 
          rx="8" 
          fill="${accentColor}" 
          stroke="#fff" 
          stroke-width="2"
          filter="url(#shadow)"
          opacity="0.9"/>
        <text 
          x="70" 
          y="8" 
          class="title-text" 
          font-size="22" 
          font-weight="700"
          text-anchor="middle">${(pool.difficulty_tier || 'standard').toUpperCase()}</text>
      </g>
      
      <!-- Lock Time -->
      ${lockTimeStr ? `
        <g transform="translate(0, 200)">
          <text 
            x="0" 
            y="0" 
            class="subtitle-text" 
            font-size="28" 
            text-anchor="start"
            filter="url(#shadow)">🔒 Locks ${lockTimeStr}</text>
        </g>
      ` : ''}
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
  
  return svg
}

export default {
  async fetch(request, env, ctx) {
    // Ensure ctx is available for cache operations
    if (!ctx) {
      ctx = {
        waitUntil: (promise) => promise,
      }
    }
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';
    
    // Handle /dfs-og-image/:poolId route (on-demand DFS pool OG image generation)
    const dfsOgImageMatch = url.pathname.match(/^\/dfs-og-image\/([^\/]+)$/)
    if (dfsOgImageMatch) {
      const poolId = dfsOgImageMatch[1].split('?')[0]
      
      const acceptHeader = request.headers.get('accept') || ''
      const isBot = userAgent.includes('AppleBot') ||
                    userAgent.includes('facebookexternalhit') ||
                    userAgent.includes('Twitterbot') ||
                    userAgent.includes('LinkedInBot') ||
                    userAgent.includes('WhatsApp') ||
                    userAgent.includes('Slackbot') ||
                    userAgent.includes('TelegramBot') ||
                    userAgent.includes('Discordbot') ||
                    userAgent.includes('SkypeUriPreview') ||
                    userAgent.includes('Pinterest') ||
                    userAgent.includes('Instagram') ||
                    userAgent.includes('Snapchat') ||
                    userAgent.includes('crawler') ||
                    url.searchParams.has('image')
      
      console.log(`[Worker] 🖼️ DFS OG Image route - Pool ID: ${poolId}`)
      
      if (!isBot && !acceptHeader.includes('image/')) {
        console.log(`[Worker] 🔄 DFS OG Image: Browser request detected, redirecting to pool: ${poolId}`)
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `/dfs/join/${poolId}`,
            'Cache-Control': 'public, max-age=300',
            'X-Robots-Tag': 'noindex'
          }
        })
      }
      
      console.log(`[Worker] 🖼️ DFS OG Image request - Pool ID: ${poolId}`)
      
      // Check cache
      const cache = caches.default
      const cacheKey = new Request(request.url, request)
      const cachedResponse = await cache.match(cacheKey)
      
      if (cachedResponse) {
        console.log(`[Worker] ✅ DFS OG Image: Serving from cache for pool: ${poolId}`)
        return cachedResponse
      }
      
      // Fetch pool data
      const pool = await fetchPoolDetails(poolId, env)
      if (!pool) {
        console.error(`[Worker] ❌ DFS OG Image: Pool not found: ${poolId}`)
        return new Response('Pool not found', { 
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      // FIRST: Try to fetch the OG image from Supabase storage (generated by Edge Function)
      if (pool.og_image_url) {
        console.log(`[Worker] 📥 DFS OG Image: Fetching from Supabase storage: ${pool.og_image_url}`)
        try {
          const storageResponse = await fetch(pool.og_image_url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Fetcher/1.0)'
            }
          })
          
          if (storageResponse.ok) {
            const imageData = await storageResponse.arrayBuffer()
            const contentType = storageResponse.headers.get('content-type') || 'image/svg+xml'
            
            console.log(`[Worker] ✅ DFS OG Image: Successfully fetched from storage (${contentType}, ${imageData.byteLength} bytes)`)
            
            // If it's SVG, convert to PNG (for better compatibility)
            if (contentType.includes('svg')) {
              const svgText = new TextDecoder().decode(imageData)
              console.log(`[Worker] 🔄 DFS OG Image: Converting SVG from storage to PNG`)
              
              // Convert SVG to PNG using resvg-wasm
              try {
                const { initWasm, Resvg } = await import('@resvg/resvg-wasm')
                const wasmModule = await import('@resvg/resvg-wasm/index_bg.wasm')
                await initWasm(wasmModule.default)
                
                // Fetch fonts
                const [fontRegularResponse, fontBoldResponse] = await Promise.all([
                  fetch('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf'),
                  fetch('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf'),
                ])
                
                const fontRegularBuffer = await fontRegularResponse.arrayBuffer()
                const fontBoldBuffer = await fontBoldResponse.arrayBuffer()
                const fontRegularBytes = new Uint8Array(fontRegularBuffer)
                const fontBoldBytes = new Uint8Array(fontBoldBuffer)
                
                // Initialize resvg and render to PNG
                const resvg = new Resvg(svgText, {
                  fitTo: {
                    mode: 'width',
                    value: 1200,
                  },
                  font: {
                    fontBuffers: [fontRegularBytes, fontBoldBytes],
                    defaultFontFamily: 'Roboto',
                    loadSystemFonts: false,
                  },
                })
                
                const png = resvg.render()
                const pngData = png.asPng()
                
                const pngResponse = new Response(pngData, {
                  headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 min cache for faster updates
                    'Access-Control-Allow-Origin': '*',
                    'X-Content-Type-Options': 'nosniff',
                  }
                })
                
                // Store in cache (shorter cache time so updates are reflected faster)
                ctx.waitUntil(cache.put(cacheKey, pngResponse.clone()))
                
                console.log(`[Worker] ✅ DFS OG Image: PNG converted and served from storage for pool: ${poolId}`)
                return pngResponse
              } catch (convertError) {
                console.warn(`[Worker] ⚠️ DFS OG Image: PNG conversion failed, serving SVG: ${convertError.message}`)
                // Fallback to SVG
                const svgResponse = new Response(svgText, {
                  headers: {
                    'Content-Type': 'image/svg+xml; charset=utf-8',
                    'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 min cache for faster updates
                    'Access-Control-Allow-Origin': '*',
                    'X-Content-Type-Options': 'nosniff',
                  }
                })
                ctx.waitUntil(cache.put(cacheKey, svgResponse.clone()))
                return svgResponse
              }
            } else {
              // Already PNG or other format, serve directly
              const imageResponse = new Response(imageData, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 min cache for faster updates
                  'Access-Control-Allow-Origin': '*',
                  'X-Content-Type-Options': 'nosniff',
                }
              })
              
              // Store in cache (shorter cache time so updates are reflected faster)
              ctx.waitUntil(cache.put(cacheKey, imageResponse.clone()))
              
              console.log(`[Worker] ✅ DFS OG Image: Served directly from storage for pool: ${poolId}`)
              return imageResponse
            }
          } else {
            console.warn(`[Worker] ⚠️ DFS OG Image: Storage fetch failed (${storageResponse.status}), falling back to generation`)
          }
        } catch (storageError) {
          console.warn(`[Worker] ⚠️ DFS OG Image: Error fetching from storage, falling back to generation: ${storageError.message}`)
        }
      } else {
        console.log(`[Worker] ℹ️ DFS OG Image: No og_image_url in pool, generating new image`)
      }
      
      // FALLBACK: Generate image using worker's internal function (only if storage image doesn't exist)
      console.log(`[Worker] ✅ DFS OG Image: Generating SVG for pool: ${poolId}`)
      const svg = await generateDFSPoolOGImageSVG(pool, env)
      console.log(`[Worker] ✅ DFS OG Image: SVG generated successfully, length: ${svg.length} chars`)
      
      // Convert SVG to PNG using resvg-wasm (same as feed posts)
      console.log(`[Worker] 🔄 DFS OG Image: Converting SVG to PNG for pool: ${poolId}`)
      let pngData
      try {
        const { initWasm, Resvg } = await import('@resvg/resvg-wasm')
        const wasmModule = await import('@resvg/resvg-wasm/index_bg.wasm')
        await initWasm(wasmModule.default)
        console.log(`[Worker] ✅ WASM initialized for DFS pool`)
        
        // Fetch fonts
        console.log(`[Worker] 📥 Fetching fonts for DFS pool...`)
        const [fontRegularResponse, fontBoldResponse] = await Promise.all([
          fetch('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf'),
          fetch('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf'),
        ])
        
        const fontRegularBuffer = await fontRegularResponse.arrayBuffer()
        const fontBoldBuffer = await fontBoldResponse.arrayBuffer()
        const fontRegularBytes = new Uint8Array(fontRegularBuffer)
        const fontBoldBytes = new Uint8Array(fontBoldBuffer)
        
        // Convert to base64
        let fontRegularBase64 = ''
        let fontBoldBase64 = ''
        const chunkSize = 8192
        for (let i = 0; i < fontRegularBytes.length; i += chunkSize) {
          const chunk = fontRegularBytes.slice(i, i + chunkSize)
          fontRegularBase64 += String.fromCharCode(...chunk)
        }
        for (let i = 0; i < fontBoldBytes.length; i += chunkSize) {
          const chunk = fontBoldBytes.slice(i, i + chunkSize)
          fontBoldBase64 += String.fromCharCode(...chunk)
        }
        fontRegularBase64 = btoa(fontRegularBase64)
        fontBoldBase64 = btoa(fontBoldBase64)
        
        // Embed fonts in SVG
        const svgWithFonts = svg
          .replace(
            "src: url('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf') format('truetype');",
            `src: url('data:application/font-sfnt;base64,${fontRegularBase64}') format('truetype');`
          )
          .replace(
            "src: url('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf') format('truetype');",
            `src: url('data:application/font-sfnt;base64,${fontBoldBase64}') format('truetype');`
          )
        
        // Initialize resvg and render to PNG
        const resvg = new Resvg(svg, {
          fitTo: {
            mode: 'width',
            value: 1200,
          },
          font: {
            fontBuffers: [fontRegularBytes, fontBoldBytes],
            defaultFontFamily: 'Roboto',
            loadSystemFonts: false,
          },
        })
        
        const png = resvg.render()
        pngData = png.asPng()
        
        console.log(`[Worker] ✅ DFS OG Image: PNG conversion successful, size: ${pngData.length} bytes`)
      } catch (error) {
        console.error(`[Worker] ❌ DFS OG Image PNG conversion error: ${error.message}`)
        // Fallback to SVG
        return new Response(svg, {
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
          }
        })
      }
      
      // Create PNG response with caching
      const pngResponse = new Response(pngData, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        }
      })
      
      // Store in cache
      ctx.waitUntil(cache.put(cacheKey, pngResponse.clone()))
      
      console.log(`[Worker] ✅ DFS OG Image: PNG served and cached for pool: ${poolId}`)
      return pngResponse
    }
    
    // Handle /player-og-image/:playerId route (on-demand player page OG image generation)
    // This route serves the OG image for bots/previews, but redirects browsers to the actual player page
    const playerOgImageMatch = url.pathname.match(/^\/player-og-image\/([^\/]+)$/)
    if (playerOgImageMatch) {
      const playerId = playerOgImageMatch[1].split('?')[0] // Remove query params
      
      // Check if this is a bot/image request or a browser request
      const acceptHeader = request.headers.get('accept') || ''
      
      // Detect bots more specifically - only these should get the image
      const isBot = userAgent.includes('AppleBot') ||
                    userAgent.includes('facebookexternalhit') ||
                    userAgent.includes('Twitterbot') ||
                    userAgent.includes('LinkedInBot') ||
                    userAgent.includes('WhatsApp') ||
                    userAgent.includes('Slackbot') ||
                    userAgent.includes('TelegramBot') ||
                    userAgent.includes('Discordbot') ||
                    userAgent.includes('SkypeUriPreview') ||
                    userAgent.includes('Pinterest') ||
                    userAgent.includes('Instagram') ||
                    userAgent.includes('Snapchat') ||
                    userAgent.includes('crawler') ||
                    url.searchParams.has('image') // Force image mode with ?image query param
      
      console.log(`[Worker] 🖼️ Player OG Image route - Player ID: ${playerId}`)
      
      // For player-og-image route: ONLY serve image to bots/image requests
      // Browsers should never land here - they should be on the player page URL
      if (!isBot && !acceptHeader.includes('image/')) {
        console.log(`[Worker] 🔄 Player OG Image: Browser request detected, redirecting to player page: ${playerId}`)
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `/player/${playerId}`,
            'Cache-Control': 'public, max-age=300',
            'X-Robots-Tag': 'noindex'
          }
        })
      }
      
      // If we get here, it's a bot or explicit image request
      // For og:image compatibility (iMessage, etc.), we need PNG, not SVG
      console.log(`[Worker] 🖼️ Player OG Image request - Player ID: ${playerId}`)
      
      // Check cache first
      const cache = caches.default
      const cacheKey = new Request(request.url, request)
      const cachedResponse = await cache.match(cacheKey)
      
      if (cachedResponse) {
        console.log(`[Worker] ✅ Player OG Image: Serving from cache for player: ${playerId}`)
        return cachedResponse
      }
      
      // Fetch player details
      const player = await fetchPlayerDetails(playerId, env)
      if (!player) {
        console.error(`[Worker] ❌ Player OG Image: Player not found: ${playerId}`)
        return new Response('Player not found', { 
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      // Try to fetch the SVG from Supabase storage
      const supabaseUrl = env.SUPABASE_URL || ''
      const svgUrl = `${supabaseUrl}/storage/v1/object/public/og-images/player-pages/${playerId}.svg`
      
      console.log(`[Worker] 📥 Player OG Image: Fetching SVG from storage: ${svgUrl}`)
      let svg = null
      try {
        const svgResponse = await fetch(svgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Fetcher/1.0)'
          }
        })
        
        if (svgResponse.ok) {
          svg = await svgResponse.text()
          console.log(`[Worker] ✅ Player OG Image: SVG fetched successfully, length: ${svg.length} chars`)
        } else {
          console.warn(`[Worker] ⚠️ Player OG Image: SVG fetch failed (${svgResponse.status}), generating new image`)
          // Try to generate by calling edge function
          const supabaseAnonKey = env.SUPABASE_ANON_KEY || ''
          const ogImageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-og-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ player_id: playerId }),
          })
          
          if (ogImageResponse.ok) {
            // Try fetching again after generation
            const retryResponse = await fetch(svgUrl)
            if (retryResponse.ok) {
              svg = await retryResponse.text()
              console.log(`[Worker] ✅ Player OG Image: SVG fetched after generation`)
            }
          }
        }
      } catch (error) {
        console.warn(`[Worker] ⚠️ Player OG Image: Error fetching SVG: ${error.message}`)
      }
      
      if (!svg) {
        console.error(`[Worker] ❌ Player OG Image: Could not fetch or generate SVG for player: ${playerId}`)
        return new Response('OG image not available', { 
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      // Convert SVG to PNG using resvg-wasm (same as feed posts)
      console.log(`[Worker] 🔄 Player OG Image: Converting SVG to PNG for player: ${playerId}`)
      let pngData
      try {
        const { initWasm, Resvg } = await import('@resvg/resvg-wasm')
        const wasmModule = await import('@resvg/resvg-wasm/index_bg.wasm')
        await initWasm(wasmModule.default)
        console.log(`[Worker] ✅ WASM initialized for player OG image`)
        
        // Fetch fonts
        const [fontRegularResponse, fontBoldResponse] = await Promise.all([
          fetch('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf'),
          fetch('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf'),
        ])
        
        const fontRegularBuffer = await fontRegularResponse.arrayBuffer()
        const fontBoldBuffer = await fontBoldResponse.arrayBuffer()
        const fontRegularBytes = new Uint8Array(fontRegularBuffer)
        const fontBoldBytes = new Uint8Array(fontBoldBuffer)
        
        // Initialize resvg with fonts
        const resvg = new Resvg(svg, {
          fitTo: {
            mode: 'width',
            value: 1200,
          },
          font: {
            fontBuffers: [fontRegularBytes, fontBoldBytes],
            defaultFontFamily: 'Roboto',
            loadSystemFonts: false,
          },
        })
        
        // Render to PNG
        const png = resvg.render()
        pngData = png.asPng()
        
        console.log(`[Worker] ✅ Player OG Image: PNG conversion successful, size: ${pngData.length} bytes`)
      } catch (error) {
        console.error(`[Worker] ❌ Player OG Image: PNG conversion error: ${error.message}`)
        // Fallback to SVG if PNG conversion fails
        console.log(`[Worker] ⚠️ Falling back to SVG`)
        return new Response(svg, {
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
          }
        })
      }
      
      // Create PNG response with caching
      const pngResponse = new Response(pngData, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        }
      })
      
      // Store in cache for future requests
      ctx.waitUntil(cache.put(cacheKey, pngResponse.clone()))
      
      console.log(`[Worker] ✅ Player OG Image: PNG served and cached for player: ${playerId}`)
      return pngResponse
    }
    
    // Handle /og-image/:postId route (on-demand OG image generation)
    // This route serves the OG image for bots/previews, but redirects browsers to the actual post
    const ogImageMatch = url.pathname.match(/^\/og-image\/([^\/]+)$/)
    if (ogImageMatch) {
      const postId = ogImageMatch[1].split('?')[0] // Remove query params
      
      // Check if this is a bot/image request or a browser request
      // Browsers will have Accept header with text/html, bots will have image/* or specific bot user agents
      const acceptHeader = request.headers.get('accept') || ''
      
      // Detect bots more specifically - only these should get the image
      const isBot = userAgent.includes('AppleBot') ||
                    userAgent.includes('facebookexternalhit') ||
                    userAgent.includes('Twitterbot') ||
                    userAgent.includes('LinkedInBot') ||
                    userAgent.includes('WhatsApp') ||
                    userAgent.includes('Slackbot') ||
                    userAgent.includes('TelegramBot') ||
                    userAgent.includes('Discordbot') ||
                    userAgent.includes('SkypeUriPreview') ||
                    userAgent.includes('Pinterest') ||
                    userAgent.includes('Instagram') ||
                    userAgent.includes('Snapchat') ||
                    userAgent.includes('crawler') ||
                    url.searchParams.has('image') // Force image mode with ?image query param
      
      // Log for debugging
      console.log(`[Worker] 🖼️ OG Image route - Post ID: ${postId}`)
      console.log(`[Worker] UserAgent: ${userAgent.substring(0, 150)}`)
      console.log(`[Worker] Accept: ${acceptHeader}`)
      console.log(`[Worker] Is Bot: ${isBot}`)
      
      // For og-image route: ONLY serve image to bots/image requests
      // Browsers should never land here - they should be on the post URL
      // But if they do, redirect them to the post
      // iMessage will fetch this URL for the thumbnail when it sees og:image meta tag
      if (!isBot && !acceptHeader.includes('image/')) {
        console.log(`[Worker] 🔄 OG Image: Browser request detected, redirecting to post: ${postId}`)
        // Use 302 redirect - this happens before any content loads
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `/${postId}`,
            'Cache-Control': 'public, max-age=300',
            'X-Robots-Tag': 'noindex'
          }
        })
      }
      
      // If we get here, it's a bot or explicit image request
      // For og:image compatibility (iMessage, etc.), we need PNG, not SVG
      console.log(`[Worker] 🖼️ OG Image request - Post ID: ${postId}, UserAgent: ${userAgent.substring(0, 100)}`)
      
      // Check cache first (Cloudflare Cache API)
      const cache = caches.default
      const cacheKey = new Request(request.url, request)
      const cachedResponse = await cache.match(cacheKey)
      
      if (cachedResponse) {
        console.log(`[Worker] ✅ OG Image: Serving from cache for post: ${postId}`)
        return cachedResponse
      }
      
      const post = await fetchFeedPost(postId, env)
      if (!post) {
        console.error(`[Worker] ❌ OG Image: Post not found: ${postId}`)
        return new Response('Post not found', { 
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      console.log(`[Worker] ✅ OG Image: Generating SVG for post: ${postId}`)
      const svg = await generateOGImageSVG(post, env)
      console.log(`[Worker] ✅ OG Image: SVG generated successfully, length: ${svg.length} chars`)
      
      // Convert SVG to PNG using resvg-js (WASM-based)
      console.log(`[Worker] 🔄 OG Image: Converting SVG to PNG for post: ${postId}`)
      let pngData
      try {
        // Import resvg-js - works in Cloudflare Workers
        const { initWasm, Resvg } = await import('@resvg/resvg-wasm')
        
        // Import WASM module directly (ES module syntax for Cloudflare Workers)
        const wasmModule = await import('@resvg/resvg-wasm/index_bg.wasm')
        
        // Initialize WASM module with the imported module
        await initWasm(wasmModule.default)
        console.log(`[Worker] ✅ WASM initialized`)
        
        // Fetch font files and embed as base64 data URIs in SVG
        // resvg-wasm needs fonts embedded directly in SVG @font-face
        console.log(`[Worker] 📥 Fetching fonts...`)
        const [fontRegularResponse, fontBoldResponse] = await Promise.all([
          fetch('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf'),
          fetch('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf'),
        ])
        
        const fontRegularBuffer = await fontRegularResponse.arrayBuffer()
        const fontBoldBuffer = await fontBoldResponse.arrayBuffer()
        
        const fontRegularBytes = new Uint8Array(fontRegularBuffer)
        const fontBoldBytes = new Uint8Array(fontBoldBuffer)
        
        // Convert to base64 efficiently (chunked to avoid memory issues)
        let fontRegularBase64 = ''
        let fontBoldBase64 = ''
        const chunkSize = 8192
        for (let i = 0; i < fontRegularBytes.length; i += chunkSize) {
          const chunk = fontRegularBytes.slice(i, i + chunkSize)
          fontRegularBase64 += String.fromCharCode(...chunk)
        }
        for (let i = 0; i < fontBoldBytes.length; i += chunkSize) {
          const chunk = fontBoldBytes.slice(i, i + chunkSize)
          fontBoldBase64 += String.fromCharCode(...chunk)
        }
        fontRegularBase64 = btoa(fontRegularBase64)
        fontBoldBase64 = btoa(fontBoldBase64)
        
        console.log(`[Worker] ✅ Fonts converted to base64: Regular ${fontRegularBase64.length} chars, Bold ${fontBoldBase64.length} chars`)
        
        // Embed fonts as base64 data URIs in SVG @font-face with correct MIME type
        const svgWithFonts = svg
          .replace(
            "src: url('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf') format('truetype');",
            `src: url('data:application/font-sfnt;base64,${fontRegularBase64}') format('truetype');`
          )
          .replace(
            "src: url('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf') format('truetype');",
            `src: url('data:application/font-sfnt;base64,${fontBoldBase64}') format('truetype');`
          )
        
        console.log(`[Worker] ✅ Fonts embedded in SVG as base64 data URIs`)
        
        // Initialize resvg with fonts loaded via fontBuffers option
        // Based on TypeScript API: CustomFontsOptions.fontBuffers is Uint8Array[]
        const resvg = new Resvg(svg, {
          fitTo: {
            mode: 'width',
            value: 1200,
          },
          font: {
            fontBuffers: [fontRegularBytes, fontBoldBytes], // Array of Uint8Array font buffers
            defaultFontFamily: 'Roboto',
            loadSystemFonts: false,
          },
        })
        
        console.log(`[Worker] ✅ Resvg initialized with fonts loaded via fontBuffers`)
        
        // Render to PNG
        const png = resvg.render()
        pngData = png.asPng()
        
        console.log(`[Worker] ✅ OG Image: PNG conversion successful, size: ${pngData.length} bytes`)
      } catch (error) {
        console.error(`[Worker] ❌ PNG conversion error: ${error.message}`)
        console.error(`[Worker] Error stack: ${error.stack}`)
        // Fallback to SVG if PNG conversion fails
        console.log(`[Worker] ⚠️ Falling back to SVG`)
      return new Response(svg, {
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
          }
        })
      }
      
      // Create PNG response with aggressive caching
      const pngResponse = new Response(pngData, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        }
      })
      
      // Store in cache for future requests
      ctx.waitUntil(cache.put(cacheKey, pngResponse.clone()))
      
      console.log(`[Worker] ✅ OG Image: PNG served and cached for post: ${postId}`)
      return pngResponse
    }
    
    // Debug logging
    console.log(`[Worker] Request: ${url.pathname}, UserAgent: ${userAgent}`);
    console.log(`[Worker] Full URL: ${url.toString()}`);
    
    // Check if this is a social media bot
    const isBot = isSocialMediaBot(userAgent);
    console.log(`[Worker] Is bot: ${isBot}`);
    
    // Check if URL matches player page pattern
    const playerPageMatch = url.pathname.match(/^\/player\/([a-f0-9-]+)$/i);
    console.log(`[Worker] Player page match: ${playerPageMatch ? playerPageMatch[1] : 'none'}`);
    
    // Check if URL matches DFS pool join pattern
    // Also check for UUID format (8-4-4-4-12 hex with dashes)
    const dfsJoinMatch = url.pathname.match(/^\/dfs\/join\/([a-f0-9-]+)$/i);
    console.log(`[Worker] DFS join match: ${dfsJoinMatch ? dfsJoinMatch[1] : 'none'}`);
    console.log(`[Worker] Pathname being checked: "${url.pathname}"`);
    
    // If it's a bot and we're on root but there's a query param or we should check referrer
    if (isBot && url.pathname === '/' && !dfsJoinMatch) {
      console.log(`[Worker] ⚠️ Bot on root path, checking if this is a DFS pool request...`);
      // Check if there's a referrer or if we should handle root differently
    }
    
    // Always inject meta tags for player page URLs (needed for iMessage link previews)
    // iMessage doesn't always identify as a bot, so we inject for all requests to player page URLs
    // Handle player page URLs FIRST (before feed post matching)
    // This ensures player pages are handled correctly
    if (playerPageMatch) {
      const playerId = playerPageMatch[1];
      
      console.log(`[Worker] ========== PLAYER PAGE REQUEST ==========`);
      console.log(`[Worker] Player ID: ${playerId}`);
      console.log(`[Worker] Pathname: ${url.pathname}`);
      console.log(`[Worker] UserAgent: ${userAgent}`);
      console.log(`[Worker] Request URL: ${request.url}`);
      
      // Fetch the original HTML from the origin
      const originRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
      });
      
      const response = await fetch(originRequest);
      console.log(`[Worker] Origin response status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`[Worker] Origin response not OK, returning original response`);
        return response;
      }
      
      // Fetch player details
      console.log(`[Worker] Fetching player from Supabase...`);
      const player = await fetchPlayerDetails(playerId, env);
      
      if (player) {
        console.log(`[Worker] Player found! Name: ${player.name || 'N/A'}`);
        
        // Try to generate/ensure OG image exists by calling the Edge Function
        // We call this to ensure the SVG exists in storage, but we'll use the /player-og-image route for the meta tag
        try {
          const supabaseUrl = env.SUPABASE_URL || '';
          const supabaseAnonKey = env.SUPABASE_ANON_KEY || '';
          
          // Call the generate-og-image Edge Function to ensure image exists/updated
          const ogImageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-og-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ player_id: playerId }),
          });
          
          if (ogImageResponse.ok) {
            const ogImageData = await ogImageResponse.json();
            if (ogImageData.og_image_url) {
              console.log(`[Worker] ✅ Player page OG image ready in storage: ${ogImageData.og_image_url}`);
            } else {
              console.log(`[Worker] ✅ Player page OG image generated (no URL returned)`);
            }
          } else {
            const errorText = await ogImageResponse.text();
            console.warn(`[Worker] ⚠️ Could not generate OG image for player ${playerId}: ${ogImageResponse.status} - ${errorText}`);
          }
        } catch (ogImageError) {
          console.warn(`[Worker] ⚠️ Error generating OG image:`, ogImageError);
          // Continue - we'll still use the /player-og-image route which will handle missing images
        }
        
        // Generate custom meta tags - pass null so it uses the /player-og-image/:playerId route (PNG)
        // This route converts SVG to PNG on-demand for iMessage compatibility
        const metaTags = generatePlayerPageMetaTags(player, request.url, playerId, env, null);
        console.log(`[Worker] ✅ Generated meta tags (length: ${metaTags.length} chars)`);
        
        // Log the image URL for debugging (same as feed posts)
        const imageUrlMatch = metaTags.match(/og:image" content="([^"]+)"/);
        if (imageUrlMatch) {
          console.log(`[Worker] OG Image URL: ${imageUrlMatch[1]}`);
        } else {
          console.error(`[Worker] ERROR: Could not extract og:image URL from meta tags!`);
        }
        
        // Get the HTML and inject meta tags
        const html = await response.text();
        console.log(`[Worker] HTML length: ${html.length} chars`);
        const modifiedHtml = injectMetaTags(html, metaTags);
        console.log(`[Worker] Modified HTML length: ${modifiedHtml.length} chars`);
        
        // Verify injection worked
        const ogImageCheck = modifiedHtml.match(/<meta\s+property=["']og:image["'][^>]*>/i);
        if (ogImageCheck) {
          console.log(`[Worker] ✅ Successfully injected og:image tag`);
          console.log(`[Worker] OG Image tag: ${ogImageCheck[0].substring(0, 100)}...`);
        } else {
          console.error(`[Worker] ❌ WARNING: og:image tag not found in modified HTML!`);
        }
        
        console.log(`[Worker] ==========================================`);
        
        // Return modified HTML
        return new Response(modifiedHtml, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers),
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
          }
        });
      } else {
        console.error(`[Worker] ❌ Player not found in database: ${playerId}`);
        console.error(`[Worker] Returning original HTML without meta tag injection`);
        console.log(`[Worker] ==========================================`);
        // IMPORTANT: Return the original response if player not found
        // This prevents falling through to other handlers
        return response;
      }
    }
    
    // Check if URL matches feed post UUID pattern (/:uuid)
    // UUID format: 8-4-4-4-12 hex digits with dashes
    const feedPostMatch = url.pathname.match(/^\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
    console.log(`[Worker] Feed post match: ${feedPostMatch ? feedPostMatch[1] : 'none'}`);
    
    // Always inject meta tags for feed post URLs (needed for iMessage link previews)
    // iMessage doesn't always identify as a bot, so we inject for all requests to feed post URLs
    if (feedPostMatch) {
      const postId = feedPostMatch[1];
      
      console.log(`[Worker] ========== FEED POST REQUEST ==========`);
      console.log(`[Worker] Post ID: ${postId}`);
      console.log(`[Worker] Pathname: ${url.pathname}`);
      console.log(`[Worker] UserAgent: ${userAgent}`);
      console.log(`[Worker] Request URL: ${request.url}`);
        
        // Fetch the original HTML from the origin
      // IMPORTANT: Use the original request but modify it to fetch from origin
      const originRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
      });
      
      const response = await fetch(originRequest);
      console.log(`[Worker] Origin response status: ${response.status}`);
        
        if (!response.ok) {
        console.log(`[Worker] Origin response not OK, returning original response`);
          return response;
        }
        
        // Fetch feed post details
      console.log(`[Worker] Fetching post from Supabase...`);
        const post = await fetchFeedPost(postId, env);
        
        if (post) {
        console.log(`[Worker] Post found! Title: ${post.title || post.share_title || 'N/A'}`);
        console.log(`[Worker] Post status: ${post.status}`);
        console.log(`[Worker] Post has metadata: ${!!post.metadata}`);
        
          // Generate custom meta tags that parallel the avatar bar
          const metaTags = generateFeedPostMetaTags(post, request.url);
          
          // Log the image URL for debugging
          const imageUrlMatch = metaTags.match(/og:image" content="([^"]+)"/);
          if (imageUrlMatch) {
            console.log(`[Worker] OG Image URL: ${imageUrlMatch[1]}`);
        } else {
          console.error(`[Worker] ERROR: Could not extract og:image URL from meta tags!`);
          }
          
          // Get the HTML and inject meta tags
          const html = await response.text();
        console.log(`[Worker] HTML length: ${html.length} chars`);
        console.log(`[Worker] HTML contains <head>: ${html.includes('<head>')}`);
        console.log(`[Worker] HTML contains </head>: ${html.includes('</head>')}`);
        
          const modifiedHtml = injectMetaTags(html, metaTags);
        console.log(`[Worker] Modified HTML length: ${modifiedHtml.length} chars`);
        
        // Verify injection worked by checking for og:image in modified HTML
        const ogImageCheck = modifiedHtml.match(/<meta\s+property=["']og:image["'][^>]*>/i);
        if (ogImageCheck) {
          console.log(`[Worker] ✅ Successfully injected og:image tag`);
          console.log(`[Worker] OG Image tag: ${ogImageCheck[0].substring(0, 100)}...`);
        } else {
          console.error(`[Worker] ❌ WARNING: og:image tag not found in modified HTML!`);
        }
          
          // Return modified HTML
          return new Response(modifiedHtml, {
            status: response.status,
            statusText: response.statusText,
            headers: {
              ...Object.fromEntries(response.headers),
              'Content-Type': 'text/html;charset=UTF-8',
              'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            }
          });
      } else {
        console.error(`[Worker] ❌ Post not found in database: ${postId}`);
        console.error(`[Worker] Returning original HTML without meta tag injection`);
        }
      
      console.log(`[Worker] ==========================================`);
    }
    
    // If it's a bot requesting a DFS pool join link, inject custom meta tags
    if (isBot && dfsJoinMatch) {
      const poolId = dfsJoinMatch[1];
      
      console.log(`[Worker] ==========================================`);
      console.log(`[Worker] 🤖 Bot detected (${userAgent}) requesting DFS pool: ${poolId}`);
      console.log(`[Worker] URL: ${url.pathname}`);
      console.log(`[Worker] Full URL: ${url.toString()}`);
      
      // Fetch the original HTML from the origin
      const response = await fetch(request);
      
      if (!response.ok) {
        console.error(`[Worker] ❌ Origin response not OK: ${response.status}`);
        return response;
      }
      
      // Fetch pool details
      console.log(`[Worker] 📥 Fetching pool details for: ${poolId}`);
      const pool = await fetchPoolDetails(poolId, env);
      
      if (pool) {
        console.log(`[Worker] ✅ Pool found: ${pool.name || poolId}`);
        // Try to generate/ensure OG image exists by calling the Edge Function
        // This will create/update the image and return the storage URL
        try {
          const supabaseUrl = env.SUPABASE_URL || '';
          const supabaseAnonKey = env.SUPABASE_ANON_KEY || '';
          
          // Call the generate-og-image Edge Function to ensure image exists/updated
          const ogImageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-og-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ pool_id: poolId }),
          });
          
          if (ogImageResponse.ok) {
            const ogImageData = await ogImageResponse.json();
            // Update pool object with the latest og_image_url from Edge Function
            if (ogImageData.og_image_url) {
              pool.og_image_url = ogImageData.og_image_url;
              console.log(`[Worker] ✅ DFS pool OG image ready: ${ogImageData.og_image_url}`);
            } else {
              console.log(`[Worker] ✅ DFS pool OG image generated (no URL returned)`);
            }
          } else {
            const errorText = await ogImageResponse.text();
            console.warn(`[Worker] ⚠️ Could not generate OG image for pool ${poolId}: ${ogImageResponse.status} - ${errorText}`);
          }
        } catch (ogImageError) {
          console.warn(`[Worker] ⚠️ Error generating OG image:`, ogImageError);
          // Continue with fallback image
        }
        
        // Generate custom meta tags (will use generated OG image URL)
        const metaTags = generatePoolMetaTags(pool, request.url, poolId, env);
        console.log(`[Worker] ✅ Generated meta tags (length: ${metaTags.length} chars)`);
        
        // Get the HTML and inject meta tags
        const html = await response.text();
        const modifiedHtml = injectMetaTags(html, metaTags);
        
        // Verify meta tags were injected
        const ogImageCheck = modifiedHtml.match(/<meta\s+property=["']og:image["'][^>]*>/i);
        if (ogImageCheck) {
          console.log(`[Worker] ✅ OG Image tag injected: ${ogImageCheck[0].substring(0, 100)}...`);
        } else {
          console.error(`[Worker] ❌ WARNING: og:image tag not found in modified HTML!`);
        }
        
        console.log(`[Worker] ==========================================`);
        
        // Return modified HTML
        return new Response(modifiedHtml, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers),
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
          }
        });
      } else {
        console.error(`[Worker] ❌ Pool not found, returning original HTML`);
        console.log(`[Worker] ==========================================`);
      }
    }
    
    
    // For non-bot requests or non-matching URLs, pass through to origin
    return fetch(request);
  }
};

