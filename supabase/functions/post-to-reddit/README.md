# Post to Reddit Edge Function

This Supabase Edge Function posts feed posts directly to Reddit using the Reddit API.

## Setup

### 1. Create Reddit App

1. Go to https://www.reddit.com/prefs/apps
2. Click "create another app..." or "create app"
3. Fill in:
   - **Name**: HoopGeek
   - **Type**: script
   - **Description**: Automated posting for HoopGeek feed posts
   - **About URL**: https://hoopgeek.app
   - **Redirect URI**: http://localhost:3000 (can be any valid URL)
4. Note your **client ID** (under the app name) and **secret** (the "secret" field)

### 2. Set Environment Variables

In Supabase Dashboard → Edge Functions → Settings, add these secrets:

- `REDDIT_CLIENT_ID` - Your Reddit app client ID
- `REDDIT_CLIENT_SECRET` - Your Reddit app secret
- `REDDIT_USERNAME` - Your Reddit username
- `REDDIT_PASSWORD` - Your Reddit account password
- `REDDIT_USER_AGENT` - User agent string (e.g., "HoopGeek/1.0 by YourUsername")
- `SITE_URL` - Your site URL (e.g., "https://hoopgeek.app")

### 3. Deploy the Function

```bash
cd /Users/adam/Desktop/hoopgeek
npx supabase functions deploy post-to-reddit
```

## Usage

The function is called from the admin content table when clicking the "Post to Reddit" button.

You can also call it manually:

```typescript
const { data, error } = await supabase.functions.invoke('post-to-reddit', {
  body: {
    post_id: 'post-uuid',
    subreddit: 'hoopgeek' // Optional, defaults to 'hoopgeek'
  }
})
```

## Response

```json
{
  "success": true,
  "reddit_post_id": "abc123",
  "reddit_post_url": "https://reddit.com/r/hoopgeek/comments/abc123/..."
}
```

## Notes

- The function uses Reddit's OAuth2 password flow (script app type)
- Posts are submitted as self-posts (text posts) with the post description and link
- The Reddit post ID and URL are stored in the feed post's metadata
- Make sure your Reddit account has permission to post to the specified subreddit

