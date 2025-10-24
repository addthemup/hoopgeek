#!/bin/bash

# Setup script for nightly NBA data sync cron jobs
# This will run two scripts every night at 3:30 AM EST:
# 1. Schedule sync - updates game schedule from NBA.com
# 2. Box score import - imports stats from yesterday's games

echo "🏀 Setting up nightly NBA data sync..."
echo "=" * 80

# Get the absolute path to the project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"
SCHEDULE_SCRIPT="$PROJECT_DIR/scripts/setup/import_2025_26_season.py"
BOXSCORE_SCRIPT="$PROJECT_DIR/scripts/setup/import_daily_boxscores.py"
LOG_DIR="$PROJECT_DIR/logs"
SCHEDULE_LOG="$LOG_DIR/nba_schedule_sync.log"
BOXSCORE_LOG="$LOG_DIR/nba_boxscore_import.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Create the cron job script for schedule sync
SCHEDULE_CRON_SCRIPT="$PROJECT_DIR/scripts/setup/run_nightly_schedule_sync.sh"

cat > "$CRON_SCRIPT" << 'EOF'
#!/bin/bash

# Nightly NBA Schedule Sync Script
# Automatically syncs the NBA schedule from cdn.nba.com

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Set environment variables
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

# Log file
LOG_FILE="$PROJECT_DIR/logs/nba_schedule_sync.log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Run the import script and append output to log
echo "" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
echo "Sync started at: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

cd "$PROJECT_DIR"
python3 scripts/setup/import_2025_26_season.py >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Sync completed successfully at: $(date)" >> "$LOG_FILE"
else
    echo "❌ Sync failed with exit code $EXIT_CODE at: $(date)" >> "$LOG_FILE"
fi

echo "========================================" >> "$LOG_FILE"
EOF

# Make the script executable
chmod +x "$CRON_SCRIPT"

echo "✅ Created sync script at: $CRON_SCRIPT"
echo ""

# Display the cron job command
echo "📋 To set up the nightly cron job, run the following command:"
echo ""
echo "crontab -e"
echo ""
echo "Then add this line to run the sync every night at 3:30 AM EST:"
echo ""
echo "30 3 * * * $CRON_SCRIPT"
echo ""
echo "Or for 4:00 AM EST:"
echo ""
echo "0 4 * * * $CRON_SCRIPT"
echo ""
echo "=" * 80
echo "🎉 Setup complete!"
echo ""
echo "📝 The sync script logs will be written to:"
echo "   $LOG_FILE"
echo ""
echo "🔍 To view recent logs:"
echo "   tail -f $LOG_FILE"
echo ""
echo "▶️  To test the sync manually:"
echo "   $CRON_SCRIPT"
echo ""

