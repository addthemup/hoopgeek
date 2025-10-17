# HoopGeek - Deployment Guide

## 🚀 Quick Deployment (Recommended)

### Step 1: Prepare Your Repository

1. **Create a private GitHub repository**
   ```bash
   # Initialize git if not already done
   git init
   
   # Create .gitignore (already exists ✅)
   
   # Make your first commit
   git add .
   git commit -m "Initial commit - HoopGeek app"
   
   # Create GitHub repo and link it
   git remote add origin https://github.com/yourusername/hoopgeek.git
   git branch -M main
   git push -u origin main
   ```

2. **Set up environment variables locally**
   ```bash
   # Copy the example file
   cp env.example .env
   
   # Edit .env with your actual Supabase credentials
   # Get them from: https://app.supabase.com/project/_/settings/api
   nano .env
   ```

### Step 2: Deploy Database Schema

Before deploying the frontend, deploy your database schema:

```bash
# Deploy user customization system
./scripts/deploy_user_customization.sh

# Or manually run SQL files in Supabase dashboard
# (See USER_CUSTOMIZATION_IMPLEMENTATION.md)
```

### Step 3: Deploy Frontend to Vercel (Recommended)

**Why Vercel?**
- Zero configuration for Vite apps
- Automatic deployments from GitHub
- Free SSL certificates
- Global CDN
- Generous free tier

**Deployment Steps:**

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your `hoopgeek` repository
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
6. Add environment variables:
   - `VITE_SUPABASE_URL` → Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → Your Supabase anon key
7. Click "Deploy"

**That's it!** ✨ Your app will be live in ~2 minutes.

Every time you push to `main`, Vercel will automatically redeploy.

---

## 📦 Alternative Hosting Options

### Option 2: Netlify

1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Add environment variables in Settings → Build & deploy → Environment
7. Deploy

### Option 3: Cloudflare Pages

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect GitHub
3. Select repository
4. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Add environment variables
6. Deploy

---

## 🔐 Environment Variables

Your app needs these environment variables:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | [Supabase Dashboard](https://app.supabase.com/project/_/settings/api) → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key | [Supabase Dashboard](https://app.supabase.com/project/_/settings/api) → anon public key |

**Important:** 
- ✅ These are **public** keys (safe to expose in frontend)
- ✅ Use RLS (Row Level Security) for data protection (already configured)
- ❌ Never commit `.env` file to GitHub (already in `.gitignore`)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           GitHub Repository (Private)           │
│                                                 │
│  • React + Vite + TypeScript                   │
│  • MUI Joy UI Components                       │
│  • React Query for data management             │
└────────────────┬────────────────────────────────┘
                 │
                 │ git push
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         Vercel / Netlify / Cloudflare           │
│                                                 │
│  • Automatic build on push                     │
│  • Global CDN                                   │
│  • SSL certificates                             │
│  • Domain management                            │
└────────────────┬────────────────────────────────┘
                 │
                 │ API calls
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│            Supabase (Cloud Hosted)              │
│                                                 │
│  • PostgreSQL Database                          │
│  • Authentication                               │
│  • Row Level Security (RLS)                     │
│  • Real-time subscriptions                      │
│  • Storage (if needed later)                    │
└─────────────────────────────────────────────────┘
```

---

## ✅ Pre-Deployment Checklist

Before pushing to production:

- [ ] All environment variables configured
- [ ] Database schema deployed to Supabase
- [ ] RLS policies tested
- [ ] User authentication works
- [ ] Build succeeds locally (`npm run build`)
- [ ] Preview build works (`npm run preview`)
- [ ] No console errors in production build
- [ ] All sensitive data in `.gitignore`
- [ ] Game JSON files strategy decided (see below)

---

## 📂 Game JSON Files Consideration

Your app has large game JSON files (15GB total). You have options:

### Option 1: Keep in Git (Simple but Large)
- ✅ Simple deployment
- ❌ Large repo size
- ❌ Slow pushes/pulls
- **Recommendation**: Only include a few sample games in repo

### Option 2: Use Supabase Storage (Recommended)
- ✅ Efficient storage
- ✅ Fast CDN delivery
- ✅ Small repo size
- **Implementation**: Upload JSONs to Supabase Storage, fetch on-demand

### Option 3: Separate CDN
- Upload games to Cloudflare R2 / AWS S3
- Reference URLs in your app
- Best for massive scale

**For now:** 
- Keep a few sample games in `src/assets/json/` for demo
- Upload full library to Supabase Storage later

---

## 🔧 Build Configuration

Your build is already configured! Here's what's set up:

### `vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Add if needed:
  build: {
    outDir: 'dist',
    sourcemap: false, // Set true for debugging
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // Code splitting for better performance
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/joy'],
        }
      }
    }
  }
})
```

---

## 🚨 Common Deployment Issues

### Issue: "Missing Supabase environment variables"
**Solution**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your hosting platform's environment variables

### Issue: "Cannot find module"
**Solution**: Run `npm install` locally, ensure `package-lock.json` is committed

### Issue: "Build fails on host but works locally"
**Solution**: Check Node version. Use same version locally and on host:
```json
// Add to package.json
"engines": {
  "node": ">=18.0.0"
}
```

### Issue: "404 on page refresh"
**Solution**: Configure redirects for SPA:

**Vercel** - Create `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Netlify** - Create `public/_redirects`:
```
/*    /index.html   200
```

