# Game Modal - Live Player Stats with FanDuel Fantasy Points

## 🎯 Goal
Display live player statistics with calculated FanDuel fantasy points when clicking a game avatar on the Today page.

---

## ✅ What Was Added

### **1. New Hook: `useLivePlayerStats`**

**File:** `/src/hooks/useLivePlayerStats.ts`

**Purpose:** Fetches live player stats from the `live_player_stats` table and calculates FanDuel fantasy points.

**Features:**
- ✅ Fetches player stats for a specific game
- ✅ Calculates FanDuel fantasy points using `fantasyScoring.ts`
- ✅ Separates players by team (away/home)
- ✅ Sorts players by fantasy points (descending)
- ✅ Auto-refetches every 30 seconds for live games
- ✅ Handles null/empty game states gracefully

**Data Structure:**
```typescript
interface LivePlayerStat {
  nba_player_id: number;
  player_name: string;
  team_tricode: string;
  stats: {
    pts, reb, ast, stl, blk, tov, 
    fgm, fga, fg3m, fg3a, ftm, fta,
    oreb, dreb, pf, min, plus_minus
  };
  updated_at: string;
  fantasy_points: number; // ← Calculated FanDuel points
}

interface LivePlayerStatsResponse {
  awayTeam: LivePlayerStat[];
  homeTeam: LivePlayerStat[];
}
```

**FanDuel Scoring Used:**
```typescript
Points:     1.0 per point
Rebounds:   1.2 per rebound
Assists:    1.5 per assist
Steals:     2.0 per steal
Blocks:     2.0 per block
Turnovers: -1.0 per turnover
```

---

### **2. Updated: `Home.tsx` Modal**

**Changes:**
1. ✅ Added `useLivePlayerStats` hook import
2. ✅ Added hook call: `useLivePlayerStats(selectedGameId)`
3. ✅ Added player stats section to modal
4. ✅ Made modal scrollable (`overflow: 'auto'`, `maxHeight: '90vh'`)
5. ✅ Added loading indicator for stats

**Modal Structure:**
```
┌─────────────────────────────────┐
│ [Close Button]                  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Game Header (Black BG)      │ │
│ │ LAL vs GSW                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Teams & Score               │ │
│ │ LAL  95                     │ │
│ │ GSW 102                     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Betting Lines (if available)│ │
│ └─────────────────────────────┘ │
│                                 │
│ ─────────────────────────────── │ ← NEW SECTION
│                                 │
│ ┌─────────────────────────────┐ │
│ │ PLAYER STATS (FANDUEL)      │ │
│ │                             │ │
│ │ LAL Players                 │ │
│ │ ┌─────────────────────────┐ │ │
│ │ │ LeBron James      [45.2]│ │ │
│ │ │ 28 PTS • 8 REB • 7 AST  │ │ │
│ │ └─────────────────────────┘ │ │
│ │ ┌─────────────────────────┐ │ │
│ │ │ Anthony Davis     [42.8]│ │ │
│ │ │ 24 PTS • 12 REB • 3 AST │ │ │
│ │ └─────────────────────────┘ │ │
│ │ ... (top 5)                 │ │
│ │                             │ │
│ │ GSW Players                 │ │
│ │ ┌─────────────────────────┐ │ │
│ │ │ Stephen Curry     [51.3]│ │ │
│ │ │ 32 PTS • 6 REB • 9 AST  │ │ │
│ │ └─────────────────────────┘ │ │
│ │ ... (top 5)                 │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Scrollable if needed]          │
└─────────────────────────────────┘
```

---

## 🎨 Styling Details

### **Player Card:**
```typescript
<Box sx={{
  display: 'flex',
  justifyContent: 'space-between',
  py: 1,
  px: 1.5,
  bgcolor: '#f0f0f0',        // Light grey background
  border: '2px solid #000',  // Black border
  borderRadius: 0,           // Square corners
}}>
  <Box sx={{ flex: 1 }}>
    {/* Player name - Bold, black */}
    <Typography sx={{ fontFamily: 'serif', fontWeight: 900 }}>
      LeBron James
    </Typography>
    {/* Stats line - Bold, black */}
    <Typography sx={{ fontFamily: 'serif', fontSize: '0.75rem' }}>
      28 PTS • 8 REB • 7 AST • 2 STL • 1 BLK
    </Typography>
  </Box>
  {/* Fantasy points chip */}
  <Chip sx={{
    bgcolor: '#FFC72C',        // Gold background
    color: '#000',             // Black text
    border: '2px solid #000',  // Black border
    borderRadius: 0,           // Square corners
    fontWeight: 900,
    fontSize: '1rem',
    minWidth: '60px',
  }}>
    45.2
  </Chip>
</Box>
```

