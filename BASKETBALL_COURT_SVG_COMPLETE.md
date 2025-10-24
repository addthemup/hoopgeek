# Basketball Court SVG Integration ✅

## What Changed

Integrated a **realistic NBA basketball court SVG** into the Matchup Details page with:
- ✅ Full court with accurate markings (3-point arcs, key, free throw circles)
- ✅ **Desktop**: Horizontal court layout
- ✅ **Mobile**: Court rotates 90 degrees for portrait view
- ✅ Player cards overlay on top of court
- ✅ Tab-based navigation for unit selection

## SVG Court Features

### Court Elements
```svg
✅ Court boundary rectangle (#eac696 hardwood color)
✅ Half court line and center circle
✅ Left 3-point arc (Team 1 side)
✅ Right 3-point arc (Team 2 side)
✅ Both keys/painted areas (#116cb6 blue)
✅ Backboards and rims (#b37336 orange)
✅ Restricted areas (semi-circles under baskets)
✅ Free throw circles (solid and dashed)
✅ All regulation court markings
```

### Responsive Behavior

#### Desktop (md+)
```css
width: 100%
height: 70vh (min: 600px)
transform: none (horizontal court)
```

#### Mobile (xs-sm)
```css
width: 100%
height: 60vh (min: 500px)
transform: rotate(90deg)
```

## Layout Structure

### Court Container
```jsx
<Card>
  <Box> {/* Court wrapper */}
    <Box> {/* SVG container with rotation */}
      <svg viewBox="0 0 940 500">
        {/* Court markings */}
      </svg>
    </Box>
    
    <Box> {/* Player overlays - absolute positioned */}
      <Box> {/* Team 1 side (left) */}
        <Card> Team name </Card>
        <Tabs> Starters | Rotation | Bench </Tabs>
        <Box> Player cards grid </Box>
      </Box>
      
      <Box> {/* Team 2 side (right) */}
        <Card> Team name </Card>
        <Box> Player cards grid (synced tabs) </Box>
      </Box>
    </Box>
  </Box>
</Card>
```

## Player Card Improvements

### Compact Design
Made player cards smaller and more compact to fit on court overlay:

**Before:**
- Avatar: 64px
- Padding: 16px
- Width: 120px

**After:**
- Avatar: 40px (mobile) / 50px (desktop)
- Padding: 6px (mobile) / 8px (desktop)
- Width: 70px (mobile) / 90px (desktop)
- Smaller fonts for all text

### Card Features
```typescript
✅ Position badge (top-left, color-coded)
✅ Player avatar with team color border
✅ Player last name (compact)
✅ Fantasy points (or "--" if no games)
✅ Hover animation
✅ Team color border (white vs colored)
```

## Team Layout

### Split Screen Design
- **Left Half**: Team 1 with tab selector
- **Right Half**: Team 2 (follows Team 1's selected tab)
- **Semi-transparent cards**: 90-95% opacity for visibility over court

### Tab Navigation
- Only Team 1 side shows tabs (to save space)
- Both teams display the same unit (Starters/Rotation/Bench)
- Color-coded tabs:
  - 🟢 Starters (success/green)
  - 🟡 Rotation (warning/yellow)
  - ⚫ Bench (neutral/gray)

## Grid Layout

### Player Cards Per Unit

**Desktop:**
- Starters: 3 columns
- Rotation: 2 columns
- Bench: 2 columns

**Mobile:**
- All units: 2 columns

### Responsive Gaps
- Mobile: 4px gap
- Desktop: 8px gap

## SVG Properties

### ViewBox
```svg
viewBox="0 0 940 500"
preserveAspectRatio="xMidYMid slice"
```
- **940 × 500**: Standard court proportions (1.88:1 ratio)
- **xMidYMid slice**: Centers and fills container

### Colors
- **Court floor**: `#eac696` (hardwood tan)
- **Lines**: `#5d5c63` (dark gray)
- **Key areas**: `#116cb6` (basketball blue)
- **Rim/backboard**: `#b37336` (orange/brown)
- **White lines**: `#fff`

## Rotation Logic

### Desktop (md+)
```css
transform: none
/* Court displays normally - horizontal */
```

### Mobile (xs-sm)
```css
transform: rotate(90deg)
transformOrigin: center center
/* Court rotates 90° clockwise for portrait orientation */
```

### Why Rotate?
- Basketball courts are wider than they are tall
- Mobile phones are taller than they are wide (portrait)
- Rotating gives better use of screen space on mobile

## Performance

### Optimizations
- ✅ SVG is inline (no external file)
- ✅ Uses CSS transforms (GPU accelerated)
- ✅ Player cards use React keys for efficient updates
- ✅ Compact cards reduce DOM complexity

## User Experience

### Visual Hierarchy
1. **Court background**: Establishes context
2. **Team sections**: Clear left/right split
3. **Tab selector**: Easy unit switching
4. **Player cards**: Focused information

### Interactive Elements
- ✅ Click tabs to switch units
- ✅ Hover player cards for elevation
- ✅ Scroll if content overflows
- ✅ Works in modal or standalone

## Files Modified

### Updated
- ✅ `src/pages/MatchupDetails.tsx`
  - Added SVG court with full markings
  - Implemented rotation for mobile
  - Made player cards more compact
  - Updated grid layouts
  - Added court overlay structure

### Created
- 📄 `BASKETBALL_COURT_SVG_COMPLETE.md` - This document

## Before & After

### Before
- Generic tabs with side-by-side cards
- No court context
- Large player cards
- No visual basketball theme

### After ✅
- **Realistic NBA court background**
- **Split-screen team layout**
- **Compact, efficient player cards**
- **Rotates 90° on mobile for better fit**
- **Professional basketball aesthetic**

## Technical Details

### SVG Attributes Converted
```
HTML → JSX conversions:
- stroke-width → strokeWidth
- stroke-dasharray → strokeDasharray
- fill → fill
- preserveAspectRatio → preserveAspectRatio
```

### Absolute Positioning
```jsx
<Box sx={{ position: 'relative' }}> {/* Court */}
  <Box sx={{ position: 'absolute', top: 0 }}> {/* Overlay */}
    {/* Player cards */}
  </Box>
</Box>
```

### Z-Index Management
```css
pointerEvents: 'none'  /* Container doesn't block */
'& > *': { pointerEvents: 'auto' }  /* Children are clickable */
```

## Testing Checklist

- [x] Court displays on desktop
- [x] Court rotates on mobile
- [x] Player cards overlay properly
- [x] Tabs switch units
- [x] Both teams show same unit
- [x] Compact cards fit on court
- [x] Hover animations work
- [x] Responsive grid adapts
- [x] No linting errors
- [x] Works in modal
- [x] Scrollable if needed

## Summary

✅ **Beautiful, realistic NBA court background** integrated into matchup details!

### Features
- Full regulation court with all markings
- Rotates 90° for mobile portrait view
- Compact player cards overlay on court
- Tab-based unit selection
- Professional basketball aesthetic
- Fully responsive design

The matchup page now looks like a real basketball game analysis! 🏀