---

## 📊 Monitoring & Analytics (Optional)

Once deployed, consider adding:

1. **Vercel Analytics** (built-in, free)
2. **Google Analytics** (user tracking)
3. **Sentry** (error tracking)
4. **LogRocket** (session replay)

---

## 🔄 CI/CD Pipeline (Already Set Up!)

When you deploy to Vercel/Netlify/Cloudflare:

```
1. Push to GitHub (main branch)
        ↓
2. Hosting platform detects push
        ↓
3. Automatic build starts
        ↓
4. npm install
        ↓
5. npm run build
        ↓
6. Deploy to CDN
        ↓
7. Live in 2-3 minutes! 🎉
```

Preview deployments on PRs:
- Create branch → push → automatic preview URL
- Test before merging to main

---

## 🌐 Custom Domain (Optional)

All hosting platforms support custom domains:

1. Buy domain (Namecheap, Google Domains, etc.)
2. Add domain in hosting dashboard
3. Update DNS records (platform provides instructions)
4. SSL certificate auto-provisioned
5. Live on your domain! (e.g., hoopgeek.com)

---

## 📝 Recommended Git Workflow

```bash
# Feature development
git checkout -b feature/user-settings
# ... make changes ...
git add .
git commit -m "Add user settings page"
git push origin feature/user-settings

# Create PR on GitHub
# Review → Merge to main
# Automatic deployment to production! 🚀
```

---

## 🔒 Security Best Practices

✅ **Already implemented:**
- Environment variables for secrets
- RLS (Row Level Security) on database
- Anon key (public) used in frontend
- `.gitignore` configured

✅ **Additional recommendations:**
- Enable 2FA on GitHub
- Enable 2FA on Supabase
- Enable 2FA on hosting platform
- Regular dependency updates (`npm audit`)

---

## 📈 Next Steps After Deployment

1. **Test everything on production URL**
   - Sign up flow
   - User settings page
   - Favorite players/teams
   - Feed customization

2. **Monitor performance**
   - Check build times
   - Monitor load times
   - Watch error rates

3. **Iterate**
   - Add more features
   - Fix bugs
   - Improve UX

4. **Share your app!**
   - Get feedback from users
   - Make it better

---

## 🎯 Deployment Commands Reference

```bash
# Local development
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Type checking
npm run type-check

# Linting (if configured)
npm run lint

# Deploy database changes
./scripts/deploy_user_customization.sh
```

---

## 🆘 Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev

---

## ✨ You're Ready to Deploy!

Your app is production-ready. Just:

1. Push to GitHub ✅
2. Connect to Vercel ✅
3. Add environment variables ✅
4. Deploy! 🚀

Good luck! 🏀

