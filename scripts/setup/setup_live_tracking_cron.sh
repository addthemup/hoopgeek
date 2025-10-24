#!/bin/bash

# Setup script for live fantasy score tracking cron job
# This runs every minute during typical NBA game times (6 PM - 1 AM EST)

echo "🏀 Setting up live fantasy score tracking..."
echo "=" * 80

# Get the absolute path to the project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"
LIVE_TRACKING_SCRIPT="$PROJECT_DIR/scripts/setup/update_live_fantasy_scores.py"
LOG_DIR="$PROJECT_DIR/logs"
LIVE_TRACKING_LOG="$LOG_DIR/live_fantasy_tracking.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo "✅ Created logs directory at: $LOG_DIR"
echo ""

# Create the cron script wrapper
CRON_WRAPPER="$PROJECT_DIR/scripts/setup/run_live_tracking.sh"

cat > "$CRON_WRAPPER" << 'EOF'
#!/bin/bash

# Live Fantasy Score Tracking Wrapper
# Runs the live tracking script with proper environment variables

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Set environment variables
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

# Log file
LIVE_TRACKING_LOG="$PROJECT_DIR/logs/live_fantasy_tracking.log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

echo "" >> "$LIVE_TRACKING_LOG"
echo "========================================" >> "$LIVE_TRACKING_LOG"
echo "Live Tracking started at: $(date)" >> "$LIVE_TRACKING_LOG"
echo "========================================" >> "$LIVE_TRACKING_LOG"

cd "$PROJECT_DIR"

# Run the live tracking script
python3 scripts/setup/update_live_fantasy_scores.py >> "$LIVE_TRACKING_LOG" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Live tracking completed successfully at: $(date)" >> "$LIVE_TRACKING_LOG"
else
    echo "❌ Live tracking failed with exit code $EXIT_CODE at: $(date)" >> "$LIVE_TRACKING_LOG"
fi

echo "========================================" >> "$LIVE_TRACKING_LOG"

exit $EXIT_CODE
EOF

# Make the script executable
chmod +x "$CRON_WRAPPER"
chmod +x "$LIVE_TRACKING_SCRIPT"

echo "✅ Created live tracking wrapper at: $CRON_WRAPPER"
echo ""

# Display the cron job commands
echo "=" * 80
echo "📋 To set up the live tracking cron job, run:"
echo ""
echo "crontab -e"
echo ""
echo "Then add these lines to run every minute during NBA game times (6 PM - 1 AM EST):"
echo ""
echo "# Live fantasy score tracking - runs every minute from 6 PM to 1 AM EST"
echo "* 18-23 * * * $CRON_WRAPPER"
echo "* 0-1 * * * $CRON_WRAPPER"
echo ""
echo "Or to run every 2 minutes (less API calls, slightly less real-time):"
echo ""
echo "*/2 18-23 * * * $CRON_WRAPPER"
echo "*/2 0-1 * * * $CRON_WRAPPER"
echo ""
echo "=" * 80
echo "🎉 Setup complete!"
echo ""
echo "📝 The live tracking script will write logs to:"
echo "   $LIVE_TRACKING_LOG"
echo ""
echo "🔍 To view recent live tracking logs:"
echo "   tail -f $LIVE_TRACKING_LOG"
echo ""
echo "▶️  To test the live tracking manually:"
echo "   $CRON_WRAPPER"
echo ""
echo "💡 Tips:"
echo "   - Script runs every minute during game times to keep scores updated"
echo "   - Automatically fetches live box scores from NBA API"
echo "   - Updates DFS entry scores and fantasy league averages"
echo "   - Only processes games that are currently live or just finished"
echo ""

