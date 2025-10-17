# Game JSON Upload & Integration Guide

## Overview

You have **500+ JSON game files** (~30K lines each) in `/src/assets/json/`. This guide shows you how to integrate them into your HoopGeek app efficiently.

## 📁 What's Been Created

### 1. **Game Loader Utility** (`/src/utils/gameLoader.ts`)
- Handles loading games from JSON files
- Provides TypeScript interfaces matching your data structure
- Includes helper functions for filtering and searching

### 2. **Index Generator** (`/scripts/generate_game_index.js`)
- Creates a lightweight index file (~1-5 MB) from all games
- Extracts only essential data for the feed (not 30K lines per game)
- Enables fast page loads without loading 500 files at once

### 3. **Database Upload Script** (`/scripts/upload_games_to_supabase.js`)
- For production: Imports game metadata to Supabase
- Enables fast queries and filtering
- Full JSON files remain for detailed game pages

### 4. **Updated Components**
- `Home.tsx`: Now uses `getAllGames()` from gameLoader
- `GamePage.tsx`: Now uses `getGameById()` to load individual games

## 🚀 Quick Start (Development)

### Step 1: Generate the Games Index

This creates a lightweight file that loads instantly instead of parsing 500 massive files:

```bash
# From project root
node scripts/generate_game_index.js
```

**What it does:**
- Scans all JSON files in `/src/assets/json/`
- Extracts only feed data (gameId, date, fun_score, story summary, etc.)
- Creates `/src/assets/json/games-index.json` (~1-5 MB vs ~15 GB for all files)
- Shows stats: average fun score, top 5 games, etc.

**Output example:**
```
🏀 Generating game index...

Found 500 game files
Processed 50/500 games...
Processed 100/500 games...
...

✅ Index generation complete!
📊 Stats:
   - Total games: 500
   - Successfully processed: 500
   - Errors: 0
   - Index file: /src/assets/json/games-index.json
   - Index size: 2.34 MB

🔥 Fun Score Stats:
   - Average: 85.2
   - Top 5 Games:
     1. Memphis Grizzlies vs Sacramento Kings (98.7)
     2. Miami Heat vs Philadelphia 76ers (96.3)
     3. Los Angeles Lakers vs Boston Celtics (94.5)
     4. Milwaukee Bucks vs Phoenix Suns (91.8)
     5. Sacramento Kings vs Phoenix Suns (90.1)
```

### Step 2: Start Your Dev Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your games feed!

## 📊 Data Flow

### Development (File-Based)
```
User visits Home page
  ↓
Loads games-index.json (fast!)
  ↓
Displays feed with algorithm
  ↓
User clicks game
  ↓
Dynamically imports specific game JSON
  ↓
Shows full game details
```

### Production (Database + Files)
```
User visits Home page
  ↓
Query Supabase for game metadata (super fast!)
  ↓
Displays feed with algorithm
  ↓
User clicks game
  ↓
Fetch full JSON from storage OR load from assets
  ↓
Shows full game details
```

## 🗄️ Database Setup (Production)

### Step 1: Create the Games Table

Run this SQL in your Supabase SQL editor:

```sql
CREATE TABLE games (
  game_id TEXT PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL,
  fun_score DECIMAL NOT NULL DEFAULT 0,
  
  -- Story data
  matchup TEXT,
  final_score TEXT,
  winner_tricode TEXT,
  winner_city TEXT,
  winner_points INTEGER,
  loser_tricode TEXT,
  loser_city TEXT,
  loser_points INTEGER,
  
  -- Excitement metrics
  lead_changes INTEGER DEFAULT 0,
  lead_changes_5min INTEGER DEFAULT 0,
  lead_changes_1min INTEGER DEFAULT 0,
  buzzer_beaters INTEGER DEFAULT 0,
  total_dunks INTEGER DEFAULT 0,
  deep_threes INTEGER DEFAULT 0,
  four_pointers INTEGER DEFAULT 0,
  
  -- Full JSON (optional - for backup)
  full_data JSONB,
  
  -- Media
  thumbnail_url TEXT,
  video_url TEXT,
  
  -- Engagement
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  
  -- Metadata
  arena TEXT,
  season TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_games_date ON games(date DESC);
CREATE INDEX idx_games_fun_score ON games(fun_score DESC);
CREATE INDEX idx_games_date_fun_score ON games(date DESC, fun_score DESC);
CREATE INDEX idx_games_winner_tricode ON games(winner_tricode);
CREATE INDEX idx_games_loser_tricode ON games(loser_tricode);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access
CREATE POLICY "Allow public read access"
  ON games FOR SELECT
  USING (true);
```

