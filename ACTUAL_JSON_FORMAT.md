# Actual JSON Format Reference

## 📊 Your JSON Structure

Based on your file: `supabase/json/0022500005.json`

This is the **actual format** your system expects and produces.

## 🎯 Complete Structure

```json
{
  "gameId": "0022500005",
  
  "gameMetadata": {
    "date": "2025-10-23T00:00:00",
    "arena": "Gainbridge Fieldhouse",
    "season": "2025",
    "status": "7:30 pm ET",
    "homeTeam": {
      "team_id": 1610612754,
      "abbreviation": "IND",
      "city": "Indiana",
      "name": "Pacers",
      "record": null,
      "quarters": [null, null, null, null],
      "points": null,
      "stats": { }
    },
    "awayTeam": {
      "team_id": 1610612760,
      "abbreviation": "OKC",
      "city": "Oklahoma City",
      "name": "Thunder",
      "record": null,
      "quarters": [null, null, null, null],
      "points": null,
      "stats": { }
    }
  },
  
  "score": {
    "0022500005": {
      "team_stats": {
        "Margin of Victory": 0,
        "Combined Threes": 0,
        "Pace": 102.6,
        "Combined Contested Shots": 80
      },
      "lead_changes": {
        "total": 18,
        "last_5_minutes": 9,
        "last_minute": 1,
        "buzzer_beater": 0
      },
      "dunk_stats": {
        "Alley Oop": 3,
        "Putback": 0,
        "Running": 2,
        "Driving": 0,
        "Tip": 1,
        "Cutting": 1,
        "Total Dunks": 8
      },
      "deep_shots": {
        "deep_threes": 5,
        "four_pointers": 0
      },
      "scoring_milestones": {
        "70 Ball": [],
        "60 Ball": [],
        "50 Ball": [],
        "40 Ball": [],
        "Triple Double": []
      },
      "fun_score": 83.6
    }
  },
  
  "story": {
    "matchup": "Oklahoma City Thunder vs Indiana Pacers",
    "final_score": "Oklahoma City 0 - Indiana 0",
    "advantages": [
      {
        "stat_name": "Free Throw Rate",
        "team": "Oklahoma City",
        "teamId": 0,
        "teamTricode": "OKC",
        "value1": 0.537,
        "value2": 0.381,
        "diff": 0.156
      }
    ],
    "teams": {
      "winner": {
        "name": "Thunder",
        "city": "Oklahoma City",
        "tricode": "OKC",
        "teamId": 0,
        "points": 0
      },
      "loser": {
        "name": "Pacers",
        "city": "Indiana",
        "tricode": "IND",
        "teamId": 0,
        "points": 0
      }
    }
  },
  
  "script": {
    "total_plays": 649,
    "video_script": [
      {
        "gameId": "0022500005",
        "eventNum": null,
        "actionId": 5,
        "period": 1,
        "clock": "PT11M30.00S",
        "description": "Dort OFF.Foul (P1) (J.Tiven)",
        "teamId": 1610612760,
        "teamTricode": "OKC",
        "scoreHome": "",
        "scoreAway": "",
        "videoAvailable": 1,
        "actionType": "Foul",
        "subType": "Offensive",
        "shotResult": "",
        "shotDistance": 0,
        "isFieldGoal": 0,
        "playerName": "Dort",
        "playerNameI": "L. Dort",
        "personId": 1629652,
        "xLegacy": 0,
        "yLegacy": 0,
        "location": "v",
        "pointsTotal": 0,
        "mp4": "https://videos.nba.com/nba/pbp/media/2025/10/23/0022500005/10/77c5a37d-552d-a6ab-8f4d-e2821815ded3_1280x720.mp4",
        "mp4_local": null
      }
      // ... 648 more plays
    ]
  }
}
```

## 🎬 Key: The `script.video_script` Array

This is what you'll use to create slides!

Each play object has:
- **`mp4`**: Direct video URL ✅ THIS IS WHAT WE USE
- **`description`**: What happened (e.g., "Dort OFF.Foul")
- **`period`**: Quarter (1-4, 5+ for OT)
- **`clock`**: Time remaining (PT11M30.00S = 11:30)
- **`playerName`**: Who did it
- **`teamTricode`**: Which team (OKC, IND, etc.)
- **`scoreHome`** / **`scoreAway`**: Current score
- **`actionType`**: Type of play (Shot, Foul, Rebound, etc.)
- **`subType`**: More specific (Alley Oop Dunk, Three Pointer, etc.)

## 📱 How It Works in Feed Content Manager

### 1. Upload JSON
```
You upload: 0022500005.json
System reads: All game data
Extracts: 200+ plays
Filters: Only plays with mp4 URLs
Shows: ~50-150 plays with video
```

### 2. Browse Plays
Each play shown as:
```
┌────────────────────────────────────────────────────┐
│ [Q1] [11:30] [OKC] [Dort]                        │
│ Dort OFF.Foul (P1) (J.Tiven)                      │
│ Score: - -                                   [Add] │
└────────────────────────────────────────────────────┘
```

### 3. Select Plays
Click "Add" on the plays you want:
- Rookie's first bucket ✅
- Big dunk ✅
- Game-winning shot ✅
- Defensive stop ✅

### 4. Build Narrative
Reorder slides to tell the story:
```
1. Setup (game context)
2. Rising action (early plays)
3. Climax (the big moment)
4. Resolution (final plays)
```

