# HoopGeek - Cloudflare Pages Deployment Guide

## 🎯 Why Cloudflare Pages?

Since you bought `hoop-geek.com` on Cloudflare, using Cloudflare Pages is the simplest option:

✅ **Everything in one dashboard** (domain + hosting)  
✅ **Unlimited bandwidth** on free tier 🤯  
✅ **Instant domain connection** (no DNS wait)  
✅ **Automatic deployments** from GitHub  
✅ **Free SSL** (automatic)  
✅ **Global CDN**  
✅ **Same speed** as Vercel  

**Cost:** $0/month forever (unlimited bandwidth on free tier!)

---

## 🚀 Step-by-Step Deployment (10 minutes)

### Prerequisites
- [x] Code pushed to GitHub (private repo is fine)
- [x] Domain bought on Cloudflare (hoop-geek.com ✅)
- [x] Supabase project set up

---

### Step 1: Connect GitHub to Cloudflare

1. **Go to Cloudflare Dashboard**
   ```
   → https://dash.cloudflare.com
   → Sign in with your account
   ```

2. **Navigate to Pages**
   ```
   → Click "Workers & Pages" in left sidebar
   → Click "Create application" button
   → Choose "Pages" tab
   ```

3. **Connect to Git**
   ```
   → Click "Connect to Git"
   → Authorize Cloudflare to access GitHub
   → Select your GitHub organization/account
   ```

---

### Step 2: Select Repository & Configure

1. **Select Repository**
   ```
   → Find "hoopgeek" in the list
   → Click "Begin setup"
   ```

2. **Configure Build Settings**
   ```
   Project name: hoopgeek (or hoop-geek)
   Production branch: main
   
   Build settings:
   Framework preset: Vite
   Build command: npm run build
   Build output directory: dist
   Root directory: / (leave blank)
   ```

3. **Add Environment Variables**
   ```
   Click "Add variable" for each:
   
   Variable name: VITE_SUPABASE_URL
   Value: [Your Supabase URL from dashboard]
   
   Variable name: VITE_SUPABASE_ANON_KEY
   Value: [Your Supabase anon key from dashboard]
   ```

4. **Save and Deploy**
   ```
   → Click "Save and Deploy"
   → Watch the build logs (2-3 minutes)
   → Wait for "Success" ✅
   ```

---

### Step 3: Connect Your Custom Domain

1. **After First Deploy Completes**
   ```
   → Go to project settings
   → Click "Custom domains" tab
   → Click "Set up a custom domain"
   ```

2. **Add Your Domain**
   ```
   → Enter: hoop-geek.com
   → Click "Continue"
   → Cloudflare detects it's already registered
   → Click "Activate domain"
   ```

3. **DNS Configuration (Automatic!)**
   ```
   Since domain is on Cloudflare, DNS is configured automatically!
   No waiting, no manual setup needed.
   ```

4. **Add WWW (Optional)**
   ```
   → Click "Set up a custom domain" again
   → Enter: www.hoop-geek.com
   → Activate
   → Cloudflare auto-redirects www → non-www
   ```

---

### Step 4: Verify & Test

1. **Check SSL Certificate**
   ```
   → Should show "Active" immediately
   → Cloudflare provides free SSL
   ```

2. **Visit Your Site**
   ```
   → Open: https://hoop-geek.com
   → Should load your app! 🎉
   → Check: https://www.hoop-geek.com (should redirect)
   ```

3. **Test Functionality**
   ```
   → Try signing up
   → Check if Supabase connection works
   → Test all major features
   → Check browser console for errors
   ```

---

## 🔄 Continuous Deployment

Now every time you push to GitHub:

```bash
# Local development
git add .
git commit -m "Add new feature"
git push origin main

# Cloudflare automatically:
# 1. Detects the push
# 2. Starts a build
# 3. Runs npm install
# 4. Runs npm run build
# 5. Deploys to production
# 6. Live in 2-3 minutes! 🚀
```

**You can watch builds in:** Dashboard → Workers & Pages → Your Project → Deployments

---

## 📊 What You Get (Free Tier)

| Feature | Limit | Notes |
|---------|-------|-------|
| **Bandwidth** | **UNLIMITED** | No overages ever! |
| **Builds** | 500/month | ~17 deploys/day |
| **Build time** | 20 min/build | More than enough |
| **Concurrent builds** | 1 | Queues if >1 |
| **Custom domains** | 100 | Way more than needed |
| **Preview deploys** | Unlimited | On every PR |
| **DDoS protection** | Included | Free |
| **Analytics** | Basic | Free |

---

## 🌿 Branch Preview Deployments

Cloudflare Pages gives you preview URLs for every branch:

```bash
# Create a feature branch
git checkout -b feature/new-ui
git push origin feature/new-ui

# Cloudflare automatically:
# → Creates preview URL: feature-new-ui.hoopgeek.pages.dev
# → You can test before merging!
```

**Perfect for:**
- Testing new features
- Sharing with team
- Client previews
- QA testing

---

## 🔧 Advanced Configuration

### Custom Build Commands

If you need custom build steps, edit in dashboard:

```bash
Build command: npm ci && npm run build
# or
Build command: pnpm install && pnpm build
```

### Environment Variables per Branch

```bash
Production (main branch):
  VITE_SUPABASE_URL = production-url
  
Preview (feature branches):
  VITE_SUPABASE_URL = staging-url
```

### Custom Headers

Create `public/_headers`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### Redirects & Rewrites