### Step 2: Set Up Environment Variables

Add to your `.env` file:

```bash
# Your existing Supabase URL (should already be there)
VITE_SUPABASE_URL=https://your-project.supabase.co

# Service key for admin operations (from Supabase dashboard)
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

⚠️ **Never commit `.env` to git!** Add it to `.gitignore`.

### Step 3: Upload Games to Database

```bash
node scripts/upload_games_to_supabase.js
```

**What it does:**
- Reads all JSON files
- Extracts metadata
- Uploads to Supabase in batches of 100
- Uses upsert (so you can run multiple times safely)

**Output example:**
```
🏀 Uploading games to Supabase...

Found 500 game files

✅ Uploaded batch 1 (100/500)
✅ Uploaded batch 2 (200/500)
...
✅ Uploaded batch 5 (500/500)

📊 Upload Summary:
   - Total files: 500
   - Successfully uploaded: 500
   - Errors: 0

✅ Games uploaded to Supabase!

💡 Update your gameLoader.ts to fetch from Supabase:
   - Use supabase.from("games").select() for the feed
   - Keep full JSON files for detailed game pages
```

### Step 4: Update gameLoader.ts for Production

Replace the `getAllGames()` function in `/src/utils/gameLoader.ts`:

```typescript
import { supabase } from './supabase'

export async function getAllGames(): Promise<GameData[]> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('date', { ascending: false })
    
    if (error) throw error
    
    // Transform database format to GameData interface
    return data.map(transformDbToGameData)
  } catch (error) {
    console.error('Error loading games from database:', error)
    return []
  }
}

function transformDbToGameData(dbGame: any): GameData {
  return {
    gameId: dbGame.game_id,
    date: dbGame.date,
    fun_score: parseFloat(dbGame.fun_score),
    story: {
      matchup: dbGame.matchup,
      final_score: dbGame.final_score,
      teams: {
        winner: {
          city: dbGame.winner_city,
          tricode: dbGame.winner_tricode,
          points: dbGame.winner_points,
          name: '', // Not stored in DB
          teamId: 0
        },
        loser: {
          city: dbGame.loser_city,
          tricode: dbGame.loser_tricode,
          points: dbGame.loser_points,
          name: '',
          teamId: 0
        }
      },
      advantages: [] // Load from full JSON if needed
    },
    lead_changes: {
      total: dbGame.lead_changes,
      last_5_minutes: dbGame.lead_changes_5min,
      last_minute: dbGame.lead_changes_1min,
      buzzer_beater: dbGame.buzzer_beaters
    },
    dunk_stats: {
      'Total Dunks': dbGame.total_dunks,
      'Alley Oop': 0, // Not in DB
      'Putback': 0
    },
    deep_shots: {
      deep_threes: dbGame.deep_threes,
      four_pointers: dbGame.four_pointers
    },
    thumbnail_url: dbGame.thumbnail_url,
    video_url: dbGame.video_url,
    views: dbGame.views,
    likes: dbGame.likes
  }
}
```

## 📈 Performance Comparison

### File-Based (Current)
| Operation | Time | Size |
|-----------|------|------|
| Load all games (index) | ~50ms | 2-5 MB |
| Load single game | ~100ms | ~30K lines |
| Filter by date | ~10ms | In-memory |
| Search by team | ~10ms | In-memory |

### Database (Production)
| Operation | Time | Size |
|-----------|------|------|
| Load all games | ~100ms | Network req |
| Load single game | ~100ms | JSON + Network |
| Filter by date | ~50ms | SQL query |
| Search by team | ~50ms | Indexed SQL |
| Pagination | Fast | SQL LIMIT/OFFSET |

## 🎯 Best Practices

### When to Use Files
✅ Development and testing  
✅ Small-scale deployments  
✅ When you need full game data always  
✅ Prototyping and demos  

### When to Use Database
✅ Production deployments  
✅ Large datasets (500+ games)  
✅ Need for fast filtering/searching  
✅ User analytics (views, likes)  
✅ Real-time updates  

## 🔄 Update Workflow

When you add new games:

```bash
# 1. Place new JSON files in src/assets/json/

