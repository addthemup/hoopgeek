# HoopGeek - Domain Setup Guide

## ✅ Quick Checklist

### Step 1: Choose & Buy Domain
- [ ] Decide on domain name (e.g., hoopgeek.com)
- [ ] Choose registrar (Recommended: Cloudflare)
- [ ] Purchase domain ($9-15/year)
- [ ] Enable WHOIS privacy (should be free/included)

### Step 2: Deploy to Vercel
- [ ] Push code to GitHub
- [ ] Connect GitHub to Vercel
- [ ] Import repository
- [ ] Add environment variables:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
- [ ] First deployment successful

### Step 3: Connect Domain to Vercel
- [ ] Add domain in Vercel settings
- [ ] Configure DNS (choose method below)

#### Method A: Using Cloudflare DNS (Recommended)
- [ ] Add A record: @ → 76.76.19.19
- [ ] Add CNAME: www → cname.vercel-dns.com
- [ ] Or copy exact records from Vercel dashboard

#### Method B: Using Vercel Nameservers
- [ ] Change nameservers to:
  - ns1.vercel-dns.com
  - ns2.vercel-dns.com
- [ ] Wait 15-60 minutes

#### Method C: Bought Domain Through Vercel
- [ ] Nothing! Auto-configured ✅

### Step 4: Wait for Propagation
- [ ] DNS propagation (5-60 minutes)
- [ ] SSL certificate issued (automatic)
- [ ] Test: Visit your domain
- [ ] Test: Visit www.yourdomain.com

### Step 5: Verify Everything Works
- [ ] Homepage loads
- [ ] All routes work
- [ ] SSL padlock shows in browser
- [ ] www redirects to non-www (or vice versa)
- [ ] No console errors

---

## 🌐 Recommended Registrar: Cloudflare

### Why Cloudflare?
1. **At-cost pricing** - $9-10/year for .com (no markup!)
2. **Free WHOIS privacy** - Your info stays private
3. **Best DNS** - Fastest in the world
4. **No BS** - No upsells, no hidden fees
5. **Developer-friendly** - Clean interface

### How to Buy on Cloudflare

1. **Create Account**
   ```
   → Go to dash.cloudflare.com/sign-up
   → Sign up with email
   → Verify email
   ```

2. **Buy Domain**
   ```
   → Click "Domain Registration" in sidebar
   → Search for your domain
   → Add to cart
   → Checkout (credit card required)
   → Wait 5-10 minutes for registration
   ```

3. **Confirm Ownership**
   ```
   → Check email for domain confirmation
   → Click confirmation link
   → Domain is now active!
   ```

**Total Time:** 10-15 minutes  
**Cost:** $9.15 for .com (exact ICANN cost)

---

## 🔗 Connecting Domain to Vercel

### Method 1: Cloudflare DNS + Vercel (Recommended)

**Step 1: Add Domain in Vercel**
```
1. Vercel Dashboard → Select Project
2. Settings → Domains
3. Enter domain: hoopgeek.com
4. Click "Add"
5. Vercel shows DNS records needed
```

**Step 2: Add DNS Records in Cloudflare**
```
1. Cloudflare Dashboard → Your Domain
2. DNS → Records → Add Record

For Apex Domain (hoopgeek.com):
Type: A
Name: @
IPv4 address: 76.76.19.19
Proxy status: DNS only (grey cloud)

For WWW (www.hoopgeek.com):
Type: CNAME
Name: www
Target: cname.vercel-dns.com
Proxy status: DNS only (grey cloud)
```

**Step 3: Verify in Vercel**
```
1. Back to Vercel Domains settings
2. Wait 5-30 minutes
3. Status changes to "Valid Configuration"
4. SSL certificate auto-issued
5. ✅ Done!
```

---

### Method 2: Use Vercel Nameservers (Simpler)

**Step 1: Add Domain in Vercel**
```
1. Vercel Dashboard → Settings → Domains
2. Enter domain: hoopgeek.com
3. Click "Add"
4. Choose "Use Vercel nameservers"
```

**Step 2: Update Nameservers at Cloudflare**
```
1. Cloudflare → Domain → DNS → Nameservers
2. Click "Change"
3. Enter Vercel nameservers:
   - ns1.vercel-dns.com
   - ns2.vercel-dns.com
4. Save
5. Wait 15-60 minutes for propagation
```

**Step 3: Verify**
```
1. Vercel auto-configures everything
2. SSL certificate auto-issued
3. Visit your domain
4. ✅ Live!
```

---

## 🎯 Alternative Registrar: Namecheap

### How to Buy on Namecheap

1. **Search & Buy**
   ```
   → Go to namecheap.com
   → Search: hoopgeek.com
   → Add to cart
   → Make sure WhoisGuard is FREE
   → Checkout (often $8.88 first year)
   ```

2. **Connect to Vercel**
   ```
   → Namecheap → Domain List → Manage
   → Domain tab → Nameservers section
   → Select "Custom DNS"
   → Enter:
     ns1.vercel-dns.com
     ns2.vercel-dns.com
   → Save (15-60 min propagation)
   ```

3. **Add in Vercel**
   ```
   → Vercel → Settings → Domains
   → Enter domain
   → Wait for DNS propagation
   → ✅ Done!
   ```

**Total Time:** 15-20 minutes  
**Cost:** $8-9 first year, $13-15 renewals

---

## 💰 Cost Comparison

| Registrar | Year 1 | Renewal | Privacy | Total 5-Year |
|-----------|--------|---------|---------|--------------|
| **Cloudflare** | $9.15 | $9.15 | Free | $45.75 |
| **Namecheap** | $8.88 | $12.98 | Free | $60.80 |
| **Vercel** | $15 | $15 | Free | $75 |
| **Porkbun** | $9.13 | $10.69 | Free | $52.01 |
| GoDaddy | $11.99 | $19.99 | $9.99/yr | $139.91 |

**Winner:** Cloudflare ($9.15/year forever, no surprises)

---

## 🚨 Common Issues & Fixes

### Issue: "Domain not verifying"
**Solution:**
- Wait longer (DNS can take up to 48 hours)
- Check DNS records are correct
- Disable Cloudflare proxy (grey cloud, not orange)
- Clear browser cache

### Issue: "SSL certificate not issuing"
**Solution:**
- Wait 24 hours (Vercel auto-renews)
- Ensure DNS is propagated (check with dnschecker.org)
- No CAA records blocking Let's Encrypt
- Contact Vercel support

### Issue: "www not working"
**Solution:**
- Add CNAME record for www
- Add both www.domain.com AND domain.com in Vercel
- Vercel handles redirects automatically

### Issue: "Site shows Vercel 404"
**Solution:**
- Ensure project is deployed
- Check domain is added to correct project
- Verify build succeeded
- Check `vercel.json` redirect rules

---

## 🔍 Verify DNS Propagation

Use these tools to check if DNS has propagated:

1. **DNS Checker**
   → https://dnschecker.org
   → Enter your domain
   → Check A and CNAME records worldwide

2. **Command Line**
   ```bash
   # Check A record
   dig hoopgeek.com
   
   # Check CNAME
   dig www.hoopgeek.com
   
   # Check nameservers
   dig hoopgeek.com NS
   ```

3. **What's My DNS**
   → https://whatsmydns.net
   → Shows global DNS propagation

---

## 📧 Email Setup (Optional)

Once you have a domain, you might want email:

### Option 1: Email Forwarding (Free)
**Cloudflare Email Routing** (Free!)
```
1. Cloudflare → Email → Email Routing
2. Add destination: your-actual-email@gmail.com
3. Add custom address: hello@hoopgeek.com
4. Forwards emails for free!
```

### Option 2: Full Email Hosting
- **Google Workspace:** $6/month per user
- **ProtonMail:** $4-8/month
- **Zoho Mail:** $1/month per user

---

## ✅ Final Checklist

Before you consider it "done":

- [ ] Domain registered
- [ ] DNS configured
- [ ] Domain shows in Vercel as "Valid"
- [ ] SSL certificate issued (https:// works)
- [ ] Both www and non-www work
- [ ] All pages load correctly
- [ ] No browser warnings
- [ ] Tested on multiple devices
- [ ] Told friends about your site! 🎉

---

## 🎯 Recommended Setup for HoopGeek

**Domain:** hoopgeek.com  
**Registrar:** Cloudflare ($9.15/year)  
**Hosting:** Vercel (Free tier to start)  
**DNS:** Cloudflare  
**SSL:** Auto-issued by Vercel (free)  

**Total Cost Year 1:** $9.15 (just the domain!)

---

## 📝 Quick Commands Reference

```bash
# Check if domain resolves
ping hoopgeek.com

# Check DNS records
dig hoopgeek.com
dig www.hoopgeek.com

# Check nameservers
nslookup -type=ns hoopgeek.com

# Check SSL certificate
curl -vI https://hoopgeek.com

# Test from different location
# Use: https://dnschecker.org
```

---

## 🆘 Need Help?

### Vercel Domain Support
- Docs: https://vercel.com/docs/concepts/projects/domains
- Support: https://vercel.com/support

### Cloudflare Support
- Community: https://community.cloudflare.com
- Docs: https://developers.cloudflare.com/registrar

### General DNS Help
- DNS Propagation Checker: https://dnschecker.org
- DNS Tutorial: https://www.cloudflare.com/learning/dns/what-is-dns

---

**You're ready! Go get that domain and launch your app! 🚀**

