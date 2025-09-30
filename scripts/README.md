# NBA Players Import Scripts

This directory contains Python scripts to import NBA players from the NBA API into your HoopGeek Supabase database.

## Quick Start

### Option 1: Automated Setup (Recommended)
```bash
cd scripts
./setup_and_run.sh
```

### Option 2: Manual Setup
```bash
cd scripts
pip3 install -r requirements.txt
python3 import_nba_players.py
```

## What It Does

1. **Fetches all NBA players** from the official NBA API
2. **Imports them into your Supabase database** using the `upsert_player` function
3. **Provides detailed logging** with progress indicators and statistics
4. **Handles errors gracefully** and continues processing
5. **Avoids duplicates** using NBA Player ID as unique identifier

## Features

- ✅ **Batch processing** for better performance
- ✅ **Progress indicators** showing current batch and player count
- ✅ **Error handling** with detailed error messages
- ✅ **Statistics reporting** showing imported vs updated players
- ✅ **Verification** showing total players in database after import
- ✅ **Sample display** showing some imported players

## Output Example

```
🚀 Starting NBA Players Import Script
👤 User UID: fd58dfb7-ad5d-43e2-b2c4-c254e2a29211
🕐 Started at: 2024-01-15 14:30:00
------------------------------------------------------------
🔧 Setting up Supabase client...
✅ Supabase client initialized
🏀 Fetching players from NBA API...
📊 Found 4523 players from NBA API
💾 Importing players to database...
📦 Processing batch 1/91 (50 players)
   Processed 10/50 players in this batch
   Processed 20/50 players in this batch
   ...
------------------------------------------------------------
🎉 Import completed successfully!
📊 Final Statistics:
   Total players processed: 4523
   New players imported: 4523
   Existing players updated: 0
   Errors: 0
🕐 Completed at: 2024-01-15 14:35:00

🔍 Verifying import...
✅ Total players in database: 4523

📋 Sample of imported players:
   • LeBron James (F) - Los Angeles Lakers - Active
   • Stephen Curry (G) - Golden State Warriors - Active
   • Kevin Durant (F) - Phoenix Suns - Active
   • Giannis Antetokounmpo (F) - Milwaukee Bucks - Active
   • Luka Doncic (G) - Dallas Mavericks - Active
```

## Requirements

- Python 3.7+
- pip3
- Internet connection
- Valid Supabase credentials (already configured in script)

## Configuration

The script is pre-configured with:
- Your Supabase URL and service key
- Your user UID: `fd58dfb7-ad5d-43e2-b2c4-c254e2a29211`
- NBA API endpoint and headers

No additional configuration needed!

## Troubleshooting

If you encounter issues:

1. **Make sure Python 3 and pip3 are installed**
2. **Check your internet connection**
3. **Verify Supabase credentials are correct**
4. **Run with verbose output**: `python3 import_nba_players.py`

The script will provide detailed error messages to help diagnose any issues.
