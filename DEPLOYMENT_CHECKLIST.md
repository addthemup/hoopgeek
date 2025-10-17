# 🚀 Deployment Checklist - HoopGeek

Use this checklist to ensure a smooth deployment process.

## 📋 Pre-Deployment

### Local Setup
- [ ] All features working locally (`npm run dev`)
- [ ] Build succeeds (`npm run build`)
- [ ] Preview build works (`npm run preview`)
- [ ] No console errors in production build
- [ ] Environment variables configured in `.env`

### Database
- [ ] Supabase project created
- [ ] All SQL migrations deployed:
  - [ ] `user_profiles.sql`
  - [ ] `user_favorite_players.sql`
  - [ ] `user_favorite_teams.sql`
  - [ ] `user_notification_preferences.sql`
  - [ ] `user_feed_preferences.sql`
- [ ] RLS policies tested
- [ ] Sample data added (if needed)

### Code Quality
- [ ] No TypeScript errors (`npm run type-check` if configured)
- [ ] No linter errors
- [ ] Unused code removed
- [ ] Console.logs removed (or kept intentionally)
- [ ] Comments updated
- [ ] README.md updated

### Security
- [ ] `.env` file in `.gitignore` ✅ (already done)
- [ ] No hardcoded secrets in code
- [ ] Supabase anon key (not service role key) used in frontend
- [ ] RLS enabled on all tables

---

## 🔧 GitHub Setup

### Repository
- [ ] Private GitHub repository created
- [ ] Initial commit made
- [ ] `.gitignore` configured ✅ (already done)
- [ ] `env.example` added for team reference ✅ (already done)
- [ ] Repository pushed to GitHub

```bash
# Commands to run:
git init
git add .
git commit -m "Initial commit - HoopGeek app"
git remote add origin https://github.com/yourusername/hoopgeek.git
git branch -M main
git push -u origin main
```

### Optional (Recommended)
- [ ] README with project description
- [ ] Branch protection rules (for teams)
- [ ] PR template
- [ ] Issue templates

---

## 🌐 Hosting Platform Setup

### Choose Your Platform (pick one)

#### ⭐ Vercel (Recommended)
- [ ] Account created at [vercel.com](https://vercel.com)
- [ ] GitHub connected
- [ ] Project imported from GitHub
- [ ] Framework preset: **Vite** (auto-detected)
- [ ] Build command: `npm run build` (auto-detected)
- [ ] Output directory: `dist` (auto-detected)
- [ ] Environment variables added:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] First deployment triggered
- [ ] Deployment URL tested

