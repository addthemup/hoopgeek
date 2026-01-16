# HoopGeek Meta Tag Injector

This Cloudflare Worker intercepts social media bot requests (iMessage, WhatsApp, Facebook, Twitter, etc.) and dynamically injects Open Graph meta tags for DFS pool share links and feed post shares, creating rich previews when shared.

## Features

- 🤖 Detects social media bots (iMessage, WhatsApp, Facebook, Twitter, LinkedIn, etc.)
- 🏀 Dynamically generates meta tags for DFS pool links
- 📱 Dynamically generates meta tags for feed post shares (parallels avatar bar display)
- 💰 Shows entry fee, prize pool, current entries, and lock time (DFS)
- 🏀 Shows teams, scores, dates, and fun scores (Feed Posts)
- ⚡ Caches responses for 5 minutes for performance
- 🔒 Secure - uses Supabase API to fetch data

## How It Works

### DFS Pool Shares
1. When someone shares a DFS pool link like `https://hoopgeek.app/dfs/join/abc-123`
2. Social media platforms send a bot to preview the link
3. This worker detects the bot, fetches pool data from Supabase
4. Injects custom Open Graph meta tags with contest details
5. Returns the modified HTML to the bot
6. The bot creates a rich preview with contest info

### Feed Post Shares
1. When someone shares a feed post link like `https://hoopgeek.app/4a5f412a-457b-4c82-aa47-a1f030a03274`
2. Social media platforms send a bot to preview the link
3. This worker detects the bot, fetches feed post data from Supabase
4. Injects custom Open Graph meta tags that parallel the avatar bar:
   - Team matchups (e.g., "Lakers vs Celtics")
   - Game scores
   - Game dates
   - Fun scores
   - Post descriptions
5. Returns the modified HTML to the bot
6. The bot creates a rich preview with game/post info

## Preview Examples

### DFS Pool Share
When shared, a DFS pool link will show:
- **Title**: "High Roller - $100 Contest - HoopGeek"
- **Description**: "Join this $10 DFS basketball contest! 💰 Prize Pool: $100 | 👥 8/10 entries | 5 NBA games | Locks Jan 15 at 7:00 PM"
- **Image**: Your DFS contest image

### Feed Post Share
When shared, a feed post link will show:
- **Title**: "[Post Title] - HoopGeek" (or uses share_title if set)
- **Description**: "Lakers vs Celtics | 120-115 | 11/15 | Fun Score: 95 | [Post Description]"
- **Image**: Post thumbnail or share_image_url if set

## Deployment Instructions

### Step 1: Install Dependencies

```bash
cd cloudflare-worker-meta-tags
npm install
```

### Step 2: Set Environment Variables

Set your Supabase credentials as secrets (they won't be visible in code):

```bash
# Set Supabase URL
npx wrangler secret put SUPABASE_URL
# Paste: https://your-project.supabase.co

# Set Supabase Anon Key
npx wrangler secret put SUPABASE_ANON_KEY
# Paste: your-supabase-anon-key
```

### Step 3: Update wrangler.toml

Update the `routes` section in `wrangler.toml` with your actual domain. The catch-all pattern is needed to handle UUID-based feed post routes:

```toml
[env.production]
routes = [
  { pattern = "your-domain.com/dfs/join/*", zone_name = "your-domain.com" },
  # Feed post routes - matches UUID pattern for shared posts
  # Note: The worker code will validate UUID format, this just catches potential matches
  { pattern = "your-domain.com/*", zone_name = "your-domain.com" }
]
```

### Step 4: Deploy to Cloudflare

```bash
npm run deploy
```

### Step 5: Test the Worker

#### Test DFS Pool Shares with a bot user agent:

```bash
curl -A "facebookexternalhit/1.0" https://hoopgeek.app/dfs/join/YOUR_POOL_ID
```

You should see the HTML with custom meta tags injected.

#### Test Feed Post Shares with a bot user agent:

```bash
curl -A "AppleBot" https://hoopgeek.app/YOUR_FEED_POST_UUID
```

You should see the HTML with custom meta tags that include team info, scores, and post description.

#### Test in iMessage:

**DFS Pool:**
1. Create a DFS pool or use an existing one
2. Click "Share" in the pool details
3. Copy the link
4. Send it in iMessage to yourself or a friend
5. You should see a rich preview with contest details!

**Feed Post:**
1. Find a feed post (or create one in admin)
2. Copy the post URL (format: `https://hoopgeek.app/{post-uuid}`)
3. Send it in iMessage to yourself or a friend
4. You should see a rich preview with team matchups, scores, dates, and post description!

## Monitoring

View real-time logs:

```bash
npm run tail
```

## How to Update

If you need to modify the meta tag format or add more data:

1. Edit `meta-injector.js`
2. Update the `generatePoolMetaTags()` function
3. Deploy: `npm run deploy`

## Supported Platforms

The worker detects and serves rich previews for:
- ✅ iMessage (Apple)
- ✅ WhatsApp
- ✅ Facebook Messenger
- ✅ Twitter/X
- ✅ LinkedIn
- ✅ Slack
- ✅ Discord
- ✅ Telegram
- ✅ Snapchat
- ✅ Instagram
- ✅ Pinterest

## Creating an OG Image

For the best previews, create a branded image at `public/dfs-og-image.jpg`:

**Recommended specs:**
- Size: 1200 x 630 pixels
- Format: JPG or PNG
- File size: < 1MB
- Content: Your HoopGeek logo + "Join Daily Fantasy Basketball Contest"

## Troubleshooting

### Meta tags not showing in preview

1. **Clear the cache**: Social platforms cache previews. Use their debug tools:
   - Facebook: https://developers.facebook.com/tools/debug/
   - Twitter: https://cards-dev.twitter.com/validator
   - LinkedIn: https://www.linkedin.com/post-inspector/

2. **Check if worker is deployed**: 
   ```bash
   npx wrangler deployments list
   ```

3. **View logs**:
   ```bash
   npm run tail
   ```

### Worker not intercepting requests

- Verify the route pattern matches your domain in `wrangler.toml`
- Check that your domain is added to your Cloudflare account
- Ensure the worker is deployed to the production environment

## Cost

Cloudflare Workers free tier includes:
- 100,000 requests per day
- More than enough for social media bot requests

## Security

- Uses Supabase's anon key (public key with RLS enabled)
- No sensitive data exposed
- Input sanitization prevents XSS attacks
- Caches responses to reduce database load

## Support

If you encounter issues:
1. Check the Cloudflare Workers dashboard for errors
2. Use `npm run tail` to see real-time logs
3. Test with different bot user agents
4. Verify your Supabase credentials are correct

---

Made with 🏀 by HoopGeek

