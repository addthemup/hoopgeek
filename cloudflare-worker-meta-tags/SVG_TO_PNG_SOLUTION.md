# SVG to PNG Conversion for OG Images

## Problem
Many platforms (iMessage, Facebook, etc.) don't support SVG for `og:image` - they need PNG/JPG.

## Solutions

### Option 1: Use Cloudinary (Recommended)
Cloudinary can convert SVG to PNG on-the-fly:

1. Sign up for Cloudinary (free tier: 25GB storage + 25GB bandwidth)
2. Upload SVG to Cloudinary or use URL transformation
3. Update worker to use Cloudinary URL with format conversion

**Implementation:**
```javascript
// In generateFeedPostMetaTags
const cloudinaryUrl = `https://res.cloudinary.com/YOUR_CLOUD/image/fetch/f_png,w_1200,h_630/${encodeURIComponent(imageUrl)}`
```

### Option 2: Use ImgIX
Similar to Cloudinary, can convert SVG to PNG:
```javascript
const imgixUrl = `https://YOUR_IMGIX_DOMAIN.imgix.net/og-image/${postId}.svg?auto=format&fm=png&w=1200&h=630`
```

### Option 3: Use Supabase Edge Function with Canvas (Complex)
Convert in Edge Function using Deno canvas libraries - more complex but no external dependency.

### Option 4: Pre-render HTML and Convert (Most Reliable)
Generate HTML/CSS version and use a headless browser service to convert to PNG:
- ScreenshotAPI
- HTML/CSS to Image API
- Puppeteer Cloud

## Quick Fix: Use Cloudflare Image Resizing (If Available)
Cloudflare might support SVG->PNG conversion via their image resizing feature, but it's not guaranteed.

## Recommendation
Use **Cloudinary** - it's the easiest and most reliable:
1. Free tier is generous
2. Handles SVG->PNG conversion automatically
3. CDN included
4. Just add `?f_png` to the URL