#### Option 2: Netlify
- [ ] Account created at [netlify.com](https://netlify.com)
- [ ] GitHub connected
- [ ] Site imported
- [ ] Build command: `npm run build`
- [ ] Publish directory: `dist`
- [ ] Environment variables added
- [ ] `public/_redirects` file exists ✅ (already done)
- [ ] Deployed and tested

#### Option 3: Cloudflare Pages
- [ ] Account created at [pages.cloudflare.com](https://pages.cloudflare.com)
- [ ] GitHub connected
- [ ] Framework preset: Vite
- [ ] Build settings configured
- [ ] Environment variables added
- [ ] Deployed and tested

---

## 🧪 Post-Deployment Testing

### Basic Functionality
- [ ] Homepage loads
- [ ] Navigation works
- [ ] Can sign up
- [ ] Can sign in
- [ ] Can sign out
- [ ] Protected routes work
- [ ] Public routes work

### User Settings (New Feature)
- [ ] Settings page accessible (click email in nav)
- [ ] Profile tab loads
- [ ] Can edit display name
- [ ] Can edit bio
- [ ] Can change theme
- [ ] Favorites tab loads
- [ ] Can view favorite players
- [ ] Can remove favorite players
- [ ] Can view favorite teams
- [ ] Can remove favorite teams
- [ ] Notifications tab loads
- [ ] Can toggle notification settings
- [ ] Feed tab loads
- [ ] Can adjust feed preferences
- [ ] Changes persist after refresh

### Fantasy Features
- [ ] Can create league
- [ ] Can join league
- [ ] Can view dashboard
- [ ] Draft system works
- [ ] Player database loads
- [ ] Team management works
- [ ] Matchups display correctly

### Game Highlights
- [ ] Home feed loads
- [ ] Game cards display
- [ ] Can click on game
- [ ] Game page loads with details
- [ ] Videos play (if available)
- [ ] Infinite scroll works

### Performance
- [ ] Page load time < 3 seconds
- [ ] Images load properly
- [ ] No broken links
- [ ] Mobile responsive
- [ ] Works on different browsers:
  - [ ] Chrome
  - [ ] Safari
  - [ ] Firefox
  - [ ] Edge

### Error Handling
- [ ] 404 page works
- [ ] Auth errors handled gracefully
- [ ] API errors show user-friendly messages
- [ ] Loading states display correctly

---

## 🔄 Continuous Deployment

### Automatic Deployments
- [ ] Push to `main` triggers deployment
- [ ] Build logs available
- [ ] Deployment notifications set up (email/Slack)

### Preview Deployments (if using Vercel/Netlify)
- [ ] PRs create preview deployments
- [ ] Preview URLs shareable
- [ ] Can test before merging

---

## 🌐 Custom Domain (Optional)

- [ ] Domain purchased
- [ ] Domain added to hosting platform
- [ ] DNS records configured
- [ ] SSL certificate provisioned (automatic)
- [ ] www redirect configured
- [ ] Domain working

---

## 📊 Monitoring & Analytics (Optional)

### Basic Monitoring
- [ ] Vercel/Netlify analytics enabled
- [ ] Error tracking set up (Sentry)
- [ ] Uptime monitoring (UptimeRobot)

### User Analytics
- [ ] Google Analytics added
- [ ] Custom events tracked
- [ ] Conversion tracking set up

---

## 📝 Documentation

### User-Facing
- [ ] Terms of Service (if needed)
- [ ] Privacy Policy (if needed)
- [ ] Help/FAQ section
- [ ] Contact information

### Developer-Facing
- [ ] README.md updated with:
  - [ ] Project description
  - [ ] Setup instructions
  - [ ] Environment variables
  - [ ] Deployment process
- [ ] API documentation
- [ ] Database schema documentation ✅ (already done)

---

## 🎯 Launch Day

### Final Checks
- [ ] All tests passing
- [ ] No critical bugs
- [ ] Backups configured
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Support channels ready

### Go Live
- [ ] Production deployment triggered
- [ ] Deployment successful
- [ ] Post-deployment tests passed
- [ ] Users notified (if applicable)
- [ ] Monitoring active

### Post-Launch
- [ ] Monitor error rates (first 24 hours)
- [ ] Check performance metrics
- [ ] Respond to user feedback
- [ ] Fix critical issues immediately
- [ ] Plan iteration based on feedback

---

## 🚨 Rollback Plan

If something goes wrong:

### Vercel
1. Go to deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

### Netlify
1. Go to deploys
2. Find last working deploy
3. Click "Publish deploy"

### Database Issues
1. Have SQL backup ready
2. Test on staging environment first
3. Never run destructive operations without backup

---

## 📞 Support Contacts

### Platform Support
- Vercel: https://vercel.com/support
- Netlify: https://www.netlify.com/support/
- Supabase: https://supabase.com/support

### Team Contacts (fill in)
- Project Lead: 
- Technical Lead: 
- DevOps: 
- Support: 

---

## ✅ Deployment Complete!

Once all items are checked:

1. 🎉 Celebrate! You've deployed HoopGeek
2. 📣 Share the URL with your team
3. 👀 Monitor for the first 24-48 hours
4. 🔄 Iterate based on feedback
5. 🚀 Keep building awesome features!

---

## 🔄 Regular Maintenance

### Weekly
- [ ] Check error logs
- [ ] Review performance metrics
- [ ] Update dependencies (if needed)

### Monthly
- [ ] Security audit
- [ ] Database optimization
- [ ] Backup verification
- [ ] Cost review

### Quarterly
- [ ] Major dependency updates
- [ ] Feature retrospective
- [ ] User feedback review
- [ ] Roadmap planning

---

**Last Updated**: ${new Date().toLocaleDateString()}

**Deployment Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete

