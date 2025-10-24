# Basketball Court with Positioned Jerseys ✅

## What Changed

Completely redesigned the Matchup Details court view to show **realistic game-like positioning**:

### Before ❌
- Player cards in side-by-side columns
- Teams separated left vs right
- Generic avatars with stats
- No positional logic

### After ✅
- **SVG jerseys directly on court**
- **White jerseys (Team 1) vs Colored jerseys (Team 2)**
- **Positioned by basketball position** (guards vs guards, forwards vs forwards, centers vs centers)
- **Realistic offensive/defensive spacing**
- **No cards** - just jerseys, names, and points

## Key Features

### 1. Jersey Design

#### Team 1 (Home) - White Jerseys with Team Trim
```jsx
- Main body: White (#FFFFFF)
- Sleeves: Team primary color
- Neckline: Team primary color
- Side stripes: Team primary color
- Numbers: Team primary color with shadow
- Thicker stroke (3px) for definition
```

#### Team 2 (Away) - Full Team Color
```jsx
- Main body: Team primary color
- Sleeves: Team secondary color (opacity 0.7)
- Neckline: Team secondary color
- Side stripes: Team secondary color
- Numbers: White with shadow
- Standard stroke (2px)
```

### 2. Positional Logic

Players are positioned based on their **actual basketball positions**:

#### Guards (G, PG, SG)
**Team 1 (Offensive):**
- PG: (35%, 75%) - Top of the key
- SG: (15%, 65%) - Wing

**Team 2 (Defensive):**
- PG defender: (38%, 72%) - Guarding point
- SG defender: (18%, 68%) - Guarding wing

#### Forwards (F, SF, PF)
**Team 1 (Offensive):**
- SF: (65%, 65%) - Opposite wing
- PF: (30%, 45%) - Block

**Team 2 (Defensive):**
- SF defender: (62%, 68%) - Guarding wing
- PF defender: (33%, 48%) - Guarding block

#### Centers (C)
**Team 1 (Offensive):**
- C: (60%, 45%) - Low post

**Team 2 (Defensive):**
- C defender: (57%, 48%) - Defending post

### 3. Court Layout

```
Header:
┌─────────────────────────────────────────────────┐
│  ⚪ Team 1  │  [Tabs: Starters/Rotation/Bench]  │  Team 2 ● │
└─────────────────────────────────────────────────┘

Court:
┌─────────────────────────────────────────────────┐
│                                                 │
│     ⚪G      ●G                                 │
│                                                 │
│  ⚪G              ●G                            │
│                                                 │
│                    ●F      ⚪F                  │
│                                                 │
│     ⚪F      ●F                                 │
│                                                 │
│                 ●C   ⚪C                        │
│                                                 │
└─────────────────────────────────────────────────┘

Legend:
⚪ = White jersey (Team 1, offensive)
● = Colored jersey (Team 2, defensive)
```

### 4. Player Jersey Components

Each jersey shows:
- ✅ **Jersey SVG** with team colors
- ✅ **Jersey number** (large, bold)
- ✅ **Player last name** (uppercase, below jersey)
- ✅ **Fantasy points chip** (if they've played games)
- ✅ **Multiplier badge** (1.0× / 0.75× / 0.5× - color coded)
- ✅ **Hover animation** (scale 1.1×)

### 5. Tab Selection

Switch between units:
- **🟢 Starters** (1.0× multiplier) - success color
- **🟡 Rotation** (0.75× multiplier) - warning color
- **⚫ Bench** (0.5× multiplier) - neutral color

Both teams update together when you change tabs.

## Technical Implementation

### Jersey Rendering Function

```typescript
const renderJersey = (
  player: LineupPlayer,
  teamColors: any,
  isWhiteJersey: boolean,
  multiplier: number,
  stats?: { averagePoints, multipliedPoints, gamesPlayed }
) => {
  // Returns SVG jersey with:
  // - Dynamic fill (white vs team color)
  // - Team color trim
  // - Jersey number overlay
  // - Multiplier badge
  // - Player name
  // - Fantasy points chip
}
```

### Position Calculation

```typescript
const getCourtPosition = (
  position: string,
  isTeam1: boolean,
  index: number
): { x: number; y: number } => {
  // Returns court coordinates (% based)
  // Guards, Forwards, Centers positioned realistically
  // Team 1 = offensive positions
  // Team 2 = defensive positions (guarding)
}
```

### Player Grouping

```typescript
// Group by position type
const team1Guards = team1Unit.filter(p => p.player_position.includes('G'));
const team1Forwards = team1Unit.filter(p => p.player_position.includes('F'));
const team1Centers = team1Unit.filter(p => p.player_position === 'C');

// Same for team2...

// Plot all on court with absolute positioning
allPlayers.map(item => (
  <Box
    sx={{
      position: 'absolute',
      left: `${position.x}%`,
      top: `${position.y}%`,
      transform: 'translate(-50%, -50%)',
    }}
  >
    {renderJersey(...)}
  </Box>
))
```

## Visual Design

### Jersey SVG Details

**Path Definition:**
```svg
M 30 15 L 20 25 L 25 35 L 25 85 L 35 95 L 65 95 L 75 85 L 75 35 L 80 25 L 70 15 L 65 20 L 55 15 L 45 15 L 35 20 Z
```
- Creates realistic jersey shape
- Includes shoulders, sleeves, and body
- Neckline as ellipse
- Side stripes for detail

**Drop Shadow:**
```css
filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4))
```
- Makes jerseys "pop" off the court
- Adds depth and realism

### Multiplier Badge

- **Position:** Top-right corner
- **Colors:**
  - 🟢 Success (1.0×)
  - 🟡 Warning (0.75×)
  - ⚫ Neutral (0.5×)
- **Border:** 2px white
- **Size:** 18×18px

### Fantasy Points Chip

- Only shows if player has played games
- Solid success color
- Bold font
- Shows multiplied points (e.g., "42.5")

## Responsive Design

### Desktop
```css
height: 80vh (min: 700px)
jerseySize: 80px
fontSize: 1.8rem (jersey numbers)
```

### Mobile
```css
height: 70vh (min: 500px)
jerseySize: 60px
fontSize: 1.4rem (jersey numbers)
```

## User Experience

### Interactions
1. **Hover jerseys**: Scale up 10%
2. **Change tabs**: Instantly updates all players
3. **View stats**: Points shown below each jersey
4. **Visual clarity**: White vs colored jerseys immediately distinguish teams

### Visual Hierarchy
1. **Court** - Establishes context
2. **Jersey colors** - Team identification
3. **Positions** - Game-like spacing
4. **Numbers** - Player identification
5. **Names** - Confirmation
6. **Points** - Performance data

## Files Modified

### Updated
- ✅ `src/pages/MatchupDetails.tsx`
  - Added `renderJersey()` function
  - Added `getCourtPosition()` helper
  - Removed card-based layout
  - Implemented positional plotting
  - Added white vs colored jersey logic
  - Grouped players by position type

### Created
- 📄 `MATCHUP_COURT_JERSEYS_COMPLETE.md` - This document

## Advantages Over Previous Design

### Visual
- ✅ **More realistic** - looks like a real basketball broadcast
- ✅ **Cleaner** - no cards cluttering the court
- ✅ **Better team distinction** - white vs colored jerseys
- ✅ **Authentic positioning** - guards guard guards, etc.

### UX
- ✅ **Easier to scan** - see the whole matchup at once
- ✅ **Better context** - court shows game situation
- ✅ **Faster comparison** - both teams visible together
- ✅ **More engaging** - looks professional

### Performance
- ✅ **Less DOM** - no card wrappers
- ✅ **Simpler structure** - just positioned boxes
- ✅ **Efficient rendering** - one loop through players

## Summary

✅ **Basketball court with positioned jersey sprites**

### What You Get
1. **Realistic NBA court** with all markings
2. **White home jerseys** with team color trim (Team 1)
3. **Full color away jerseys** (Team 2)
4. **Positional grouping** - guards vs guards, forwards vs forwards
5. **Offensive/defensive spacing** - realistic game positioning
6. **Tab-based unit selection** - Starters / Rotation / Bench
7. **Live fantasy points** - displayed below jerseys
8. **Hover animations** - interactive and polished

The matchup page now looks like you're watching a live basketball game on TV with jersey sprites! 🏀👕

