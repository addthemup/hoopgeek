#!/bin/bash

# Setup script for nightly NBA data sync cron jobs
# This will create two cron scripts that run every night at 3:30 AM EST:
# 1. Schedule sync - updates game schedule from NBA.com
# 2. Box score import - imports stats from yesterday's games

echo "🏀 Setting up nightly NBA data sync..."
echo "=" * 80

# Get the absolute path to the project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"
SCHEDULE_SCRIPT="$PROJECT_DIR/scripts/setup/nba_schedule_import.py"
BOXSCORE_SCRIPT="$PROJECT_DIR/scripts/setup/import_daily_boxscores.py"
LOG_DIR="$PROJECT_DIR/logs"
SCHEDULE_LOG="$LOG_DIR/nba_schedule_sync.log"
BOXSCORE_LOG="$LOG_DIR/nba_boxscore_import.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo "✅ Created logs directory at: $LOG_DIR"
echo ""

# Create the master cron script that runs both imports
MASTER_CRON_SCRIPT="$PROJECT_DIR/scripts/setup/run_nightly_sync.sh"

cat > "$MASTER_CRON_SCRIPT" << 'EOF'
#!/bin/bash

# Master Nightly NBA Data Sync Script
# Runs both schedule sync and box score import

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Set environment variables
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

# Log files
SCHEDULE_LOG="$PROJECT_DIR/logs/nba_schedule_sync.log"
BOXSCORE_LOG="$PROJECT_DIR/logs/nba_boxscore_import.log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

echo "" >> "$SCHEDULE_LOG"
echo "========================================" >> "$SCHEDULE_LOG"
echo "Schedule Sync started at: $(date)" >> "$SCHEDULE_LOG"
echo "========================================" >> "$SCHEDULE_LOG"

cd "$PROJECT_DIR"

# 1. Run schedule sync first
echo "📅 Running schedule sync..." >> "$SCHEDULE_LOG"
python3 scripts/setup/nba_schedule_import.py >> "$SCHEDULE_LOG" 2>&1
SCHEDULE_EXIT=$?

if [ $SCHEDULE_EXIT -eq 0 ]; then
    echo "✅ Schedule sync completed successfully at: $(date)" >> "$SCHEDULE_LOG"
else
    echo "❌ Schedule sync failed with exit code $SCHEDULE_EXIT at: $(date)" >> "$SCHEDULE_LOG"
fi

echo "========================================" >> "$SCHEDULE_LOG"

# 2. Run box score import (for yesterday's games)
echo "" >> "$BOXSCORE_LOG"
echo "========================================" >> "$BOXSCORE_LOG"
echo "Box Score Import started at: $(date)" >> "$BOXSCORE_LOG"
echo "========================================" >> "$BOXSCORE_LOG"

echo "📊 Running box score import..." >> "$BOXSCORE_LOG"
python3 scripts/setup/import_daily_boxscores.py >> "$BOXSCORE_LOG" 2>&1
BOXSCORE_EXIT=$?

if [ $BOXSCORE_EXIT -eq 0 ]; then
    echo "✅ Box score import completed successfully at: $(date)" >> "$BOXSCORE_LOG"
else
    echo "❌ Box score import failed with exit code $BOXSCORE_EXIT at: $(date)" >> "$BOXSCORE_LOG"
fi

echo "========================================" >> "$BOXSCORE_LOG"

# Exit with success only if both succeeded
if [ $SCHEDULE_EXIT -eq 0 ] && [ $BOXSCORE_EXIT -eq 0 ]; then
    exit 0
else
    exit 1
fi
EOF

# Make the script executable
chmod +x "$MASTER_CRON_SCRIPT"
chmod +x "$SCHEDULE_SCRIPT"
chmod +x "$BOXSCORE_SCRIPT"

echo "✅ Created master sync script at: $MASTER_CRON_SCRIPT"
echo ""

# Display the cron job command
echo "=" * 80
echo "📋 To set up the nightly cron job, run the following command:"
echo ""
echo "crontab -e"
echo ""
echo "Then add this line to run both syncs every night at 3:30 AM EST:"
echo ""
echo "30 3 * * * $MASTER_CRON_SCRIPT"
echo ""
echo "Or for 4:00 AM EST:"
echo ""
echo "0 4 * * * $MASTER_CRON_SCRIPT"
echo ""
echo "=" * 80
echo "🎉 Setup complete!"
echo ""
echo "📝 The sync scripts will write logs to:"
echo "   Schedule: $SCHEDULE_LOG"
echo "   Box Scores: $BOXSCORE_LOG"
echo ""
echo "🔍 To view recent schedule sync logs:"
echo "   tail -f $SCHEDULE_LOG"
echo ""
echo "🔍 To view recent box score import logs:"
echo "   tail -f $BOXSCORE_LOG"
echo ""
echo "▶️  To test both syncs manually:"
echo "   $MASTER_CRON_SCRIPT"
echo ""