### **Section Header:**
```typescript
<Typography sx={{ 
  fontFamily: 'serif',
  fontSize: '1rem',
  fontWeight: 900,
  textTransform: 'uppercase',
  mb: 2,
}}>
  Player Stats (FanDuel Fantasy Points)
</Typography>
```

### **Team Header:**
```typescript
<Typography sx={{ 
  fontFamily: 'serif',
  fontSize: '0.9rem',
  fontWeight: 900,
  mb: 1.5,
  color: getTeamPrimaryColor('LAL'), // Team's primary color
}}>
  LAL Players
</Typography>
```

---

## 📊 Data Flow

### **1. User Clicks Game Avatar**
```
User clicks game avatar
    ↓
setSelectedGameId(gameId)
    ↓
useLivePlayerStats(gameId) fires
```

### **2. Hook Fetches Data**
```
useLivePlayerStats(gameId)
    ↓
Query Supabase: live_player_stats
    WHERE game_id = gameId
    ORDER BY team_tricode, stats->pts DESC
    ↓
Receive player data with stats
```

### **3. Calculate Fantasy Points**
```
For each player:
    stats = player.stats
    ↓
    Calculate FanDuel points:
    - pts × 1.0
    - reb × 1.2
    - ast × 1.5
    - stl × 2.0
    - blk × 2.0
    - tov × -1.0
    ↓
    fantasy_points = total
```

### **4. Separate by Team**
```
All players with fantasy_points
    ↓
Separate by team_tricode
    ↓
awayTeam = players where team = teams[0]
homeTeam = players where team = teams[1]
    ↓
Sort each by fantasy_points DESC
```

### **5. Display in Modal**
```
Modal shows:
- Away team: Top 5 players by fantasy points
- Home team: Top 5 players by fantasy points
- Each with stats line: PTS • REB • AST • STL • BLK
- Gold chip: Fantasy points (1 decimal)
```

---

## 🔄 Auto-Refresh

**Live Games:**
```typescript
refetchInterval: 30000,  // Refetch every 30 seconds
staleTime: 15000,        // Data stale after 15 seconds
```

**Why 30 seconds?**
- ✅ Balances freshness with API load
- ✅ Good for live games (stats update frequently)
- ✅ Not too aggressive (avoids rate limits)
- ✅ User sees updated stats quickly

**Disabling:**
```typescript
enabled: !!gameId,  // Only fetch when game is selected
```
- Hook only runs when a game is clicked
- Stops fetching when modal is closed

---

## 📱 Responsive Design

### **Modal Sizing:**
```typescript
maxWidth: { xs: '90vw', sm: '600px', md: '700px' }
maxHeight: '90vh'
overflow: 'auto'
```

**Desktop (md):**
- Modal: 700px wide
- Shows all content nicely
- Scrolls if player list is long

**Tablet (sm):**
- Modal: 600px wide
- Slightly narrower
- Still readable

**Mobile (xs):**
- Modal: 90% viewport width
- Maximizes screen space
- Stacks player info vertically

---

## 🎯 Benefits

### **1. Real-Time Fantasy Context**
- ✅ See how players are performing **right now**
- ✅ FanDuel points calculated instantly
- ✅ Compare players across teams
- ✅ Make better DFS lineup decisions

### **2. Engagement**
- ✅ Users stay on your site to check scores
- ✅ Fantasy points = actionable data
- ✅ Encourages DFS participation
- ✅ Creates "stickiness" during games

### **3. Information Density**
- ✅ Score, odds, **and** player stats in one modal
- ✅ No need to visit multiple sites
- ✅ Quick scan of top performers
- ✅ All in newspaper-style UI

### **4. Performance**
- ✅ Only fetches when modal is open
- ✅ 30-second refresh is reasonable
- ✅ Indexed database queries (fast)
- ✅ Lightweight JSON data

---

## 📁 Files Modified/Created

