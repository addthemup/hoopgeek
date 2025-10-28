# Open Graph Image Guide for DFS Sharing

This guide helps you create the perfect social sharing image for your DFS contest links.

## 📐 Image Specifications

### Required Specs
- **Dimensions**: 1200 x 630 pixels (1.91:1 aspect ratio)
- **Format**: JPG or PNG
- **File size**: Under 1MB (smaller is better for loading speed)
- **File name**: `dfs-og-image.jpg`
- **Location**: `public/dfs-og-image.jpg`

### Platform-Specific Requirements

| Platform | Min Size | Max Size | Recommended |
|----------|----------|----------|-------------|
| Facebook | 200x200 | 8192x8192 | 1200x630 |
| Twitter | 300x157 | 4096x4096 | 1200x630 |
| LinkedIn | 1200x627 | - | 1200x627 |
| WhatsApp | - | - | 1200x630 |
| iMessage | - | - | 1200x630 |

**Note**: 1200x630 works perfectly across all platforms!

## 🎨 Design Guidelines

### Safe Zones
Social platforms crop images differently on mobile vs desktop. Use these zones:

```
┌─────────────────────────────────────────┐
│ CROP ZONE (may be hidden on mobile)    │
├─────────────────────────────────────────┤
│                                         │
│   SAFE ZONE (always visible)           │
│   Place logo + key text here           │
│   Center: 1200 x 400 pixels            │
│                                         │
├─────────────────────────────────────────┤
│ CROP ZONE (may be hidden on mobile)    │
└─────────────────────────────────────────┘
```

**Safe Zone**: Center 1200 x 400 pixels (leave 115px padding top/bottom)

### Content Recommendations

#### Essential Elements
1. **Logo** - Top center or top left
2. **Main Text** - "Join Daily Fantasy Basketball Contest"
3. **Brand Color** - Use your primary brand color
4. **Basketball Theme** - Court, ball, or player silhouette

#### Optional Elements
- NBA logo (if licensed)
- Trophy/prize icon
- "Compete & Win" tagline
- Website URL

### Design Examples

#### Option 1: Minimal & Clean
```
┌─────────────────────────────────────────┐
│                                         │
│           [HoopGeek Logo]              │
│                                         │
│    Join Daily Fantasy Basketball       │
│           Contest                       │
│                                         │
│         🏀 Compete & Win 🏆            │
│                                         │
└─────────────────────────────────────────┘
Background: Gradient (primary to secondary color)
Text: White, bold, centered
```

#### Option 2: Basketball Court
```
┌─────────────────────────────────────────┐
│  [Logo]           [Basketball Court]    │
│                   Background Image      │
│                                         │
│  Join Daily Fantasy Basketball         │
│  Build Your Lineup · Track Live        │
│  Compete for Prizes                    │
│                                         │
└─────────────────────────────────────────┘
Background: Basketball court (subtle opacity)
Text: White with subtle shadow for readability
```

#### Option 3: Action Hero
```
┌─────────────────────────────────────────┐
│  [Basketball Player Silhouette]        │
│  [in action, shooting]                 │
│                                         │
│  HoopGeek                              │
│  DAILY FANTASY BASKETBALL              │
│  hoopgeek.app                          │
│                                         │
└─────────────────────────────────────────┘
Background: Your brand color with gradient
Image: Player silhouette in contrasting color
```

## 🛠️ Tools & Resources

### Design Tools

