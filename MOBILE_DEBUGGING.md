# Mobile Debugging Guide

## Quick Debugging Methods

### 1. On-Screen Debug Panel (Already Added)
- A red debug bar appears at the top of avatar bars on mobile
- Shows: Items count, Visible count, Loading state, Loaded count
- No setup needed - just visible on screen

### 2. iOS Safari Remote Debugging

**Setup:**
1. Connect iPhone to Mac via USB
2. On iPhone: Settings → Safari → Advanced → Enable "Web Inspector"
3. On Mac: Open Safari → Develop menu → Select your iPhone → Select your website

**Usage:**
- Console logs will appear in Safari's Web Inspector
- You can inspect elements, see network requests, etc.

### 3. Android Chrome Remote Debugging

**Setup:**
1. Connect Android device to computer via USB
2. On Android: Settings → Developer Options → Enable "USB Debugging"
3. On computer: Open Chrome → Go to `chrome://inspect` → Click "Inspect" next to your device

**Usage:**
- Full Chrome DevTools access
- Console, Network, Elements tabs all work

### 4. Desktop Browser Emulation

**Chrome:**
- Press F12 → Click device toolbar icon (or Ctrl+Shift+M)
- Select device from dropdown
- Note: Not 100% accurate but good for quick testing

**Firefox:**
- Press F12 → Click responsive design mode (Ctrl+Shift+M)
- Select device from dropdown

### 5. Console Logs via Alert (Temporary)

If you need to see logs without dev tools, we can add temporary `alert()` calls:
```javascript
alert(`Items: ${items.length}, Loading: ${isLoading}`);
```

## Current Debug Features

The AvatarBar component now includes:
- ✅ On-screen debug panel (red bar at top)
- ✅ Console logging with emoji prefixes (🎨, 📱, ⚠️)
- ✅ Visible error message if no items found
- ✅ First item logging for detailed inspection

## What to Look For

When debugging avatar issues, check:
1. **Items count**: Should be > 0 if games/posts exist
2. **Loading state**: Should be false when data is ready
3. **Visible count**: Should match items count on mobile
4. **First item data**: Check if item structure is correct

