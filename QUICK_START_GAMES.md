# 🏀 Quick Start: Your 500 Game Files

## ⚡ Get Your Games Feed Running in 2 Minutes

You have 500 JSON game files ready to go. Here's how to see them in action:

### Step 1: Generate the Index (Required)

```bash
node scripts/generate_game_index.js
```

This creates a lightweight index from all your JSON files. Without this, the app would try to load 15GB of JSON on every page load! 💥

**Expected output:**
```
🏀 Generating game index...
Found 500 game files
...
✅ Index generation complete!
```

### Step 2: Start the App

```bash
npm run dev
```

### Step 3: Visit the Homepage

Open `http://localhost:3000`

You should see a beautiful feed of all 500 games ranked by the algorithm!

---

## 🎯 What You Get

### Home Page Feed (`/`)
- **500 games** ranked by fun score + recency
- **Responsive grid**: 3 columns → 2 → 1 (desktop → tablet → mobile)
- **Smart algorithm**: High fun score games always rank well, recent games get priority, old classics can randomly surface
- **Beautiful cards** with:
  - Fun score badges (color-coded)
  - Final scores
  - Highlight chips (buzzer beaters, dunks, etc.)
  - Play button on hover

### Game Detail Page (`/game/:gameId`)
- Full game story from your JSON
- "How [Team] Won" analysis
- All excitement metrics
- Player milestones
- Team statistics
- Video player (when you add videos)

---

## 🔍 How It Works

### The Problem
- 500 JSON files × 30,000 lines = 15,000,000 lines of JSON
- Loading all on page load = 💀

### The Solution
1. **Index file** contains only feed data (2-5 MB)
2. **Home page** loads the index instantly
3. **Game pages** load individual files only when clicked

### Architecture
```
User visits / 
  → Loads games-index.json (2MB, instant)
  → Displays feed

User clicks game
  → Dynamically imports specific game JSON (30K lines)
  → Shows full details
```

---

## 📁 Your File Structure

```
src/assets/json/
├── 0022100062.json          ← Your game files (30K lines each)
├── 0022100063.json
├── ... (500 files)
└── games-index.json          ← Generated index (2-5 MB)
```

---

## ⚙️ Scripts Available

### `generate_game_index.js`
**What**: Creates lightweight index from all games  
**When**: Run once, then whenever you add new games  
**Output**: `src/assets/json/games-index.json`

```bash
node scripts/generate_game_index.js
```

### `upload_games_to_supabase.js`
**What**: Uploads game metadata to database  
**When**: When ready for production deployment  
**Requires**: Supabase setup (see full docs)

```bash
# Later, when you want to use a database
node scripts/upload_games_to_supabase.js
```

---

## 🎨 Customization

### Change Feed Algorithm

Edit `calculateFeedScore()` in `src/pages/Home.tsx`:

```typescript
const calculateFeedScore = (game: GameData): number => {
  // Current: 70% fun score, 30% recency
  const funScoreWeight = 0.7  // ← Adjust this
  const recencyWeight = 0.3   // ← And this
  
  // Make recency more important
  const funScoreWeight = 0.5
  const recencyWeight = 0.5
}
```

### Add Filters

```typescript
// Filter by team
const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

const filteredGames = sortedGames.filter(game => {
  if (!selectedTeam) return true
  return game.story.teams.winner.tricode === selectedTeam ||
         game.story.teams.loser.tricode === selectedTeam
})
```

### Add Pagination

```typescript
const [page, setPage] = useState(1)
const GAMES_PER_PAGE = 20

const displayedGames = sortedGames.slice(0, page * GAMES_PER_PAGE)

// Add "Load More" button
<Button onClick={() => setPage(p => p + 1)}>
  Load More
</Button>
```

---

## 📚 Full Documentation

- **Complete guide**: `scripts/README_GAME_JSON_UPLOAD.md`
- **Feed/GamePage docs**: `GAME_FEED_README.md`

---

## 🐛 Troubleshooting

### "Cannot find module games-index.json"
**Solution**: Run `node scripts/generate_game_index.js`

### No games showing on homepage
1. Check browser console for errors
2. Verify `games-index.json` exists and isn't empty
3. Make sure you ran the generation script

### Game page shows "Loading game..." forever
1. Check that the game file exists with that ID
2. Check browser console for import errors
3. Verify JSON file is valid JSON

### TypeScript errors
1. Restart TypeScript server in your IDE
2. Run `npm run build` to check for real errors
3. Check `src/assets/json/json.d.ts` exists

---

## ✨ That's It!

Your 500 game files are now powering a beautiful, fast game highlights feed. The algorithm ensures the most exciting games get the spotlight! 🔥

**Questions?** Check the full documentation in `scripts/README_GAME_JSON_UPLOAD.md`

