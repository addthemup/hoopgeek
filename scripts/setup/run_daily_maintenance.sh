#!/bin/bash

# Daily NBA Data Maintenance Script
# Runs all daily maintenance tasks:
# 1. Prune nba_daily_player_stats & nba_daily_team_stats (delete rows older than 7 days)
# 2. Import daily boxscores
# 3. Mark games with boxscores as Final
# 4. Import player props
# 5. Import game odds
# 6. Import NBA standings
# 7. Import NBA leaders
# 8. Scrape NBA Player of the Week (2025-26)
# 9. Scrape NBA Player of the Month (2025-26)
# 10. Backfill Team of the Night (nba_totn) — --days 150
# 11. Backfill Team of the Week (nba_totw)
# 12. Scrape draft rankings (draft_prospects + draft_rankings)
# 13. Fetch injuries (Supabase Edge Function)
#
# Optional (commented in body): Import/update players — slow.
# Team rosters: NOT daily — run weekly: bash scripts/setup/run_import_nba_team_rosters.sh
# (Import player game stats from JSON was removed — scripts/feed/import_player_game_stats.py not in repo.)

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Set environment variables
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"
export VITE_SPORTS_ODDS_API_KEY="79ae5f47830d3d87e70896e36b5eefc3"
export SPORTS_ODDS_API_KEY="79ae5f47830d3d87e70896e36b5eefc3"

# Log file
LOG_FILE="$PROJECT_DIR/logs/daily_maintenance.log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Change to project directory
cd "$PROJECT_DIR"

# Initialize counters
TOTAL_SCRIPTS=13
SUCCESSFUL=0
FAILED=0
FAILED_SCRIPTS=()

# Print header
echo ""
echo "========================================"
echo "🏀 Daily NBA Data Maintenance"
echo "========================================"
echo "Started at: $(date)"
echo "Project directory: $PROJECT_DIR"
echo "========================================"
echo ""

# Function to run a script and track results
run_script() {
    local script_name=$1
    local script_path=$2
    local script_number=$3
    local script_args=$4
    
    echo ""
    echo "[$script_number/$TOTAL_SCRIPTS] Running: $script_name"
    echo "----------------------------------------"
    
    # Log to both console and file
    {
        echo ""
        echo "========================================"
        echo "$script_name started at: $(date)"
        echo "========================================"
    } | tee -a "$LOG_FILE"
    
    # Run the script with optional arguments
    if [ -n "$script_args" ]; then
        python3 "$script_path" $script_args 2>&1 | tee -a "$LOG_FILE"
    else
        python3 "$script_path" 2>&1 | tee -a "$LOG_FILE"
    fi
    EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo ""
        echo "✅ $script_name completed successfully"
        SUCCESSFUL=$((SUCCESSFUL + 1))
        {
            echo "✅ $script_name completed successfully at: $(date)"
            echo "========================================"
        } | tee -a "$LOG_FILE"
    else
        echo ""
        echo "❌ $script_name failed with exit code $EXIT_CODE"
        FAILED=$((FAILED + 1))
        FAILED_SCRIPTS+=("$script_name")
        {
            echo "❌ $script_name failed with exit code $EXIT_CODE at: $(date)"
            echo "========================================"
        } | tee -a "$LOG_FILE"
    fi
    
    echo "----------------------------------------"
}

# Function to call the fetch-injuries Edge Function and track results
run_fetch_injuries_edge() {
    local script_name="Fetch Injuries (Supabase Edge Function)"
    local script_number=$1
    local func_url="${VITE_SUPABASE_URL%/}/functions/v1/fetch-injuries"

    echo ""
    echo "[$script_number/$TOTAL_SCRIPTS] Running: $script_name"
    echo "----------------------------------------"

    {
        echo ""
        echo "========================================"
        echo "$script_name started at: $(date)"
        echo "Endpoint: $func_url"
        echo "========================================"
    } | tee -a "$LOG_FILE"

    # Call the edge function for today's report
    RESP=$(curl -s -w "\n%{http_code}" -X POST "$func_url" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d '{}' 2>&1 | tee -a "$LOG_FILE")

    HTTP_CODE=$(echo "$RESP" | tail -n1)
    BODY=$(echo "$RESP" | sed '$d')

    echo "HTTP $HTTP_CODE" | tee -a "$LOG_FILE"
    if command -v jq >/dev/null 2>&1; then
      echo "$BODY" | jq . 2>/dev/null | tee -a "$LOG_FILE" || echo "$BODY" | tee -a "$LOG_FILE"
    else
      echo "$BODY" | tee -a "$LOG_FILE"
    fi

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        echo ""
        echo "✅ $script_name completed successfully"
        SUCCESSFUL=$((SUCCESSFUL + 1))
        {
            echo "✅ $script_name completed successfully at: $(date)"
            echo "========================================"
        } | tee -a "$LOG_FILE"
    else
        echo ""
        echo "❌ $script_name failed with HTTP $HTTP_CODE"
        FAILED=$((FAILED + 1))
        FAILED_SCRIPTS+=("$script_name")
        {
            echo "❌ $script_name failed with HTTP $HTTP_CODE at: $(date)"
            echo "========================================"
        } | tee -a "$LOG_FILE"
    fi

    echo "----------------------------------------"
}

# Run all scripts in sequence (Python-based maintenance + Edge Function injuries)
run_script "Prune nba_daily_player_stats & nba_daily_team_stats (older than 7 days)" "scripts/setup/prune_nba_stats.py" 1
run_script "Import Daily Boxscores" "scripts/setup/import_daily_boxscores.py" 2
run_script "Mark Games With Boxscores Final" "scripts/setup/mark_games_with_boxscores_final.py" 3
run_script "Import Player Props" "scripts/import_player_props.py" 4
run_script "Import Game Odds" "scripts/setup/import_game_odds.py" 5
run_script "Import NBA Standings" "scripts/setup/import_nba_standings.py" 6
run_script "Import NBA Leaders" "scripts/setup/import_nba_leaders.py" 7
# run_script "Import/Update Players" "scripts/setup/import_update_players.py" 8  # COMMENTED OUT — slow
run_script "Scrape NBA Player of the Week (2025-26)" "scripts/setup/scrape_nba_pow.py" 8
run_script "Scrape NBA Player of the Month (2025-26)" "scripts/setup/scrape_nba_pom.py" 9
# run_script "Import Player Game Stats" "scripts/feed/import_player_game_stats.py" 10  # script not in repo; re-enable when added
run_script "Backfill Team of the Night (nba_totn)" "scripts/setup/backfill_nba_totn.py" 10 "--days 150"
run_script "Backfill Team of the Week (nba_totw)" "scripts/setup/backfill_nba_totw.py" 11
run_script "Scrape Draft Rankings (draft_prospects + draft_rankings)" "scripts/setup/draft-agg/scrape_draft_rankings.py" 12 "--source all"
run_fetch_injuries_edge 13

# Print summary
echo ""
echo "========================================"
echo "📊 Summary"
echo "========================================"
echo "Total scripts: $TOTAL_SCRIPTS"
echo "✅ Successful: $SUCCESSFUL"
echo "❌ Failed: $FAILED"

if [ ${#FAILED_SCRIPTS[@]} -gt 0 ]; then
    echo ""
    echo "Failed scripts:"
    for script in "${FAILED_SCRIPTS[@]}"; do
        echo "  - $script"
    done
fi

echo ""
echo "Completed at: $(date)"
echo "========================================"
echo ""
echo "📝 Full log saved to: $LOG_FILE"
echo ""

# Exit with error if any script failed
if [ $FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi

