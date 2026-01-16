# Debug Worker Not Responding

If the worker isn't showing logs when you share a link, follow these steps:

## Step 1: Verify Your Domain

**What domain are you sharing links from?**
- Is it `hoop-geek.com`?
- Is it `hoopgeek.app`?
- Something else?

Check by looking at the actual URL you're copying when sharing.

## Step 2: Check If Worker Is Attached to Routes

### Option A: Via Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com
2. Navigate to: **Workers & Pages**
3. Click on: **hoopgeek-meta-injector**
4. Go to: **Triggers** tab
5. Look for: **Routes** section

**What you should see:**
- A route like: `hoop-geek.com/*` (or your actual domain)
- Status: Active/Enabled

**If you DON'T see routes:**
- The worker is deployed but NOT attached to your domain
- You need to attach it manually (see Step 3)

### Option B: Test Manually

Run this test script:
```bash
cd cloudflare-worker-meta-tags
./test-worker.sh
```

Or test manually:
```bash
# Replace with your actual domain and a real post UUID
curl -A "AppleBot" "https://YOUR-DOMAIN.com/YOUR-POST-UUID" | grep "og:image"
```

If you see `og:image` in the output → Worker is working ✅
If you DON'T see `og:image` → Worker is NOT attached ❌

## Step 3: Attach Worker to Routes

### If Using Cloudflare Pages:

1. Go to: **Workers & Pages** → Your Pages project
2. Go to: **Settings** → **Functions**
3. Under **External Workers**, add:
   - Worker: `hoopgeek-meta-injector`
   - Route: `YOUR-DOMAIN.com/*`

### If Using Regular Cloudflare Workers:

1. Go to: **Workers & Pages** → **hoopgeek-meta-injector**
2. Go to: **Triggers** tab
3. Click: **Add Route**
4. Enter:
   - Route: `YOUR-DOMAIN.com/*`
   - Zone: Select your domain's zone
5. Click: **Save**

## Step 4: Verify Worker Deployment

Check if the worker is actually deployed:

```bash
cd cloudflare-worker-meta-tags
npx wrangler deployments list --env production
```

You should see recent deployments.

## Step 5: Test After Attaching

1. **Start tailing logs:**
   ```bash
   npx wrangler tail --env production
   ```

2. **In another terminal, test with a real UUID:**
   ```bash
   # Get a real post UUID from your database
   curl -A "AppleBot" "https://YOUR-DOMAIN.com/REAL-POST-UUID"
   ```

3. **Check the tail output** - you should see:
   ```
   [Worker] Request: /REAL-POST-UUID
   [Worker] Feed post match: REAL-POST-UUID
   [Worker] OG Image URL: https://...
   ```

## Common Issues

### Issue: "Worker deployed but no routes"
- **Solution**: Attach routes manually via Dashboard (Step 3)

### Issue: "Wrong domain in wrangler.toml"
- **Solution**: Update `wrangler.toml` with correct domain, then redeploy:
  ```bash
  npx wrangler deploy --env production
  ```

### Issue: "Routes attached but worker not running"
- **Solution**: Check if worker is actually deployed:
  ```bash
  npx wrangler deployments list --env production
  ```
  If no deployments, deploy it:
  ```bash
  npx wrangler deploy --env production
  ```

### Issue: "Worker running but logs not showing"
- **Solution**: Make sure you're tailing the correct environment:
  ```bash
  npx wrangler tail hoopgeek-meta-injector --env production
  ```

## Quick Diagnostic Commands

```bash
# 1. Check if logged in
npx wrangler whoami

# 2. List deployments
npx wrangler deployments list --env production

# 3. Tail logs (watch for requests)
npx wrangler tail --env production

# 4. Test a URL (in another terminal)
curl -A "AppleBot" "https://YOUR-DOMAIN.com/YOUR-POST-UUID" | grep "og:image"
```

