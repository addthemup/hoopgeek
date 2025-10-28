# Today Page - Quick Reference

## 🎯 At a Glance

**What changed:** Vertical feed → Tab-based layout with newspaper styling

**Primary focus:** DFS Contests (Contests tab is default)

**Game info:** Fixed panel at top when avatar clicked (no scrolling)

---

## 📐 Layout Structure

```
┌─────────────────────────────────────┐
│ Top Navigation (Fixed)               │
├─────────────────────────────────────┤
│ Games Avatar Bar                     │
│ [Click to filter]                    │
├─────────────────────────────────────┤
│ DAILY FANTASY                        │
│ ═══════════════════════════════════ │
│                                      │
│ [IF GAME SELECTED]                   │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│ ┃ 🏀 SELECTED GAME            ┃   │
│ ┃ Teams • Scores • Odds       ┃   │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                      │
│ ┌──────────────────────────────┐   │
│ │ 🏆 | 📊 | ⭐ | 🌟           │   │
│ │ Contests | Stats | Team | P │   │
│ └──────────────────────────────┘   │
│                                      │
│ [TAB CONTENT]                        │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│ ┃ Contest Card                 ┃   │
│ ┃ ⭐ FEATURED ✓ GUARANTEED    ┃   │
│ ┃ Prize Pool: $10,000          ┃   │
│ ┃ [ENTER CONTEST]              ┃   │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                      │
└─────────────────────────────────────┘
```

---

## 🎨 Styling Rules

### Borders:
- Main: `3px solid #000`
- Dividers: `2px solid #000`
- Headers: `4px double #000`

### Shadows:
- Cards: `4px 4px 0px #000`
- Hover: `6px 6px 0px #000`

### Typography:
- Font: `'serif'` (Libre Baskerville)
- Weights: `700`, `900`
- Headers: `textTransform: 'uppercase'`

### Colors:
- Black: `#000` (borders, headers, buttons)
- White: `#fff` (backgrounds)
- Gold: `#FFC72C` (prize pools)
- Green: `#16A34A` (guaranteed)
- Red: `#ef4444` (live)

---

## 📱 Components

### Main Page: `/src/pages/Home.tsx`
- Game info panel (when game selected)
- Tabs navigation
- Contest cards in tabs

### Contest Card: `/src/components/TodayFeed/DFSContestCard.tsx`
- Black header with badges
- Gold prize pool box
- Stats with borders
- Black "ENTER CONTEST" button

### Game Avatar Bar: `/src/components/GamesAvatarBar.tsx`
- Status text at TOP of circle
- Click to filter
- Gold glow when selected

---

## 🎯 User Flow

### Default View:
1. User lands on `/today`
2. Sees DAILY FANTASY header
3. Sees Contests tab (active)
4. Sees all DFS contests

### With Game Filter:
1. User clicks game avatar
2. Game panel appears at top
3. Contests filter to that game
4. No scrolling needed

### Tab Navigation:
1. Click "Your Stats" → See user DFS stats
2. Click "Team of Week" → See best lineup
3. Click "Players" → See players of night

---

## ⚙️ Key Features

1. **No scrolling for game info** - Fixed panel at top
2. **Tabs keep content organized** - Not chaotic feed
3. **DFS is primary** - Contests tab default
4. **Newspaper styling** - Bold borders, serif fonts
5. **MUI Joy components** - Tabs, Cards, Chips, etc.

---

## 🚀 Quick Commands

### To add new contest card styling:
```typescript
<Card sx={{
  border: '3px solid #000',
  borderRadius: 0,
  boxShadow: '4px 4px 0px #000',
  bgcolor: '#fff',
}}>
```

### To add new tab:
```typescript
<Tab
  value={X}
  sx={{
    fontFamily: 'serif',
    fontWeight: 900,
    textTransform: 'uppercase',
    borderRadius: 0,
    '&.Mui-selected': {
      bgcolor: '#000',
      color: '#fff',
    }
  }}
>
  Title
</Tab>
```

### To add newspaper heading:
```typescript
<Typography sx={{
  fontFamily: 'serif',
  fontSize: '2rem',
  fontWeight: 900,
  textTransform: 'uppercase',
  borderBottom: '4px double #000',
  pb: 1,
}}>
  HEADING
</Typography>
```

---

## ✅ Checklist

- [x] Newspaper styling throughout
- [x] Tab-based layout (no feed)
- [x] Game info panel (no scrolling)
- [x] DFS contests are primary
- [x] Matches avatar bar style
- [x] Matches top nav style
- [x] MUI Joy components used
- [x] No linter errors
- [x] Mobile responsive
- [x] All TODO items completed

---

## 📊 Files Changed

1. `/src/pages/Home.tsx` - Complete redesign
2. `/src/components/TodayFeed/DFSContestCard.tsx` - Newspaper styling
3. `/src/components/GamesAvatarBar.tsx` - Status at top

---

## 🎉 Result

A **beautifully organized, newspaper-styled Today page** that puts DFS contests front and center with no scrolling required to see game info! 🏆