### **Created:**
1. **`/src/hooks/useLivePlayerStats.ts`**
   - New hook for fetching live player stats
   - Integrates with `fantasyScoring.ts`
   - Auto-refresh for live games
   - Separates teams and sorts by fantasy points

### **Modified:**
2. **`/src/pages/Home.tsx`**
   - Added `useLivePlayerStats` import
   - Added hook call with `selectedGameId`
   - Added player stats section to modal
   - Made modal scrollable (`maxHeight: '90vh'`, `overflow: 'auto'`)
   - Added loading indicator

---

## 🧪 Testing Scenarios

### **1. Game with Live Stats**
- Click game avatar
- Modal opens with score, odds, **and player stats**
- Top 5 players per team shown
- Fantasy points displayed in gold chips
- Stats line shows: PTS, REB, AST, STL, BLK

### **2. Game Without Live Stats**
- Click game avatar
- Modal opens with score and odds
- No player stats section shown (conditional render)
- No errors, clean UI

### **3. Live Game Updates**
- Open modal during live game
- Stats auto-update every 30 seconds
- Fantasy points recalculate
- Top 5 list may reorder

### **4. Modal Close**
- Close modal (X button or outside click)
- `selectedGameId` becomes null
- Hook stops fetching (`enabled: !!gameId`)
- No background API calls

### **5. Scrolling (Many Players)**
- Modal max height: 90vh
- Overflow: auto
- Scroll to see all player stats
- Header stays at top

---

## 🔗 Database Dependencies

### **Table: `live_player_stats`**
```sql
CREATE TABLE live_player_stats (
  id UUID PRIMARY KEY,
  game_id VARCHAR(50) REFERENCES nba_games(game_id),
  nba_player_id INTEGER,
  player_name TEXT,
  team_tricode VARCHAR(10),
  stats JSONB,  -- Contains pts, reb, ast, etc.
  updated_at TIMESTAMPTZ
);
```

**Query:**
```sql
SELECT 
  nba_player_id,
  player_name,
  team_tricode,
  stats,
  updated_at
FROM live_player_stats
WHERE game_id = 'GAME_ID_HERE'
ORDER BY team_tricode, (stats->>'pts')::numeric DESC;
```

**Indexes Used:**
- `idx_live_player_stats_game_id` (for WHERE clause)
- `idx_live_player_stats_stats_gin` (for JSONB queries)

---

## 💡 Future Enhancements

### **Potential Additions:**

1. **Show All Players (Expandable)**
   - Currently: Top 5 per team
   - Future: "Show all players" button

2. **Filter by Position**
   - Show only PG, SG, SF, PF, C
   - Useful for DFS lineup building

3. **Sorting Options**
   - Sort by: Fantasy points, PTS, REB, AST
   - Toggle ascending/descending

4. **Player Details Modal**
   - Click player for detailed stats
   - Season averages, recent games
   - DFS trends

5. **DFS Lineup Quick Add**
   - "Add to lineup" button per player
   - If user has active DFS entry

6. **Compare to Projections**
   - Show projected vs actual fantasy points
   - Color code: Over/under projection

7. **Live Game Clock**
   - Show game clock (Q1, 2:30)
   - Update in real-time

8. **Player Momentum Indicator**
   - "Hot" if last 5 min stats are high
   - "Cold" if low recent production

---

## ✅ Quality Checks

- ✅ **No linter errors** - TypeScript all correct
- ✅ **Fantasy scoring accurate** - FanDuel formula correct
- ✅ **Data fetching efficient** - Indexed queries
- ✅ **Auto-refresh working** - 30-second interval
- ✅ **Newspaper styling** - Consistent theme
- ✅ **Responsive design** - Works on all screens
- ✅ **Null safety** - Handles missing data
- ✅ **Performance** - Only fetches when needed

---

## 🎉 Result

### **Before:**
- Modal showed: Score + Betting odds
- No player-level data
- Limited fantasy context

### **After:**
- Modal shows: Score + Odds + **Live Player Stats**
- ✅ FanDuel fantasy points calculated
- ✅ Top 5 players per team
- ✅ Full stat line: PTS, REB, AST, STL, BLK
- ✅ Auto-updates every 30 seconds
- ✅ Newspaper-style UI
- ✅ Scrollable for long lists
- ✅ Real-time fantasy insights

**Game modal now provides comprehensive fantasy context for every live/completed game!** 🏀📊🎯