Create `public/_redirects`:
```
# SPA routing (already created ✅)
/*    /index.html   200

# Custom redirects
/old-path    /new-path    301
/blog/*      https://blog.hoop-geek.com/:splat  301
```

---

## 📈 Analytics & Monitoring

### Built-in Analytics (Free)

```bash
1. Dashboard → Your Project → Analytics
2. View:
   - Page views
   - Unique visitors
   - Top pages
   - Top countries
   - Bandwidth usage
```

### Add External Analytics

**Google Analytics:**
```html
<!-- Add to index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
```

**Vercel Analytics Alternative:**
```bash
# Cloudflare Web Analytics (Free)
Dashboard → Analytics & Logs → Web Analytics
→ Add site
→ Copy script to index.html
```

---

## 🚨 Troubleshooting

### Build Fails

**Check build logs:**
```
Dashboard → Deployments → Click failed build → View logs
```

**Common issues:**
```bash
# Missing dependencies
→ Solution: Add to package.json dependencies

# Environment variables not set
→ Solution: Settings → Environment variables → Add them

# Build command wrong
→ Solution: Settings → Builds & deployments → Update command

# Node version mismatch
→ Solution: Add to package.json:
{
  "engines": {
    "node": "18.x"
  }
}
```

### Domain Not Working

**Check DNS:**
```bash
# Command line:
dig hoop-geek.com

# Or use: https://dnschecker.org
```

**If not working:**
```
1. Dashboard → Domain → DNS
2. Check for:
   - A record: @ → Cloudflare Pages IP
   - CNAME: www → your-project.pages.dev
3. Wait up to 5 minutes (usually instant)
```

### SSL Certificate Issues

**Usually auto-resolved in 15 minutes**

If not:
```
1. Dashboard → SSL/TLS → Edge Certificates
2. Verify: "Always Use HTTPS" is ON
3. Verify: SSL/TLS encryption mode is "Full"
```

### App Works on localhost but not production

**Check:**
```
1. Environment variables set in Cloudflare
2. Build output is in /dist folder
3. No hardcoded localhost URLs
4. CORS configured in Supabase for your domain
```

---

## 🔐 Security Settings

### Enable Additional Protection

1. **Always Use HTTPS**
   ```
   SSL/TLS → Edge Certificates → Always Use HTTPS: ON
   ```

2. **Bot Fight Mode** (Free)
   ```
   Security → Bots → Bot Fight Mode: ON
   ```

3. **Security Level**
   ```
   Security → Settings → Security Level: Medium
   ```

4. **Challenge Passage**
   ```
   Security → Settings → Challenge Passage: 30 minutes
   ```

---

## 💰 Cost Summary

### Current Setup
- Domain: $9.15/year × 2 years = **$18.30 paid** ✅
- Hosting: **$0/month** (unlimited bandwidth!)
- SSL: **$0** (included)
- DDoS Protection: **$0** (included)

### Total Cost
**Year 1:** $0/month  
**Year 2:** $0/month  
**Year 3+:** ~$10/year (domain renewal only)

**You can scale to 100k+ users on $0/month hosting!** 🎉

---

## 📞 Support Resources

### Cloudflare Pages Docs
- General: https://developers.cloudflare.com/pages
- Framework Guides: https://developers.cloudflare.com/pages/framework-guides
- Build Configuration: https://developers.cloudflare.com/pages/platform/build-configuration

### Community Support
- Discord: https://discord.cloudflare.com
- Community Forum: https://community.cloudflare.com
- Stack Overflow: Tag [cloudflare-pages]

### Status Page
- https://www.cloudflarestatus.com

---

## ✅ Deployment Checklist

Before going live:

- [ ] Code pushed to GitHub
- [ ] Environment variables added in Cloudflare
- [ ] First deployment successful
- [ ] Custom domain connected (hoop-geek.com)
- [ ] SSL certificate active (https works)
- [ ] WWW redirect working
- [ ] Database connection works
- [ ] Auth flow works (sign up/sign in)
- [ ] All pages load correctly
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Tested on Chrome, Safari, Firefox

---

## 🎯 Next Steps After Deployment

1. **Set up monitoring**
   - Cloudflare Web Analytics
   - UptimeRobot (free uptime monitoring)
   - Error tracking (Sentry)

2. **Enable caching**
   - Dashboard → Caching → Configuration
   - Cache static assets aggressively

3. **Add custom error pages**
   - Create 404.html, 500.html
   - Place in /public folder

4. **Set up email**
   - Cloudflare Email Routing (free)
   - Forward contact@hoop-geek.com to your email

5. **Monitor performance**
   - Cloudflare Analytics
   - Web Vitals
   - PageSpeed Insights

---

## 🔄 Comparison: Cloudflare Pages vs Vercel

### When to use Cloudflare Pages (You!)
✅ Domain already on Cloudflare  
✅ Want unlimited bandwidth  
✅ Everything in one dashboard  
✅ Simpler DNS setup  

### When to use Vercel
✅ More polished dashboard  
✅ Better build minutes on free tier  
✅ Team collaboration features  
✅ Prefer their brand/ecosystem  

**For your situation:** Cloudflare Pages is perfect! 🎯

---

## 🎉 You're Live!

Once deployed, your app is:
- ✅ Live at https://hoop-geek.com
- ✅ Automatic SSL
- ✅ Global CDN (fast worldwide)
- ✅ Unlimited bandwidth
- ✅ Auto-deploys on git push
- ✅ DDoS protected
- ✅ 100% uptime SLA

**Congratulations! Your app is production-ready!** 🚀🏀

---

**Need help?** Reference this guide or check Cloudflare's excellent documentation.

