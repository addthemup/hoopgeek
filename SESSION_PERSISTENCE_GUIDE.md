# Session Persistence Guide

## Problem
Users are being logged out every time they close and reopen the browser, which creates a poor user experience.

## Solution
Your app already uses Supabase's token-based authentication system with:
- **Access tokens** (short-lived, currently 1 hour)
- **Refresh tokens** (long-lived, used to get new access tokens)

The code has been updated to:
1. ✅ Persist sessions in localStorage
2. ✅ Automatically refresh tokens before they expire
3. ✅ Proactively refresh tokens when the app loads if they're about to expire

## Important: Increase JWT Expiry in Production

The main issue is that your JWT tokens expire after **1 hour** (3600 seconds). To fix this, you need to increase the JWT expiry time in your **production Supabase dashboard**.

### Steps to Increase JWT Expiry:

1. **Go to your Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project: `qbznyaimnrpibmahisue`

2. **Navigate to Authentication Settings**
   - Go to: **Settings** → **Authentication** → **Auth Settings**

3. **Update JWT Expiry**
   - Find the **"JWT expiry"** setting
   - Change it from `3600` (1 hour) to a longer duration:
     - **Recommended**: `604800` (1 week = 7 days)
     - **Maximum**: `604800` (1 week) - Supabase's maximum
   - **Alternative**: `259200` (3 days) for a balance between security and UX

4. **Save Changes**
   - Click **Save** to apply the changes

### What This Does:

- **Access tokens** will now last longer (up to 1 week instead of 1 hour)
- **Refresh tokens** will automatically get new access tokens when they expire
- Users will stay logged in even after closing the browser, as long as they return within the refresh token's lifetime

## How It Works Now

1. **User signs in** → Gets access token (1 week expiry) + refresh token
2. **Token stored in localStorage** → Persists across browser restarts
3. **App loads** → Automatically checks if token needs refresh
4. **Token expires** → Refresh token automatically gets a new access token
5. **User stays logged in** → No need to sign in again!

## Testing

After updating the JWT expiry in production:

1. Sign in to your app
2. Close the browser completely
3. Reopen the browser and navigate to your app
4. You should still be logged in! ✅

## Local Development

For local development, you can update `supabase/config.toml`:

```toml
[auth]
jwt_expiry = 604800  # 1 week (instead of 3600 = 1 hour)
```

Then restart your local Supabase instance.

## Security Notes

- Refresh tokens are stored securely in localStorage
- Tokens are automatically refreshed before expiration
- If a refresh token is invalid or expired, the user will need to sign in again
- The maximum JWT expiry is 1 week for security reasons

## Troubleshooting

If users are still being logged out:

1. **Check browser console** for authentication errors
2. **Verify localStorage** - Check if `supabase.auth.token` exists in browser DevTools → Application → Local Storage
3. **Check Supabase dashboard** - Verify JWT expiry was updated correctly
4. **Clear browser cache** - Sometimes old tokens can cause issues