# 2. Regenerate index for development
node scripts/generate_game_index.js

# 3. Upload to database for production
node scripts/upload_games_to_supabase.js

# 4. Commit (don't commit huge JSON files!)
git add src/assets/json/games-index.json
git commit -m "Update games index"
```

## 🔍 Troubleshooting

### Index generation fails
- Check JSON file syntax
- Ensure all files have required fields (gameId, date)
- Check disk space

### Database upload fails
- Verify `.env` credentials
- Check Supabase dashboard for quota limits
- Review SQL table creation
- Check for network issues

### Games not showing on homepage
- Check browser console for errors
- Verify `games-index.json` exists
- Check file imports in `gameLoader.ts`
- Ensure JSON structure matches interfaces

### Individual game page errors
- Verify gameId in URL matches filename
- Check JSON file exists for that game
- Review browser console for import errors

## 📚 File Structure

```
hoopgeek/
├── src/
│   ├── assets/
│   │   └── json/
│   │       ├── 0022100062.json       # Individual game (30K lines)
│   │       ├── 0022100063.json
│   │       ├── ... (500 files)
│   │       └── games-index.json      # Generated index (2-5 MB)
│   │
│   ├── pages/
│   │   ├── Home.tsx                  # Uses getAllGames()
│   │   └── GamePage.tsx              # Uses getGameById()
│   │
│   └── utils/
│       └── gameLoader.ts             # Loading logic
│
└── scripts/
    ├── generate_game_index.js        # Creates index
    └── upload_games_to_supabase.js   # Uploads to DB
```

## 💡 Pro Tips

1. **Keep JSON files in .gitignore** (except the index)
   ```gitignore
   # .gitignore
   src/assets/json/*.json
   !src/assets/json/games-index.json
   ```

2. **Use Supabase Storage for videos**
   - Upload video files to Supabase Storage
   - Store URLs in database
   - Serves videos with CDN

3. **Add pagination to feed**
   ```typescript
   const GAMES_PER_PAGE = 20
   const [page, setPage] = useState(1)
   const displayedGames = sortedGames.slice(0, page * GAMES_PER_PAGE)
   ```

4. **Add search and filters**
   ```typescript
   const filteredGames = games.filter(game => 
     game.story.teams.winner.tricode === selectedTeam ||
     game.story.teams.loser.tricode === selectedTeam
   )
   ```

5. **Optimize images**
   - Generate thumbnails at 800x450px
   - Use WebP format
   - Store in Supabase Storage or CDN

## 🎉 Summary

You now have:
✅ 500 games integrated into your app  
✅ Fast feed loading with lightweight index  
✅ Detailed game pages with full JSON  
✅ Algorithm-based social media feed  
✅ Database migration path for production  
✅ Scripts to automate everything  

**Next Steps:**
1. Run `node scripts/generate_game_index.js`
2. Start dev server and see your games!
3. When ready for production, set up Supabase and upload

Happy coding! 🏀🔥