### 5. Publish
Post goes live with your selected video slides!

## 🎯 Python Scripts

Your three Python scripts process the raw NBA API data:

### `score.py`
Calculates:
- Lead changes
- Dunk stats
- Deep shots (3s and 4-pointers)
- Fun score (0-100)

### `story.py`
Generates:
- Game narrative
- Winner/loser info
- Statistical advantages
- Team matchup

### `fun.py`
Fetches:
- Play-by-play data from NBA API
- Video URLs for each play
- Game metadata
- Team stats

### Output
All three combine into the single JSON file you upload!

## 📊 What Gets Stored in Database

### When You Publish a Post:

**NOT Stored:**
- ❌ The entire JSON file (too big!)
- ❌ All 200+ plays
- ❌ Unselected video URLs

**Stored in `feed_posts.slides`:**
```json
[
  {
    "type": "video",
    "order": 0,
    "video_url": "https://videos.nba.com/...",
    "thumbnail_url": "https://videos.nba.com/..._thumbnail.jpg",
    "caption": "Dort OFF.Foul (P1) (J.Tiven)",
    "metadata": {
      "period": 1,
      "clock": "PT11M30.00S",
      "actionType": "Foul",
      "subType": "Offensive",
      "playerName": "Dort",
      "playerNameI": "L. Dort",
      "personId": 1629652,
      "teamTricode": "OKC",
      "scoreHome": "",
      "scoreAway": "",
      "shotResult": ""
    }
  }
  // ... only your selected slides (3-5 typically)
]
```

**Also stored in `feed_posts.metadata`:**
```json
{
  "arena": "Gainbridge Fieldhouse",
  "season": "2025",
  "homeTeam": { ... },
  "awayTeam": { ... },
  "story_data": { ... },
  "fun_data": {
    "lead_changes": { "total": 18, ... },
    "dunk_stats": { "Total Dunks": 8, ... },
    "fun_score": 83.6
  }
}
```

## 💡 Space Savings

### If You Stored Entire JSON:
- File size: 1.7 MB
- Per post: 1.7 MB
- 100 posts: 170 MB! 💸

### What You Actually Store:
- Slides (3-5): ~5 KB
- Metadata: ~2 KB
- Per post: ~7 KB ✅
- 100 posts: 700 KB 🎉

**Savings: 99.6% less storage!**

## 🎨 Example: Rookie Watch Post

### Your Scenario:
"Rookie scores 13 off the bench in limited time"

### Step-by-Step:

1. **Upload JSON** for that game
2. **Filter plays** by rookie's name (e.g., "Henderson")
3. **Select 4-5 plays**:
   - First bucket (confidence builder)
   - And-1 play (skill showcase)
   - Dime to teammate (IQ play)
   - Game-sealing free throws (clutch)
4. **Fill details**:
   - Type: "Rookie Watch"
   - Title: "Scoot Henderson: 13 Points in 12 Minutes"
   - Description: "The rookie came off the bench and..."
5. **Publish** → Goes live!

## 🔍 Finding Specific Plays

### Filter by Player
```javascript
plays.filter(play => play.playerName.includes('Henderson'))
```

### Filter by Action Type
```javascript
plays.filter(play => play.actionType === 'Shot' && play.shotResult === 'Made')
```

### Filter by Period
```javascript
plays.filter(play => play.period === 4) // 4th quarter only
```

### Filter by Team
```javascript
plays.filter(play => play.teamTricode === 'OKC')
```

## 🚀 Quick Reference

| Field | What It Is | Example |
|-------|------------|---------|
| `gameId` | NBA game identifier | "0022500005" |
| `gameMetadata.date` | When game was played | "2025-10-23" |
| `gameMetadata.arena` | Where game was played | "Gainbridge Fieldhouse" |
| `score[gameId].fun_score` | How exciting (0-100) | 83.6 |
| `story.matchup` | Teams playing | "OKC vs IND" |
| `script.total_plays` | Total plays in game | 649 |
| `script.video_script[].mp4` | Video URL | "https://videos.nba.com/..." |
| `script.video_script[].description` | What happened | "Dort OFF.Foul" |
| `script.video_script[].period` | Quarter | 1 (Q1), 4 (Q4), 5 (OT) |
| `script.video_script[].clock` | Time remaining | "PT11M30.00S" (11:30) |
| `script.video_script[].playerName` | Who did it | "Dort" |
| `script.video_script[].teamTricode` | Team abbreviation | "OKC", "IND", "LAL" |

## 📝 Notes

1. **Clock Format**: `PT11M30.00S` means 11 minutes 30 seconds
2. **Empty Scores**: Some plays (fouls, timeouts) don't have scores
3. **Video Availability**: Not all plays have video (check `mp4` field)
4. **JSON Size**: Files are 1-2 MB (that's why we don't store them!)
5. **Fun Score**: Calculated by your `score.py` script (lead changes, dunks, etc.)

## ✅ System Is Ready

The `FeedContentManager` now:
- ✅ Parses your exact JSON format
- ✅ Extracts `plays` array
- ✅ Filters plays with video
- ✅ Shows play details (period, time, player, team)
- ✅ Lets you select specific plays
- ✅ Builds slides from selected plays
- ✅ Stores only what you choose
- ✅ Saves 99.6% storage space!

**You're ready to create viral content!** 🚀

