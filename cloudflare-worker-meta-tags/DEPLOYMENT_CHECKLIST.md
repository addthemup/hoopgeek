# Deployment Checklist - DFS Social Sharing

Use this checklist to deploy the meta tag injection worker for rich link previews.

## ✅ Pre-Deployment

- [ ] **Create OG Image**
  - [ ] Created `public/dfs-og-image.jpg` (1200x630px)
  - [ ] Image is under 1MB
  - [ ] Includes HoopGeek logo and branding
  - [ ] Text is readable and centered
  
- [ ] **Get Credentials**
  - [ ] Have Supabase URL (from your .env file)
  - [ ] Have Supabase Anon Key (from your .env file)
  - [ ] Have Cloudflare account access
  - [ ] Know your domain name (e.g., hoopgeek.app)

## ✅ Initial Setup

- [ ] **Install Dependencies**
  ```bash
  cd cloudflare-worker-meta-tags
  npm install
  ```

- [ ] **Update Configuration**
  - [ ] Edit `wrangler.toml`
  - [ ] Change `zone_name` to your domain
  - [ ] Change `pattern` to match your domain

- [ ] **Set Secrets** (one-time)
  ```bash
  npx wrangler secret put SUPABASE_URL
  # Paste your Supabase URL when prompted
  
  npx wrangler secret put SUPABASE_ANON_KEY
  # Paste your anon key when prompted
  ```

## ✅ Deployment

- [ ] **Deploy Worker**
  ```bash
  npm run deploy
  ```
  
- [ ] **Verify Deployment**
  - [ ] Check Cloudflare Workers dashboard
  - [ ] Worker shows as "Active"
  - [ ] No error messages

## ✅ Testing

- [ ] **Test with cURL**
  ```bash
  curl -A "facebookexternalhit/1.0" https://your-domain.com/dfs/join/POOL_ID
  ```
  - [ ] Response includes custom meta tags
  - [ ] Pool name shows correctly
  - [ ] Entry fee and prize pool are correct

- [ ] **Test in Real Apps**
  - [ ] iMessage: Share a pool link, verify rich preview shows
  - [ ] WhatsApp: Share a pool link, verify preview
  - [ ] Facebook: Use debugger tool to check
  - [ ] Twitter: Use card validator to check

- [ ] **Monitor Logs**
  ```bash
  npm run tail
  ```
  - [ ] Share a link and watch for requests
  - [ ] Verify bot detection works
  - [ ] Check for any errors

## ✅ Platform Verification

Use these tools to verify and clear caches:

- [ ] **Facebook Debugger**
  - Go to: https://developers.facebook.com/tools/debug/
  - Test URL: `https://your-domain.com/dfs/join/POOL_ID`
  - Click "Scrape Again" if needed

- [ ] **Twitter Card Validator**
  - Go to: https://cards-dev.twitter.com/validator
  - Test URL: `https://your-domain.com/dfs/join/POOL_ID`
  - Verify card preview

- [ ] **LinkedIn Post Inspector**
  - Go to: https://www.linkedin.com/post-inspector/
  - Test URL: `https://your-domain.com/dfs/join/POOL_ID`
  - Clear cache if needed

## ✅ Post-Deployment

- [ ] **Update Documentation**
  - [ ] Add domain to README.md examples
  - [ ] Update screenshots if needed

- [ ] **Share with Team**
  - [ ] Notify team that social sharing is live
  - [ ] Share test links to verify
  - [ ] Get feedback on preview appearance

- [ ] **Monitor Performance**
  - [ ] Check Cloudflare Workers analytics
  - [ ] Monitor error rates
  - [ ] Track usage patterns

## 📝 Deployment Notes

**Date Deployed**: _________________

**Domain**: _________________

**Worker Name**: hoopgeek-meta-injector

**Deployed By**: _________________

**Issues Encountered**: 
- 
- 

**Notes**:
- 
- 

## 🔄 Future Updates

When you need to update the worker:

```bash
cd cloudflare-worker-meta-tags

# Make your changes to meta-injector.js

# Deploy
npm run deploy

# Test
curl -A "facebookexternalhit/1.0" https://your-domain.com/dfs/join/POOL_ID

# Monitor
npm run tail
```

## 🆘 Troubleshooting

If something goes wrong:

1. **Check logs**:
   ```bash
   npm run tail
   ```

2. **Verify secrets are set**:
   ```bash
   npx wrangler secret list
   ```
   Should show: SUPABASE_URL, SUPABASE_ANON_KEY

3. **Check deployment status**:
   ```bash
   npx wrangler deployments list
   ```

4. **Test locally** (if needed):
   ```bash
   npm run dev
   ```

5. **Rollback** (if needed):
   ```bash
   npx wrangler rollback
   ```

## ✅ Success Criteria

Your deployment is successful when:

- [ ] Sharing a DFS pool link in iMessage shows a rich preview
- [ ] Preview includes contest name, entry fee, and prize pool
- [ ] Image loads correctly
- [ ] No errors in worker logs
- [ ] Preview updates when pool details change (within 5 min)
- [ ] Works across all major platforms (iMessage, WhatsApp, Facebook)

## 🎉 You're Done!

Once all boxes are checked, your DFS social sharing is live!

Users can now share contest links and see beautiful, informative previews that will increase click-through rates and contest entries.

---

**Need help?** Check `README.md` or `DFS_SOCIAL_SHARING_SETUP.md`

