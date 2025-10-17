# Google OAuth Setup for HoopGeek

## ⚠️ URGENT: Regenerate Your OAuth Secret

Your OAuth client secret was exposed in git. You **MUST** regenerate it:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find OAuth client: `695190952325-luvbbl0qhl71qtnb96j81gmljigec546...`
3. **DELETE IT**
4. Create a new OAuth 2.0 Client ID (see steps below)

---

## 🔧 Step-by-Step Setup

### Step 1: Create New OAuth Credentials (Google Cloud Console)

1. **Go to Google Cloud Console**
   ```
   https://console.cloud.google.com/apis/credentials
   ```

2. **Select your project** (or create one if needed)
   - Project Name: HoopGeek

3. **Create OAuth 2.0 Client ID**
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   
   **Configuration:**
   - **Application type**: Web application
   - **Name**: HoopGeek Production
   
   **Authorized JavaScript origins:**
   ```
   http://localhost:3000
   https://hoop-geek.com
   https://www.hoop-geek.com
   ```
   
   **Authorized redirect URIs:**
   ```
   https://qbznyaimnrpibmahisue.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   https://hoop-geek.com/auth/callback
   ```

4. **Download credentials**
   - You'll get a Client ID and Client Secret
   - **DO NOT** commit these to git!
   - Store in password manager or secure note

---

### Step 2: Configure in Supabase Dashboard

1. **Go to Supabase Dashboard**
   ```
   https://app.supabase.com/project/qbznyaimnrpibmahisue/auth/providers
   ```

2. **Click on "Google" provider**

3. **Enable Google Auth**
   - Toggle "Enable Sign in with Google" to ON

4. **Paste Your Credentials:**
   - **Client ID**: `[Your new Client ID from Step 1]`
   - **Client Secret**: `[Your new Client Secret from Step 1]`

5. **Configure Redirect URL** (should already be set):
   ```
   https://qbznyaimnrpibmahisue.supabase.co/auth/v1/callback
   ```

6. **Save Changes**

---

### Step 3: Update Your Frontend Code (if needed)

Your frontend should use Supabase's auth, NOT direct Google OAuth:

```typescript
// src/utils/auth.ts or in your login component

import { supabase } from './supabase'

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  })
  
  if (error) {
    console.error('Error signing in with Google:', error)
    return { error }
  }
  
  return { data }
}
```

**In your Login component:**

```tsx
import { signInWithGoogle } from '../utils/auth'

function LoginPage() {
  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle()
    if (error) {
      alert('Error signing in: ' + error.message)
    }
    // If successful, user will be redirected to Google
  }
  
  return (
    <button onClick={handleGoogleLogin}>
      Sign in with Google
    </button>
  )
}
```

---

### Step 4: Set Up Auth Callback Page

Create a callback handler for after Google redirects back:

```tsx
// src/pages/AuthCallback.tsx

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  
  useEffect(() => {
    // Handle the OAuth callback
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // Redirect to dashboard or home
        navigate('/dashboard')
      }
    })
  }, [navigate])
  
  return (
    <div>
      <h2>Signing you in...</h2>
      <p>Please wait while we complete authentication.</p>
    </div>
  )
}
```

**Add route in App.tsx:**

```tsx
<Route path="/auth/callback" element={<AuthCallback />} />
```

---

## 🔐 Security Best Practices

### ✅ DO:
- Store OAuth credentials in Supabase Dashboard
- Use environment variables for Supabase URL and anon key
- Keep client secret file out of git (use `.gitignore`)
- Regenerate secrets if they're ever exposed
- Use HTTPS in production

### ❌ DON'T:
- Commit OAuth secrets to git
- Put secrets in frontend code
- Share secrets in plain text (Slack, email, etc.)
- Use the same credentials for dev and production (ideally)

---

## 🌐 Environment Variables

### Local Development (.env)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://qbznyaimnrpibmahisue.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# NOTE: OAuth Client Secret is NOT needed here!
# It's configured in Supabase Dashboard
```

### Production (Cloudflare Pages)

Go to: `Cloudflare Dashboard → Workers & Pages → Your Project → Settings → Environment Variables`

Add the same variables:
```
VITE_SUPABASE_URL = https://qbznyaimnrpibmahisue.supabase.co
VITE_SUPABASE_ANON_KEY = your-supabase-anon-key
```

---

## 📊 How It Works

```
┌─────────────┐
│   User      │ Clicks "Sign in with Google"
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│   Your Frontend (hoop-geek.com)             │
│   supabase.auth.signInWithOAuth()           │
└──────┬──────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│   Supabase Auth Service                     │
│   (Redirects to Google)                     │
└──────┬──────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│   Google OAuth (accounts.google.com)        │
│   User logs in                              │
└──────┬──────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│   Google redirects back to Supabase         │
│   WITH: authorization code                  │
└──────┬──────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│   Supabase Backend                          │
│   - Exchanges code for token                │
│   - Uses YOUR CLIENT SECRET (from config)   │
│   - Creates user session                    │
└──────┬──────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│   Redirects to your app                     │
│   User is now authenticated! ✅             │
└─────────────────────────────────────────────┘
```

**Key Point:** Your client secret is used by **Supabase's backend**, never exposed to the browser!

---

## 🧪 Testing

### Local Testing (http://localhost:3000)

1. Start your dev server: `npm run dev`
2. Click "Sign in with Google"
3. Should redirect to Google
4. After signing in, should redirect back to `http://localhost:3000/auth/callback`
5. Then redirect to your dashboard/home

### Production Testing (https://hoop-geek.com)

Same flow, but with production URLs.

---

## 🐛 Troubleshooting

### "redirect_uri_mismatch" Error

**Problem:** The redirect URI doesn't match what's configured in Google Cloud Console.

**Solution:** 
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Make sure this is in "Authorized redirect URIs":
   ```
   https://qbznyaimnrpibmahisue.supabase.co/auth/v1/callback
   ```

### "Invalid client" Error

**Problem:** Client ID or Secret is wrong in Supabase.

**Solution:**
1. Double-check credentials in Supabase Dashboard
2. Make sure you copied them correctly (no extra spaces)

### OAuth Doesn't Work After Deployment

**Problem:** Authorized origins missing production domain.

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Add your production domain to "Authorized JavaScript origins":
   ```
   https://hoop-geek.com
   ```

---

## 📝 Checklist

Before going live:

- [ ] Regenerated OAuth credentials (old ones were exposed)
- [ ] Configured new credentials in Supabase Dashboard
- [ ] Added production domains to Google Cloud Console
- [ ] Tested Google sign-in locally
- [ ] Tested Google sign-in in production
- [ ] Removed client_secret file from git (already done ✅)
- [ ] Added .gitignore entry for secrets (already done ✅)
- [ ] Stored new credentials securely (password manager)

---

## 🆘 Need Help?

If OAuth isn't working:

1. Check Supabase logs: `Dashboard → Logs → Auth Logs`
2. Check browser console for errors
3. Verify all redirect URIs match exactly
4. Make sure Google OAuth is enabled in Supabase
5. Test with a different Google account

---

**Remember:** OAuth secrets belong in **Supabase Dashboard**, NOT in your code! 🔐

