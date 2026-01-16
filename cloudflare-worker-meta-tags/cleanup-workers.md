# Cleanup Guide: Delete Unnecessary Workers

You now have 3 meta-injector workers. Here's what to do:

## Current Workers:

1. ✅ **hoopgeek-meta-injector-production** - KEEP THIS ONE
   - Has routes: `hoop-geek.com/*`
   - 229 requests, actively serving traffic
   - This is the correct one!

2. ❌ **hoopgeek-meta-injector-production-production** - DELETE THIS
   - No routes attached
   - Created accidentally by my mistake
   - Not serving any traffic

3. ❌ **hoopgeek-meta-injector** - DELETE THIS (or keep for testing)
   - No routes attached
   - Old worker, not being used

## How to Delete:

### Option 1: Via Cloudflare Dashboard (Easiest)

1. Go to: https://dash.cloudflare.com
2. Navigate to: **Workers & Pages**
3. Click on: **hoopgeek-meta-injector-production-production**
4. Go to: **Settings** tab
5. Scroll to bottom, click: **Delete Worker**
6. Confirm deletion

7. Repeat for: **hoopgeek-meta-injector** (if you want to delete it)

### Option 2: Via Wrangler CLI

```bash
# Delete the accidental one
npx wrangler delete hoopgeek-meta-injector-production-production

# Delete the old one (optional)
npx wrangler delete hoopgeek-meta-injector
```

## After Cleanup:

You should only have:
- ✅ **hoopgeek-meta-injector-production** (with routes)

## Future Deployments:

Always use:
```bash
npx wrangler deploy
```

**NOT** `npx wrangler deploy --env production` (that would create another duplicate)

The `wrangler.toml` is now configured correctly to deploy directly to `hoopgeek-meta-injector-production` without environment suffixes.

