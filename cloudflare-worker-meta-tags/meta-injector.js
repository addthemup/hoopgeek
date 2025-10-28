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
  'AppleBot' // iMessage link preview
];

// Check if request is from a social media bot
function isSocialMediaBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

// Fetch pool details from Supabase
async function fetchPoolDetails(poolId, env) {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/dfs_todays_contests?pool_id=eq.${poolId}&select=*`,
      {
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch pool details:', response.status);
      return null;
    }

    const data = await response.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching pool details:', error);
    return null;
  }
}

// Generate Open Graph meta tags for a DFS pool
function generatePoolMetaTags(pool, url) {
  const title = `${pool.pool_name || 'DFS Contest'} - HoopGeek`;
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

  return `
    <!-- DFS Pool Specific Meta Tags -->
    <meta property="og:site_name" content="HoopGeek" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="https://hoopgeek.app/dfs-og-image.jpg" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="https://hoopgeek.app/dfs-og-image.jpg" />
    
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
  // Replace the default meta tags and title with pool-specific ones
  // Insert after the viewport meta tag
  const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
  const titleEndTag = '</title>';
  
  // Remove existing OG tags (between viewport and closing head tag)
  let modifiedHtml = html;
  
  // Find the position after viewport tag
  const viewportIndex = modifiedHtml.indexOf(viewportTag);
  if (viewportIndex !== -1) {
    const afterViewport = viewportIndex + viewportTag.length;
    const headClose = modifiedHtml.indexOf('</head>', afterViewport);
    
    if (headClose !== -1) {
      // Remove everything between viewport and </head> except the script tags
      const beforeMeta = modifiedHtml.substring(0, afterViewport);
      const afterHead = modifiedHtml.substring(headClose);
      
      // Insert new meta tags
      modifiedHtml = beforeMeta + '\n' + metaTags + '\n  ' + afterHead;
    }
  }
  
  return modifiedHtml;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';
    
    // Check if this is a social media bot
    const isBot = isSocialMediaBot(userAgent);
    
    // Check if URL matches DFS pool join pattern
    const dfsJoinMatch = url.pathname.match(/^\/dfs\/join\/([a-f0-9-]+)$/i);
    
    // If it's a bot requesting a DFS pool join link, inject custom meta tags
    if (isBot && dfsJoinMatch) {
      const poolId = dfsJoinMatch[1];
      
      console.log(`Bot detected (${userAgent}) requesting DFS pool: ${poolId}`);
      
      // Fetch the original HTML from the origin
      const response = await fetch(request);
      
      if (!response.ok) {
        return response;
      }
      
      // Fetch pool details
      const pool = await fetchPoolDetails(poolId, env);
      
      if (pool) {
        // Generate custom meta tags
        const metaTags = generatePoolMetaTags(pool, request.url);
        
        // Get the HTML and inject meta tags
        const html = await response.text();
        const modifiedHtml = injectMetaTags(html, metaTags);
        
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
      }
    }
    
    // For non-bot requests or non-DFS URLs, pass through to origin
    return fetch(request);
  }
};

