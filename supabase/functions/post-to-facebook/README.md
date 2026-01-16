# Post to Facebook Edge Function

This Supabase Edge Function posts feed posts directly to a Facebook Page using the Facebook Graph API.

## Setup

### 1. Create Facebook App

1. Go to https://developers.facebook.com/apps/
2. Click "Create App"
3. Choose "Business" as the app type
4. Fill in app details and create the app

### 2. Get Page Access Token

1. In your Facebook App, go to "Tools" → "Graph API Explorer"
2. Select your app from the dropdown
3. Click "Generate Access Token"
4. Select these permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`
5. Generate a User Access Token
6. Exchange for a Page Access Token:
   - Go to: `https://graph.facebook.com/v18.0/me/accounts?access_token={USER_ACCESS_TOKEN}`
   - Find your page and get the `access_token` (this is your Page Access Token)
   - Note your Page ID

### 3. Set Environment Variables

In Supabase Dashboard → Edge Functions → Settings, add these secrets:

- `FACEBOOK_PAGE_ACCESS_TOKEN` - Your Facebook Page Access Token (long-lived)
- `FACEBOOK_PAGE_ID` - Your Facebook Page ID
- `SITE_URL` - Your site URL (e.g., "https://hoopgeek.app")

### 4. Deploy the Function

```bash
cd /Users/adam/Desktop/hoopgeek
npx supabase functions deploy post-to-facebook
```

## Usage

The function is called from the admin content table when clicking the "Post to Facebook" button.

You can also call it manually:

```typescript
const { data, error } = await supabase.functions.invoke('post-to-facebook', {
  body: {
    post_id: 'post-uuid',
    page_id: 'your-page-id' // Optional, uses FACEBOOK_PAGE_ID from env if not provided
  }
})
```

## Response

```json
{
  "success": true,
  "facebook_post_id": "123456789_987654321",
  "facebook_post_url": "https://facebook.com/123456789_987654321"
}
```

## Notes

- The function uses Facebook Graph API v18.0
- Posts include the post description and a link to the feed post
- The Facebook post ID and URL are stored in the feed post's metadata
- Make sure your Page Access Token has the required permissions
- Page Access Tokens can be long-lived (60 days) or permanent (if you set up the app properly)