**Free Tools**:
- [Canva](https://www.canva.com/) - Easy templates (use "Facebook Post" template)
- [Figma](https://www.figma.com/) - Professional design tool
- [GIMP](https://www.gimp.org/) - Free Photoshop alternative
- [Photopea](https://www.photopea.com/) - Online Photoshop clone

**Premium Tools**:
- Adobe Photoshop
- Sketch
- Affinity Designer

### Free Assets

**Basketball Images**:
- [Unsplash](https://unsplash.com/s/photos/basketball) - Free high-quality photos
- [Pexels](https://www.pexels.com/search/basketball/) - Free stock photos
- [Pixabay](https://pixabay.com/images/search/basketball/) - Free images

**Icons**:
- [Font Awesome](https://fontawesome.com/) - Basketball, trophy icons
- [Heroicons](https://heroicons.com/) - Simple, clean icons
- [Iconoir](https://iconoir.com/) - Open-source icons

### Canva Template (Quick Start)

1. Go to [Canva.com](https://www.canva.com/)
2. Search for "Facebook Post" (1200x630 automatically)
3. Choose a sports template
4. Customize:
   - Replace text with "Join Daily Fantasy Basketball Contest"
   - Add your logo
   - Change colors to match your brand
   - Add basketball elements
5. Download as JPG
6. Save as `dfs-og-image.jpg` in your `public/` folder

## ✅ Checklist

Before using your image:

- [ ] Dimensions are exactly 1200 x 630 pixels
- [ ] File size is under 1MB (ideally 300-500KB)
- [ ] Text is readable on both light and dark backgrounds
- [ ] Logo is clear and recognizable
- [ ] Image looks good when cropped to square (mobile view)
- [ ] Colors match your brand
- [ ] No copyrighted content without permission
- [ ] File saved as `public/dfs-og-image.jpg`
- [ ] Text has good contrast against background
- [ ] Tested on multiple platforms (Facebook debugger, Twitter validator)

## 🧪 Testing Your Image

### Facebook Debugger
1. Go to https://developers.facebook.com/tools/debug/
2. Enter: `https://hoopgeek.app/dfs/join/test`
3. Click "Debug"
4. Check if image loads correctly
5. Click "Scrape Again" to refresh cache

### Twitter Card Validator
1. Go to https://cards-dev.twitter.com/validator
2. Enter: `https://hoopgeek.app/dfs/join/test`
3. Click "Preview Card"
4. Verify image displays correctly

### Manual Test
1. Upload image to your site
2. Share a DFS pool link in iMessage/WhatsApp
3. Verify the preview looks good
4. Check on both mobile and desktop

## 🎯 Pro Tips

### Typography
- Use **bold, sans-serif fonts** for readability
- Minimum font size: 60px for main text
- Add subtle text shadow for contrast: `0 2px 4px rgba(0,0,0,0.3)`

### Colors
- **High contrast** between text and background
- Test in grayscale to ensure readability
- Use your brand's primary color as background
- White or very light text usually works best

### Composition
- **Rule of thirds** - Place key elements along 1/3 lines
- **Balance** - Don't put everything on one side
- **Hierarchy** - Biggest = most important (usually your logo + main text)

### File Optimization
After creating your image:

1. **Compress it**:
   - [TinyPNG](https://tinypng.com/) - Reduces file size without quality loss
   - [Squoosh](https://squoosh.app/) - Google's image optimizer

2. **Target size**: 
   - Aim for 200-500KB
   - Under 1MB is mandatory

## 📊 A/B Testing

Try multiple versions and see which gets more clicks:

### Version A: Minimal
- Simple gradient background
- Logo + text only
- Clean, professional

### Version B: Action
- Basketball court background
- Dynamic, exciting
- More visual interest

### Version C: Social Proof
- "Join 10,000+ players"
- Trophy/winner imagery
- Trust-building

Track click-through rates and conversions for each version.

## 🔄 Updating Your Image

When you update `dfs-og-image.jpg`:

1. **Clear caches**:
   ```bash
   # Purge Cloudflare cache
   # Go to Cloudflare Dashboard → Caching → Purge Cache
   # Select "Purge by single file" → Enter image URL
   ```

2. **Refresh social platform caches**:
   - Facebook: Use debugger tool to "Scrape Again"
   - Twitter: Use card validator
   - LinkedIn: Use post inspector

3. **Test** the new image by sharing a link

## 📱 Mobile Preview

Most people share on mobile, so test there:

### iMessage (iOS)
- Image shows as 2:1 landscape card
- Text appears below image
- Tapping opens link in Safari

### WhatsApp
- Image shows with title/description overlay
- Slightly smaller than iMessage
- Tapping opens in-app browser

### Instagram DM
- Compact preview
- Image is smaller
- Less text shown

**Tip**: Make sure your logo and main text are center-focused for mobile viewing!

## 🎨 Example Design Prompt (for AI tools)

If using DALL-E, Midjourney, or similar:

```
Create a 1200x630 pixel social media image for a daily fantasy 
basketball app called "HoopGeek". Include a basketball court 
background with a gradient overlay in blue and purple. Center 
the text "Join Daily Fantasy Basketball Contest" in bold white 
letters. Add a subtle basketball icon and make it modern, 
clean, and professional. Leave space at the top for a logo.
```

## 🏁 Quick Start (5 Minutes)

1. **Use Canva**:
   - Search "Facebook Post"
   - Pick a sports template
   - Edit text to "Join Daily Fantasy Basketball Contest"
   - Download as JPG

2. **Optimize**:
   - Upload to [TinyPNG](https://tinypng.com/)
   - Download compressed version

3. **Deploy**:
   - Save as `public/dfs-og-image.jpg`
   - Push to git
   - Wait for Cloudflare Pages to deploy

4. **Test**:
   - Share a DFS link in iMessage
   - 🎉 See your beautiful preview!

---

**Need help?** Check the main guide: `DFS_SOCIAL_SHARING_SETUP.md`

🏀 **Go create an awesome image!**

